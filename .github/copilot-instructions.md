# Agent Rules For Snip (Keep In Sync)

Keep this file and `CLAUDE.md` in sync.

## What this repo is

This repo is a superproject on `main` with one layer per branch mounted as submodules.

## Layout and stack

| Path | Source branch | Stack | Notes |
|---|---|---|---|
| `backend/` | `backend` | Bun, single-file API (`server.js`) | In-memory storage (`Map`) |
| `frontend/` | `frontend` | Angular 19 | Build output path is load-bearing |
| `cli/` | `cli` | Node CommonJS CLI (`cli.js`) | Must stay CommonJS |
| `bundle/` | `bundle` | Generated release artifact | Output only, never hand-edit |
| `scripts/build-bundle.mjs` | `main` | Node script (zero deps) | Regenerates `bundle/` |

## API contract (change everywhere or nowhere)

- `POST /api/links` with `{ "url": "https://..." }` -> `201` `{ code, url, shortUrl, hits, createdAt }` or `400` `{ error }`
- `GET /api/links` -> `200` array of links
- `GET /:code` -> `302` redirect (+1 hit) or `404`

If you change this contract, update backend, frontend, CLI, docs, and tests in one coordinated change.

## Key commands

- Clone with submodules: `git clone --recurse-submodules <REPO_URL>`
- Populate after plain clone: `git submodule update --init --recursive`
- Run backend: `cd backend && bun start`
- Run frontend: `cd frontend && npm install && npx ng serve`
- Run CLI: `cd cli && node cli.js ls`
- Rebuild bundle: `node scripts/build-bundle.mjs`
- Rebuild and push bundle + pointer bumps: `node scripts/build-bundle.mjs --push`

## Edit -> push -> pointer-bump workflow

1. Make and push changes inside the relevant submodule folder.
2. Return to `main` superproject.
3. Run `git submodule update --remote <path>`.
4. Commit the submodule pointer bump on `main` and push.

## Do and Don't

Do:
- Treat `main` as pinned snapshots via gitlinks.
- Keep generated bundle automation idempotent (safe no-op when unchanged).
- Use `HEAD:bundle` pushes from `bundle/` when detached.

Don't:
- Do not hand-edit files in `bundle/`; regenerate from `main` script.
- Do not convert `cli/cli.js` to ESM and do not add `"type":"module"` near it.
- Do not change Angular output assumptions: bundle build expects `frontend/dist/snip-frontend/browser/index.html`.
- Do not treat backend storage as persistent; it is in-memory by design.
- Do not add push triggers to bundle CI; it is schedule + manual by design.
- Do not confuse Docker CI path filter semantics: `bundle` in workflow paths is the submodule gitlink pointer on `main`, not files inside `bundle/`.
