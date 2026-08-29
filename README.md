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

## Stack

- Vite + React + TypeScript (strict mode)
- Tailwind CSS
- React Router
- ESLint
- Vitest + Testing Library

## Deployment

The app builds to a fully static `dist/` directory and is designed to be deployed on
Cloudflare Pages connected to this repository's GitHub remote. `public/_redirects`
rewrites unmatched client-side routes to `index.html` so React Router works on
Cloudflare Pages.
