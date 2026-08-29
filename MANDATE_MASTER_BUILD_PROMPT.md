# Master build prompt — *Mandate: Central Bank Tycoon*

Copy everything below into Codex or Claude Code. Treat this as a product specification and implementation request, not as a brainstorming prompt.

---

## Role and mission

You are a senior front-end game developer, macroeconomic simulation designer, and UX designer with strong static-site deployment experience.

Build a polished, deployable MVP of an English-language browser management game with the working title **Mandate: Central Bank Tycoon**. The player becomes the head of either the US Federal Reserve or the European Central Bank and must keep the economy stable through a finite mandate.

This must be a real playable game, not a non-interactive dashboard, a mock-up, or a collection of disconnected screens. Implement the full gameplay loop, deterministic economic simulation, difficulty levels, procedural events, failure states, scoring, local persistence, and local records.

The application must be **fully static and front-end only**. It must deploy as HTML, CSS, JavaScript, and static assets. Do not create a server, serverless function, database, login system, multiplayer feature, shared leaderboard, cloud save, external AI call, or application API.

If an existing repository is present, inspect and preserve its conventions unless they conflict with this specification. If the repository is empty, scaffold the project. Do not stop after writing a plan: build the application, run it, test it, and fix errors.

## Product objective

Create an accessible but deep central-bank strategy game that can be played free in a browser worldwide.

The game should have the immediate readability and feedback of a tycoon game, but the hard difficulty should reward genuinely advanced knowledge of monetary policy. The player should never have perfect information. Policy effects must arrive with lags, expectations must matter, data must sometimes be revised, and the same action must produce different results depending on the economic regime.

The MVP is **fictional/procedural only** and includes:

- Federal Reserve gameplay;
- European Central Bank gameplay;
- easy, medium, and hard difficulty levels;
- randomized but seeded economic scenarios and shocks;
- finite mandates, early failure conditions, final scores, local records, and shareable text summaries;
- a single discreet responsive banner-ad slot;
- English UI and content only.

Do **not** implement historical scenarios, live-news ingestion, generative-AI decisions, alternate-history free-text input, accounts, multiplayer, or global leaderboards in the MVP. Create clean local interfaces so curated static scenarios can be added later without rewriting the simulation core.

## Intellectual-property constraint

The visual mascot must be an original character: an eccentric, wealthy-looking central banker with a top hat, white moustache, formal suit, and expressive reactions. It may evoke the broad archetype of a nineteenth-century tycoon, but it must **not** reproduce Mr. Monopoly, Rich Uncle Pennybags, or any other protected character, pose, face, costume, logo, typography, or trade dress.

Create original vector/CSS/SVG artwork or clearly marked original placeholders. Do not download or embed copyrighted game assets.

## Core fantasy and screen composition

The player sits at the head of a grand central-bank policy table. The original moustached central-banker avatar is visible in the room and reacts to events: confident, worried, surprised, exhausted, or dismissed.

The main screen should feel like a polished tycoon control room rather than accounting software:

- the upper or central area shows the boardroom, avatar, date, current meeting, warnings, and incoming news;
- a clearly organized set of table buttons opens the information and policy panels;
- panels slide over or expand from the table without navigating away from the meeting;
- charts are animated but restrained and readable;
- important changes receive concise audiovisual feedback without excessive flashing;
- use a premium palette: dark walnut, brass, cream paper, deep green, burgundy, and restrained red/amber alert colors;
- use original serif display typography paired with a highly legible sans-serif UI font;
- desktop is the primary experience, but every action must remain usable on mobile through a stacked layout and bottom navigation.

Do not imitate an existing game's UI. Avoid a generic SaaS dashboard appearance.

## Main user journey

1. Landing page with title, short promise, **Play now**, **How to play**, local records, privacy, and credits/source links.
2. The player selects:
   - Federal Reserve or European Central Bank;
   - easy, medium, or hard;
   - a generated scenario seed or a random seed;
   - an optional locally stored player nickname.
3. Show a short, skippable briefing explaining the selected institution's mandate and the current fictional economy.
4. Enter the first policy meeting.
5. At every meeting, the player:
   - examines the information available at that difficulty level;
   - reads forecasts, staff reports, news, markets, and public reactions;
   - selects one or more available policy actions;
   - optionally chooses a communication strategy when that feature is unlocked;
   - reviews and confirms a policy package;
   - advances time and sees immediate reactions, while delayed effects remain uncertain.
