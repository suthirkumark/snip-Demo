const PORT = Number(process.env.PORT || 3000);

function resolveBaseUrl() {
  if (process.env.BASE_URL) {
    return new URL(process.env.BASE_URL).origin;
  }

  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return new URL(`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`).origin;
  }

  return `http://localhost:${PORT}`;
}

const BASE_URL = resolveBaseUrl();
const PUBLIC_DIR = process.env.PUBLIC_DIR;
const links = new Map();
const base62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function withCors(response) {
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  headers.set("access-control-allow-headers", "content-type");
  headers.set("access-control-max-age", "86400");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function generateCode() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let code = "";

  for (const byte of bytes) {
    code += base62[byte % base62.length];
  }

  return code;
}

function sanitizePublicPath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const withoutLeadingSlash = decoded.replace(/^\/+/, "");
  const normalized = withoutLeadingSlash === "" ? "index.html" : withoutLeadingSlash;

  if (normalized.includes("..")) {
    return null;
  }

  return normalized;
}

async function maybeServeStatic(pathname) {
  if (!PUBLIC_DIR) {
    return null;
  }

  const relativePath = sanitizePublicPath(pathname);
  if (!relativePath) {
    return json({ error: "Invalid path" }, 400);
  }

  const file = Bun.file(`${PUBLIC_DIR}/${relativePath}`);
  if (await file.exists()) {
    return new Response(file);
  }

  return null;
}

function normalizeUrlCandidate(input) {
  try {
    const parsed = new URL(input);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    if (req.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }));
    }

    const url = new URL(req.url);
    const pathname = url.pathname;

    if (req.method === "GET" && pathname === "/api/links") {
      return withCors(json(Array.from(links.values())));
    }

    if (req.method === "POST" && pathname === "/api/links") {
      let payload;
      try {
        payload = await req.json();
      } catch {
        return withCors(json({ error: "Invalid JSON" }, 400));
      }

      const normalizedUrl = normalizeUrlCandidate(payload?.url);
      if (!normalizedUrl) {
        return withCors(json({ error: "URL must be http(s)" }, 400));
      }

      let code = generateCode();
      while (links.has(code)) {
        code = generateCode();
      }

      const createdAt = new Date().toISOString();
      const entry = {
        code,
        url: normalizedUrl,
        shortUrl: `${BASE_URL}/${code}`,
        hits: 0,
        createdAt,
      };

      links.set(code, entry);
      return withCors(json(entry, 201));
    }

    if (req.method === "GET") {
      const staticResponse = await maybeServeStatic(pathname);
      if (staticResponse) {
        return withCors(staticResponse);
      }

      const code = pathname.slice(1);
      if (!code) {
        return withCors(json({ error: "Not found" }, 404));
      }

      const entry = links.get(code);
      if (!entry) {
        return withCors(json({ error: "Not found" }, 404));
      }

      entry.hits += 1;
      links.set(code, entry);

      return withCors(
        new Response(null, {
          status: 302,
          headers: {
            location: entry.url,
          },
        }),
      );
    }

    return withCors(json({ error: "Method not allowed" }, 405));
  },
});

console.log(`Snip backend listening on ${server.url}`);
