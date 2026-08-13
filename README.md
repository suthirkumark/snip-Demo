# Snip Backend

Tiny Bun backend for a URL shortener.

## Run

- `bun start`

## API

- `POST /api/links` with `{ "url": "https://example.com" }`
- `GET /api/links`
- `GET /:code` (redirects)

## Environment

- `PORT` (default `3000`)
- `BASE_URL` (origin for short URLs)
- `RAILWAY_PUBLIC_DOMAIN` (fallback when `BASE_URL` is unset)
- `PUBLIC_DIR` (optional static files folder)