6. Between meetings, events, revisions, leaks, financial accidents, political criticism, supply shocks, or positive surprises may occur.
7. The run ends when:
   - the playable mandate is completed;
   - the player is forced to resign/dismissed after a sustained collapse in institutional credibility;
   - a defined economic or financial catastrophe threshold is crossed.
8. Show a detailed post-mandate report, score breakdown, charts, key turning points, unlocked achievements, and comparison with the player's own local records.

## Turn cadence and mandate length

One turn represents one scheduled monetary-policy meeting. Emergency meetings may appear as event-driven bonus turns.

Use the following balanced fictional run lengths for both institutions so scores remain comparable within each institution/difficulty category:

- **Easy:** 8 scheduled meetings, representing a one-year training mandate;
- **Medium:** 16 scheduled meetings, representing a two-year mandate;
- **Hard:** 32 scheduled meetings, representing a four-year full game mandate.

Label these as gameplay mandates, not as claims about the legal term of a real-world office holder. Maintain separate local record tables for institution, difficulty, and simulation version.

## Institutional differences

The choice between the Fed and the ECB must materially change objectives, indicators, tools, events, and scoring.

### Federal Reserve

Model a dual-mandate framework:

- price stability;
- maximum sustainable employment;
- financial stability and institutional credibility as constraints;
- policy focus on a federal-funds target range and its implementation;
- US-specific variables such as PCE-style inflation, payroll/labor indicators, Treasury conditions, dollar strength, credit spreads, and regional banking stress.

### European Central Bank

Model a price-stability-first framework:

- a symmetric 2% medium-term inflation objective;
- support for growth and employment without overriding price stability;
- financial stability, monetary transmission, and institutional credibility as constraints;
- euro-area fragmentation and sovereign-spread risk;
- heterogeneous member-state conditions aggregated into euro-area indicators;
- ECB-specific rates, refinancing/liquidity tools, minimum reserves, asset-purchase tools, and communication.

Keep the content educational but explicitly describe the economy and institutional setting as a simplified fictional simulation, not an official Fed or ECB product.

## Information architecture inside a meeting

Provide table buttons or tabs for:

1. **Meeting Brief** — the five most important developments and unresolved questions.
2. **Prices** — headline/core inflation, monthly momentum, wages, expectations, import prices.
3. **Labor** — unemployment, employment growth, vacancies, participation, wage growth.
4. **Growth** — real growth, output gap estimate, consumption, investment, confidence.
5. **Financial Conditions** — yield curve, lending rates, credit spreads, equities, housing, exchange rate.
6. **Banking System** — liquidity, capital/stress proxy, deposit flight, lending standards.
7. **Market Expectations** — expected future policy path, inflation swaps/surveys, surprise index.
8. **Balance Sheet & Liquidity** — central-bank assets, reserves, purchases/runoff, liquidity facilities.
9. **Staff Forecasts** — fan charts and probability ranges, not false point certainty.
10. **Newswire** — fictional headlines tied to actual simulation events.
11. **Public Pulse** — trust, approval, social sentiment, and major criticisms.
12. **Policy Desk** — available instruments, settings, estimated channels, and risks.
13. **Communications** — statement, forward guidance, press conference, speech, and official social post when unlocked.
14. **Mandate & Score** — objectives, warnings, current provisional assessment, and remaining meetings.

The user must be able to compare recent values and trends quickly. Every indicator needs:

- unit and definition;
- latest published value;
- previous/revised value when relevant;
- small trend chart;
- uncertainty or confidence marker when relevant;
- plain-English tooltip;
- release lag/source category within the fictional world.

## Imperfect information

Maintain two layers of state:

1. a **latent true economic state**, used by the simulation;
2. an **observed information set**, shown to the player.

Never leak latent state through the client UI or debug text in production.

Observed data should include difficulty-dependent noise, publication lags, forecast uncertainty, missing observations, and later revisions. Hard mode should force the player to infer the regime rather than merely react to a perfectly visible state.

Use seeded randomness so a complete run can be reproduced from its simulation version, seed, institution, difficulty, and ordered list of player decisions.

## Difficulty design

Difficulty must change the decision problem, not merely multiply damage.

