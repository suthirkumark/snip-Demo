#!/usr/bin/env node

const { spawn } = require('node:child_process');

const BASE_URL = (process.env.SNIP_API || 'http://localhost:3000').replace(/\/+$/, '');

function usage() {
  console.log(`Usage:
  snip add <url>    Create a short link
  snip ls           List all links
  snip open <code>  Open the target URL for a short code
  snip help         Show this help`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function fetchJson(path, options) {
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, options);
  } catch {
    fail(`Cannot reach backend at ${BASE_URL}`);
  }

  return response;
}

async function addCommand(url) {
  if (!url || !isHttpUrl(url)) {
    fail('Provide a valid http:// or https:// URL.');
  }

  const response = await fetchJson('/api/links', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    fail(body && body.error ? body.error : `Request failed (${response.status})`);
  }

  console.log(body.shortUrl);
}

function pad(value, width) {
  return String(value).padEnd(width, ' ');
}

async function lsCommand() {
  const response = await fetchJson('/api/links', { method: 'GET' });

  let links = null;
  try {
    links = await response.json();
  } catch {
    links = null;
  }

  if (!response.ok) {
    const message = links && links.error ? links.error : `Request failed (${response.status})`;
    fail(message);
  }

  if (!Array.isArray(links) || links.length === 0) {
    console.log('No links yet.');
    return;
  }

  const codeWidth = Math.max('CODE'.length, ...links.map((x) => String(x.code || '').length));
  const hitsWidth = Math.max('HITS'.length, ...links.map((x) => String(x.hits ?? '').length));

  console.log(`${pad('CODE', codeWidth)}  ${pad('HITS', hitsWidth)}  URL`);
  for (const link of links) {
    console.log(`${pad(link.code, codeWidth)}  ${pad(link.hits, hitsWidth)}  ${link.url}`);
  }
}

function openInBrowser(url) {
  const platform = process.platform;

  if (platform === 'win32') {
    const child = spawn('cmd', ['/c', 'start', '', url], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    return;
  }

  if (platform === 'darwin') {
    const child = spawn('open', [url], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    return;
  }

  const child = spawn('xdg-open', [url], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

async function openCommand(code) {
  if (!code) {
    fail('Provide a short code.');
  }

  const response = await fetchJson(`/${encodeURIComponent(code)}`, {
    method: 'GET',
    redirect: 'manual',
  });

  if (response.status === 404) {
    fail('Unknown code.');
  }

  if (response.status < 300 || response.status > 399) {
    fail(`Expected redirect, got ${response.status}.`);
  }

  const target = response.headers.get('location');
  if (!target) {
    fail('Redirect target missing.');
  }

  try {
    openInBrowser(target);
  } catch {
    fail('Failed to open browser.');
  }

  console.log(target);
}

async function main() {
  const [, , command, ...args] = process.argv;

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    usage();
    return;
  }

  if (command === 'add') {
    await addCommand(args[0]);
    return;
  }

  if (command === 'ls') {
    await lsCommand();
    return;
  }

  if (command === 'open') {
    await openCommand(args[0]);
    return;
  }

  fail(`Unknown command: ${command}`);
}

main().catch((err) => fail(err && err.message ? err.message : 'Unexpected error'));
