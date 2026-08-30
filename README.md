# Mandate: Central Bank Tycoon

**Live site:** https://mandate-central-bank-tycoon.comegorgeon.workers.dev

Static, front-end-only browser game (React + TypeScript + Vite).

Current state: a complete game loop is playable end to end, on minimal styling.
One path is implemented — Federal Reserve, easy, eight meetings, the policy rate
as the only instrument, and four panels (Meeting Brief, Prices, Labor, Policy
Desk). The ECB, the medium and hard difficulties, the rest of the toolkit,
communications, persistence, local records and the visual identity are not
built yet.

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
| `npm run sim:demo` | Play 8 seeded meetings and print the paths      |
| `npm run sim:sweep`| Play 900 seeded runs and report balance         |
| `npm run deploy`   | Build and deploy to Cloudflare Workers          |

## Verification

Before a task counts as finished: `npm run build` passes, `npm test` is green,
and there are no errors in the browser console.

`src/pages/gameLoop.test.tsx` plays a whole mandate through the interface with
no direct engine calls, and `src/pages/consoleCheck.test.tsx` opens every panel
at every meeting and asserts the run logs no `console.error` and no
`console.warn`.

> **Deferred: the real browser console.** That last check runs in jsdom, which
> catches React and router warnings but is not a browser engine. A pass in a
> real browser is deliberately postponed until the screens stabilise — the
> current build is intentionally unstyled and the surfaces are still moving.
> **Run it at the end of the session that stabilises the screens**, before the
> visual system is called done: `npm run dev`, play a full mandate, and read the
> console.

## Stack

- Vite + React + TypeScript (strict mode)
- Tailwind CSS
- React Router
- ESLint
- Vitest + Testing Library
- Wrangler (Cloudflare Workers static assets)

## Simulation engine

`src/simulation/` holds the economic model. It is framework-independent by
contract: nothing under it imports React, touches the DOM, or makes a network
call, and its tests run in the `node` environment so that stays true. The
interface layer talks to it only through `src/simulation/index.ts`.

Two layers of state exist. The latent true economy is what the engine runs on;
the observed information set is what a player is shown, after publication lags,
measurement noise, missing releases and later revisions. Latent values never
reach the interface.

All coefficients, bounds, thresholds, shock distributions, instrument
definitions and difficulty modifiers live in `src/simulation/config/`.
Balancing means editing configuration, never engine code.

`npm run sim:demo` and `npm run sim:sweep` are developer tooling. They print
latent state and are never imported by application code.

> **Calibration: one of four points landed.** The design direction in
> [`docs/BALANCE.md`](docs/BALANCE.md) is to judge a policy lag by its ratio to
> the mandate it sits in — the number of decision → effect → correction loops a
> player can close before the mandate ends — rather than by its length.
>
> Point 1 is done: `43bfca3` retargeted `LAG_KERNEL`, taking easy from 1.8
> closed loops to 3.2 and holding all three difficulties near three to four.
> The remaining three are open, and the first two are UI work the current
> minimal build does not yet do: surfacing the engine's existing fast channel
> (markets, press, institutional standing, which respond within the turn) as
> turn-by-turn feedback; making fan charts that deform immediately on a policy
> change a primary screen, which is what makes a long lag playable; and an
> end-of-mandate legacy evaluation that advances the simulation with no player
> input and folds the result into the score.
>
> The numbers still get set against real playthroughs. `docs/BALANCE.md` holds
> the checklist, which leads with counting the closed loops.

## Deployment

**Every push to `main` automatically redeploys the live site** via Cloudflare
Workers' Git integration — Cloudflare builds and deploys on its own; no manual
step is needed after pushing.

The app builds to a fully static `dist/` directory and deploys as a Cloudflare
Workers static-assets site (Cloudflare's Pages onboarding flow has been replaced by
the Workers flow).

`wrangler.toml` configures the Worker:

- `name = "mandate-central-bank-tycoon"` — the Worker's name on Cloudflare.
- `[assets] directory = "./dist"` — serves the Vite build output as static assets.
- `not_found_handling = "single-page-application"` — unmatched routes fall back to
  `index.html` so React Router routes work correctly (client-side routing).

There is no custom Worker script: this is a static-assets-only Worker.

There is no `public/_redirects` file — that was a Cloudflare Pages-only mechanism
and conflicts with `not_found_handling` (Cloudflare's Workers deployment rejects it
with an "infinite loop" error, since both try to handle the same fallback routing).
SPA routing is handled solely by `not_found_handling` in `wrangler.toml`.

The steps below (`npm run deploy`) are only needed for a manual, ad hoc deploy from
your machine — they are not part of the normal workflow.

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