### Easy

- 8 meetings;
- policy rate is the main direct instrument;
- simple hold/raise/cut choices in clear increments;
- mostly accurate and timely headline indicators;
- mild shocks and shorter/clearer policy lags;
- visible tutorial explanations and estimated direction of effects;
- forgiving credibility and catastrophe thresholds;
- automatic implementation details;
- no complex communications package required.

### Medium

- 16 meetings;
- policy rate plus QE/QT, reserve requirement/liquidity settings, and basic forward guidance;
- moderate reporting noise, revisions, and forecast ranges;
- multiple simultaneous shocks;
- more realistic lag structures and market anticipation;
- communication consistency affects credibility;
- fewer explicit hints.

### Hard

- 32 meetings;
- the complete institution-specific policy toolkit;
- noisy, lagged, revised, and occasionally contradictory information;
- endogenous expectations, nonlinear effects, regime changes, and tail risks;
- market front-running and surprise effects;
- banking stress, asset-price imbalances, fiscal interactions, exchange-rate effects, ECB fragmentation risk, and political pressure;
- full communications system;
- severe but fair shocks with warning signals;
- no single guaranteed optimal rule;
- a stricter credibility system and realistic policy trade-offs.

Hard mode should be difficult for a beginner but legible to someone with advanced knowledge of monetary economics.

## Policy toolkit

Represent tools with institution-specific names and availability. Put all instrument definitions in configuration/content files rather than hard-coding them into UI components.

Potential tools include:

- policy-rate target/range;
- administered rates and the operating corridor/floor where appropriate;
- asset purchases and sales;
- reinvestment or balance-sheet runoff pace;
- reserve requirements where institutionally relevant;
- refinancing operations and standing facilities;
- discount/emergency liquidity facilities;
- repo/reverse-repo style operations where appropriate;
- liquidity swap or backstop measures during eligible crises;
- targeted liquidity operations for the ECB where appropriate;
- forward guidance;
- policy statement wording;
- press-conference stance;
- speeches and official public/social messaging.

Do not imply that every tool is equally active or freely adjustable in current real-world practice. The game is fictional, but descriptions must explain the institutional context and implementation channel.

Every action must show:

- the chosen magnitude;
- likely transmission channels;
- implementation cost or constraint;
- expected time lag as a range;
- key upside and downside risks;
- whether markets have already priced it in.

The confirmation screen must display the entire policy package and detect internally contradictory combinations.

## Communication gameplay

Do not use an LLM, generative-AI model, remote inference endpoint, or AI API. Build all communication and narrative reactions from structured local choices, deterministic rules, weighted templates, and seeded variation so the game remains free, fast, reproducible, and fully static.

Allow the player to choose:

- tone: hawkish, neutral, dovish, reassuring, or alarmed;
- emphasis: inflation, employment, growth, financial stability, uncertainty, or data dependence;
- commitment strength: no guidance, weak bias, conditional path, or strong commitment;
- channel: official statement, press conference, speech, or short official social post, depending on difficulty.

Generate concise English copy locally from composable templates. Markets and the public should react through the simulation engine to the message's content, surprise, credibility, and consistency with both the policy action and earlier guidance. Contradicting previous strong guidance should impose a credibility cost unless justified by a sufficiently large shock. Provide enough template fragments and conditional variants that repeated runs do not feel mechanically identical.

## Economic simulation engine

Build the simulation as an isolated, framework-independent TypeScript module with no React imports and no network dependencies.

Use a simplified semi-structural state-space model inspired by:

- an expectations-augmented Phillips curve;
- an IS/output-gap relationship;
- Okun-style unemployment dynamics;
- a monetary-policy transmission lag;
- adaptive/partly anchored inflation expectations;
- a Taylor-rule benchmark used only for comparison, never as an automatic optimal answer;
- credit and financial-accelerator effects;
- exchange-rate and imported-inflation channels;
- institution-specific modifiers;
- stochastic supply, demand, financial, productivity, fiscal, geopolitical, and confidence shocks.

At minimum, maintain latent variables for:

