# Mandate: Central Bank Tycoon

Static, front-end-only browser game (React + TypeScript + Vite). Current state: technical
skeleton only (Build 0) — no gameplay yet.

## Requirements

- Node.js and npm (see `node -v` / `npm -v`)

## Setup

```bash
npm install
```

## Commands

| Command           | Description                                  |
| ------------------ | --------------------------------------------- |
| `npm run dev`      | Start the local dev server with hot reload     |
| `npm run build`    | Type-check and build the static site to `dist/` |
| `npm run preview`  | Preview the production build locally           |
| `npm run lint`     | Run ESLint                                     |
| `npm test`         | Run the test suite (Vitest)                    |
| `npm run deploy`   | Build and deploy to Cloudflare Workers          |

## Stack

- Vite + React + TypeScript (strict mode)
- Tailwind CSS
- React Router
- ESLint
- Vitest + Testing Library
- Wrangler (Cloudflare Workers static assets)

## Deployment

The app builds to a fully static `dist/` directory and deploys as a Cloudflare
Workers static-assets site (Cloudflare's Pages onboarding flow has been replaced by
the Workers flow).

`wrangler.toml` configures the Worker:

- `name = "mandate-central-bank-tycoon"` — the Worker's name on Cloudflare.
- `[assets] directory = "./dist"` — serves the Vite build output as static assets.
- `not_found_handling = "single-page-application"` — unmatched routes fall back to
  `index.html` so React Router routes work correctly (client-side routing).

There is no custom Worker script: this is a static-assets-only Worker.

### One-time setup

```bash
npx wrangler login
```

This opens a browser window to authorize Wrangler against your Cloudflare account.

### Deploy

```bash
npm run deploy
```

This runs `npm run build` and then `npx wrangler deploy`, which uploads the contents
of `dist/` to Cloudflare and prints the live `*.workers.dev` URL.

`public/_redirects` is no longer used for routing (that was the Cloudflare Pages
mechanism); SPA routing is now handled by `not_found_handling` in `wrangler.toml`.
