# Snip Superproject

Snip uses one backend with two different clients:

- backend: Bun API server
- frontend: Angular web app
- cli: Node terminal client

This `main` branch is a superproject that mounts each layer as a git submodule.

## Branch-per-layer layout

Each submodule tracks one branch from the same repository:

- `backend/` -> `backend` branch
- `frontend/` -> `frontend` branch
- `cli/` -> `cli` branch

## API contract

| Method | Path | Body | Response |
|---|---|---|---|
| `POST` | `/api/links` | `{ "url": "https://..." }` | `201` `{ code, url, shortUrl, hits, createdAt }` or `400` `{ error }` |
| `GET` | `/api/links` | - | `200` array of links |
| `GET` | `/:code` | - | `302` redirect to original URL (+1 hit), `404` when unknown |

## Clone with submodules

Use recurse when cloning, otherwise submodule folders are empty:

```bash
git clone --recurse-submodules <REPO_URL>
```

If you already cloned without recurse:

```bash
git submodule update --init --recursive
```

## Run all pieces

From the `main` checkout, run in separate terminals:

```bash
cd backend
bun start
```

```bash
cd frontend
npm install
npx ng serve
```

```bash
cd cli
node cli.js ls
```

## Update workflow

After changing one layer (example: backend):

```bash
cd backend
git add -A
git commit -m "..."
git push
```

Then bump the submodule pointer in the superproject:

```bash
cd ..
git submodule update --remote backend
git add backend
git commit -m "Bump backend submodule"
git push
```