- headline and core inflation;
- expected inflation and anchoring;
- output gap and potential growth;
- unemployment and employment momentum;
- wage growth;
- neutral real rate estimate;
- policy stance and real policy rate;
- exchange rate;
- credit growth and spreads;
- housing/asset-price pressure;
- banking-system stress;
- central-bank balance sheet and reserves/liquidity;
- fiscal impulse/debt pressure;
- ECB fragmentation or Fed regional-bank stress;
- market volatility;
- institutional credibility;
- public trust/political pressure.

### Engine requirements

- Store coefficients, bounds, thresholds, shock distributions, instrument effects, and difficulty modifiers in typed configuration files.
- Advance the state in smaller internal time steps between policy meetings so lags do not behave like instantaneous turn bonuses.
- Clamp physically impossible values but do not silently hide instability; record diagnostic events.
- Support positive and negative shocks.
- Make policy effects state-dependent: QE during market dysfunction should differ from QE during an asset bubble, for example.
- Separate `advanceTrueState`, `generateObservation`, `applyPolicyPackage`, `resolveEvent`, `calculateScore`, and `evaluateEndConditions`.
- Version the engine with a `SIMULATION_VERSION` constant.
- Provide deterministic replay and a compact serialized decision log.
- Include developer-only tooling to run thousands of seeded simulations and identify impossible, trivial, or unwinnable balance configurations.
- Keep latent variables out of the normal player UI and production logs. Because this is an open static client, coefficients and local scores are inspectable and potentially editable by advanced users; do not claim that local records are tamper-proof or globally competitive.

## Procedural events

Create a typed event system with conditions, probability weights, visible clues, immediate effects, delayed effects, and follow-up branches.

Include at least 30 varied fictional event templates across:

- energy/commodity shocks;
- productivity surprises;
- supply-chain disruptions;
- fiscal expansions or austerity;
- banking scares and liquidity runs;
- housing booms/busts;
- geopolitical risk;
- exchange-rate pressure;
- wage negotiations;
- data revisions;
- leaks or communication mistakes;
- market bubbles/crashes;
- natural disasters;
- positive innovation and confidence shocks.

Events must interact with the current economy. Do not present choices whose outcomes are pre-scripted independently of state. Avoid direct copies of real people, companies, or current breaking-news claims in the fictional MVP.

## Failure states and warnings

Use configurable, difficulty-dependent thresholds and give warning states before most failures.

Possible catastrophe families:

- runaway inflation or deflation spiral;
- depression-level output/employment collapse;
- systemic banking crisis;
- disorderly sovereign-fragmentation crisis for the ECB;
- currency/market dysfunction;
- loss of monetary control.

Dismissal/forced resignation must require a sustained collapse in credibility or institutional legitimacy, not one unpopular decision. Track separate credibility, public trust, market trust, and political pressure variables.

The exact end-state logic must be visible in the postmortem, with the causal sequence explained. Do not falsely claim that one player action alone caused a complex crisis when several factors contributed.

## Scoring and local records

Create a score from 0 to 10,000 using a documented, versioned formula.

Score over the entire path, not only the final turn. Components should include:

- price-stability performance;
- employment/output performance with institution-specific weights;
- financial-stability performance;
- expectations anchoring;
- credibility and communication consistency;
- survival/completion bonus;
- avoidance of unnecessary policy volatility;
- response quality to large shocks;
- a modest difficulty multiplier.

For the Fed, price stability and maximum sustainable employment should receive substantial coequal gameplay weight. For the ECB, price stability receives the primary weight, while output/employment cannot compensate for a major persistent failure on inflation.

Show the component breakdown after the run, but do not expose hidden future shocks or the full latent-state equations during play.

Local-record requirements:

- store completed runs locally using a versioned persistence schema;
- separate records by institution, difficulty, and `SIMULATION_VERSION`;
- display nickname, score, mandate outcome, seed, and completion date only on the player's device;
- show personal best, recent runs, average score, and best completed mandate;
- allow the player to delete all local data;
- allow export/import of a small JSON save file with strict validation;
- provide **Copy result** to create a shareable plain-text summary containing no personal data;
- provide a challenge link or copyable challenge code containing only institution, difficulty, simulation version, and seed;
- allow deterministic replay from a locally saved decision log;
- clearly label records as local and unverified;
- do not implement accounts, public submissions, online rankings, moderation, or any database.

## Post-run learning and retention

The final report should include:

- final score and comparison with personal local records;
- mandate outcome;
- time-series charts for the key indicators;
- three best decisions and three costly decisions, based on counterfactual local analysis where feasible;
- key shocks and revisions;
- credibility timeline;
- policy-rate and balance-sheet paths;
- comparison with a simple Taylor-rule benchmark, clearly labeled as a benchmark rather than the uniquely correct policy;
- short explanations of the main transmission mechanisms;
- achievements and a **Replay same seed** button;
- a **New random economy** button.

Add optional contextual tooltips and a glossary. Easy mode may explain more during the run; hard mode should reserve most causal analysis for the postmortem.

## Advertising and monetization

Implement exactly one reusable responsive `AdBanner` component in the MVP.

- Place it outside the core game controls, preferably below the game shell on desktop and in a reserved footer area on mobile.
- Reserve its layout space to prevent cumulative layout shift.
- Keep a clear visual and interaction distance from policy buttons.
- Never cover the game, interrupt a meeting, mimic a game control, or reward ad clicks.
- In development and preview environments, render a labeled non-clickable placeholder only.
- Load a real ad provider only when production environment variables are present and the required consent state permits it.
- Do not hard-code publisher IDs or use real ads in automated tests.
- Add configuration placeholders for an approved AdSense/H5-compatible implementation, but do not claim the site will automatically be accepted or earn revenue.
- Provide `Privacy`, `Cookie settings`, and `Terms` pages, plus a consent-management integration point.
- Where consent is legally required, do not set non-essential advertising cookies or load personalized advertising before valid consent; support a non-personalized/contextual fallback when the chosen provider supports it.
- Add an `ads.txt` placeholder/instruction and a written production checklist.

The application must remain fully playable if advertising is blocked or consent is refused.

## Recommended technical architecture

Use a maintainable, low-cost web stack suitable for Codex or Claude Code:

- React + TypeScript with strict mode;
- Vite unless the existing repository already has an appropriate framework;
- Tailwind CSS or an equivalent token-based styling system;
- React Router for public/game routes;
- Recharts or another lightweight accessible chart library;
- `localStorage` for settings and small records, with IndexedDB only if replay/save volume requires it;
- Zod or equivalent runtime validation for imported saves, URL challenge parameters, and persisted local data;
- a deterministic seeded PRNG whose implementation is covered by tests;
- Vitest for unit/integration tests;
- Playwright for critical end-to-end flows;
- ESLint and formatting configuration;
- a Vite production build that emits only static files to `dist/`;
- deployment on Cloudflare Pages connected directly to a GitHub repository.

Do not require any application backend, database, paid API, generative-AI API, proprietary news feed, or paid asset library. Other than optional consented advertising/analytics scripts, gameplay must make no network request after the static assets have loaded.

### Static deployment workflow

Configure and document this exact low-maintenance workflow:

1. the complete source code lives in a GitHub repository;
2. Cloudflare Pages is connected to that repository through its Git integration;
3. every push to the production branch triggers `npm ci` and `npm run build`;
4. Cloudflare Pages publishes the generated `dist/` directory worldwide;
5. preview deployments are created for non-production branches when supported;
6. no Worker, serverless function, database, container, or manually administered server is required;
7. an optional custom domain can be attached later without changing the app architecture.

Add the static-host fallback required for client-side routes, such as a Cloudflare Pages `_redirects` file that rewrites unmatched routes to `index.html`. Ensure asset paths work in local development, preview deployments, and production. Include a GitHub Actions workflow only if it adds useful automated tests; do not use GitHub Actions as an unnecessary application backend.

All values embedded through Vite client environment variables are public. Never describe them as secrets. Ad publisher identifiers may be configurable public values; private API keys must not exist because the static MVP must not call private APIs.

Suggested source structure:

```text
src/
  app/
  components/
  features/game/
  features/policy/
  features/briefing/
  features/records/
  features/ads/
  simulation/
    config/
    engine/
    events/
    observation/
    scoring/
    replay/
  content/
    institutions/
    glossary/
    events/
  services/
  persistence/
  styles/
  test/
public/
  _redirects
docs/
```

Keep content, visual components, persistence, and simulation logic cleanly separated.

## Future-mode extension points

Define typed interfaces now, but do not build these modes:

```ts
type GameMode = "fictional" | "historical" | "alternate_history";

interface ScenarioProvider {
  getScenarioMetadata(): ScenarioMetadata;
  createInitialState(seed: string): InitialSimulationState;
  getEligibleEvents(context: ScenarioContext): GameEvent[];
}

interface ObservationProvider {
  getObservation(state: LatentState, context: ObservationContext): ObservationSet;
}
```

Future roadmap:

1. curated historical scenarios with source citations and information sets limited to what was known at the time;
2. a fully local alternate-history mode in which policy and procedural events produce emergent paths without free-text AI;
3. daily challenge seeds derived locally from the UTC date, clearly labeled as unverified personal challenges rather than global competitions;
4. more central banks and languages;
5. only in a separate future architecture: a live-economy mode using reliable APIs and a maintained data service. Do not scaffold or call that service in this static MVP.

Never scrape arbitrary news or use an LLM to convert current events into authoritative economic facts.

## Accessibility, privacy, and security

- Meet WCAG 2.2 AA where practical.
- Full keyboard navigation and visible focus states.
- Do not rely on color alone.
- Respect reduced-motion preferences.
- Charts need text summaries or accessible labels.
- Responsive design from 360 px mobile width upward.
- Sanitize locally entered nicknames before display and export.
- No secrets or private credentials anywhere in the repository or client bundle.
- Validate all URL parameters, imported saves, and persisted data before use.
- Use minimal analytics by default and make optional analytics consent-aware.
- Collect no account information or gameplay data on an application server.
- Provide a one-click **Delete local data** control and document exactly what is stored in the browser.
- Add a clear disclaimer that this is an educational fictional game, not investment advice and not affiliated with the Fed or ECB.

## Content and factual grounding

Use official institutional sources as the factual baseline for mandates, meeting cadence, and policy-tool descriptions. Include a Credits & Sources page linking to, at minimum:

- [Federal Reserve monetary-policy overview and dual mandate](https://www.federalreserve.gov/aboutthefed/fedexplained/monetary-policy.htm);
- [Federal Reserve FOMC meeting calendar and information](https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm);
- [Federal Reserve policy-tools overview](https://www.federalreserve.gov/monetarypolicy/policytools.htm);
- [ECB monetary-policy introduction and 2% medium-term target](https://www.ecb.europa.eu/mopo/intro/html/index.en.html);
- [ECB monetary-policy operations and instruments](https://www.ecb.europa.eu/mopo/implement/html/index.en.html);
- [ECB Governing Council decision cadence](https://www.ecb.europa.eu/ecb/decisions/govc/html/index.en.html).

All fictional news and scenario data must be labeled fictional. Do not use current office-holder likenesses or names.

## Required routes/screens

- `/` — landing page;
- `/play/setup` — institution, difficulty, seed, display name;
- `/play/briefing` — initial mandate and scenario briefing;
- `/play/meeting/:turn` — main boardroom and decision loop;
- `/play/result/:runId` — postmortem and score;
- `/records` — local personal bests, recent runs, and data controls;
- `/how-to-play` — concise tutorial and difficulty comparison;
- `/glossary` — searchable monetary-policy concepts;
- `/sources` — official references and simulation disclaimer;
- `/privacy`, `/terms`, and `/cookie-settings`;
- a friendly 404 page.

## Minimum content volume

The MVP is not complete unless it contains:

- 2 materially different institutions;
- 3 difficulty levels;
- at least 30 procedural event templates;
- at least 12 core observable indicator series;
- at least 10 policy/communication actions across the full hard-mode toolkit, with institution-specific availability;
- at least 20 contextual glossary entries;
- at least 10 achievements;
- full English copy for landing, tutorial, game, results, privacy placeholders, and source credits;
- enough seeded balance testing to show that each difficulty can be won and lost.

## Testing requirements

Write tests before declaring completion.

### Simulation tests

- identical seed + version + institution + difficulty + decisions gives identical output;
- different seeds produce meaningfully different paths;
- inflation responds to sustained stance with a lag, not instantly;
- demand and supply shocks behave differently;
- expectations react to communication credibility;
- data observations can differ from latent state and later be revised;
- all variables stay within documented computational safety bounds;
- all end conditions trigger correctly;
- scoring buckets and version separation work;
- every policy action is rejected when unavailable or outside bounds.

### Static persistence and validation tests

- malformed or incompatible imported saves are rejected safely;
- corrupt persisted data falls back gracefully without crashing the game;
- local record buckets remain separated by institution, difficulty, and simulation version;
- challenge URLs/codes reproduce the same initial run and reject invalid parameters;
- deleting local data removes saves, records, nickname, achievements, and consent-independent game preferences as documented;
- no application API, database client, authentication library, or server runtime is bundled.

### End-to-end tests

- a player can start and complete an easy Fed run without an account;
- a player can start and complete an easy ECB run without an account;
- a losing run reaches the correct result screen;
- refresh/reload restores an in-progress local run;
- the app works with all network requests blocked after its static assets have loaded, except that ads may remain empty;
- the app works when ads are blocked or consent is refused;
- keyboard-only play can complete one meeting;
- the mobile viewport exposes every required control.

## Performance and quality bar

- Fast initial load and lazy-load heavy game/chart code.
- Avoid large raster assets.
- No console errors or unhandled promise rejections.
- No placeholder buttons that do nothing.
- No lorem ipsum.
- No false claim that live data or real ads are active.
- Clear empty, loading, offline, and error states.
- Save an in-progress game locally after every confirmed meeting.
- Use polished microcopy and consistent design tokens.

## Deliverables

Produce:

1. the complete working source code;
2. the versioned local persistence, import/export, replay, records, and challenge-code implementation;
3. `.env.example` only for optional public build-time values such as ad configuration, with an explicit warning that Vite client variables are not secret;
4. a detailed `README.md` covering local setup, tests, GitHub workflow, Cloudflare Pages deployment, custom-domain option, and production-ad setup;
5. `docs/SIMULATION.md` explaining equations, coefficients, lags, uncertainty, scoring, and simplifications;
6. `docs/CONTENT_GUIDE.md` explaining how to add institutions, events, tools, glossary entries, and future scenario providers;
7. `docs/PRODUCTION_CHECKLIST.md` covering accessibility, local-data privacy, consent, ad-provider approval, `ads.txt`, domain, static deployment, and export backups;
8. unit, integration, and end-to-end tests;
9. a short architecture decision record explaining the main choices;
10. a production build that completes successfully and a Cloudflare Pages configuration that can deploy it directly from GitHub.

## Implementation sequence

Work in this order:

1. inspect/scaffold the repository and write a short execution plan;
2. define domain types, institution configurations, difficulty configurations, and simulation versioning;
3. implement and test the deterministic engine, observation layer, policy effects, event system, scoring, and replays;
4. build the setup, briefing, meeting, and result flows using temporary minimal styling;
5. implement versioned browser persistence, local records, save import/export, and challenge codes;
6. create the original tycoon-room visual system and responsive interface;
7. add tutorial, glossary, achievements, source credits, legal placeholders, and the ad component;
8. run balancing simulations and tune configuration rather than scattering magic constants;
9. configure static routing and GitHub-to-Cloudflare-Pages deployment, then run lint, type-checking, unit tests, end-to-end tests, and a production build;
10. fix failures and provide a concise completion report with commands, architecture, known limitations, and the next three best improvements.

When a product decision is unspecified, choose the simplest robust implementation that preserves the simulation depth and future extension points. Do not ask for cosmetic preferences unless genuinely blocked.

## Acceptance criteria

The work is accepted only if all of the following are true:

- a new user can understand the objective and start playing without reading external documentation;
- a full easy run is playable from start to result in the browser;
- medium and hard modes unlock meaningfully more information problems and policy tools;
- Fed and ECB runs require different priorities and strategies;
- latent and observed economic states are distinct;
- decisions produce delayed, state-dependent, reproducible consequences;
- at least 30 procedural events work;
- failure, mandate completion, scoring, replay, and persistence work;
- local records, save import/export, shareable summaries, and seeded challenge codes work without any backend;
- the built application contains no account, database, multiplayer, serverless, global-leaderboard, live-data, or AI-API dependency;
- pushing the repository to GitHub can trigger a working static deployment on Cloudflare Pages;
- the single banner ad area is unobtrusive and the game works without it;
- the avatar and visual identity are original;
- the UI is English-only, responsive, keyboard-usable, and polished;
- tests and the production build pass;
- the repository contains no secrets, copied proprietary assets, fake live-data claims, or claim that local scores are globally verified.

Begin by inspecting the repository, then implement the MVP.
