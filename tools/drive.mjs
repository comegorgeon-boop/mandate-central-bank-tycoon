/**
 * The shared driver: how to actually play this game in a browser.
 *
 * Every tool in this directory needs the same thing — get a real mandate open,
 * walk it to a given meeting, visit every screen — and each of the three that
 * came before reimplemented it slightly differently. That is not a style
 * complaint. The contrast audit has now had *three* blind spots and the pattern
 * was identical every time: **a screen it never visited cannot have failed.**
 * One of them clicked past the between-meetings panels before measuring; one
 * only ever played easy; one read `locator.count()` on the same tick as a React
 * re-render, got 0, concluded the mandate had ended and reported ALL CLEAR over
 * six unvisited screens.
 *
 * So navigation lives here, once, and the rules it learned are enforced for
 * every caller:
 *
 * - **Never read a count to decide whether a screen exists.** Wait for a
 *   selector. `waitForSelector` retries; `count()` does not.
 * - **Never click past a transient panel without giving the caller a chance to
 *   see it.** The interval player and the reaction screen are screens.
 * - **Say what was visited.** Every walk returns its itinerary, because the
 *   only thing that distinguishes a pass from an absence is the list of states
 *   actually reached.
 */

import { chromium } from 'playwright'

export const PANELS = [
  'press',
  'brief',
  'markets',
  'prices',
  'labor',
  'area',
  'treasury',
  'desk',
]

export const DIRECTIONS = ['after-hours', 'papers-on-the-table']

export const VIEWPORTS = {
  phone: { width: 390, height: 844 },
  desktop: { width: 1280, height: 900 },
}

/** Where `npm run preview` serves the built bundle. */
export const BASE_URL = process.env.MANDATE_URL ?? 'http://localhost:4173'

/**
 * Open a browser context with the settings pre-seeded.
 *
 * The direction and the interval setting are written into `localStorage`
 * before the first paint rather than clicked in the settings panel, for two
 * reasons: clicking is slow across forty screens, and a tool that drove the
 * settings panel would be unable to screenshot the settings panel in a known
 * state.
 */
export async function open({
  direction = 'after-hours',
  viewport = VIEWPORTS.desktop,
  playTheInterval = true,
  reducedMotion = 'no-preference',
  settleAnimations = true,
  /**
   * Rendering scale. Below 1 downsamples, which the screenshot board uses to
   * keep a committed set of several hundred full-page captures to a sane size.
   * The contrast audit never touches it: a measurement taken at half scale
   * would be measuring a different rasterisation than the player sees.
   */
  deviceScaleFactor = 1,
  /**
   * A finished mandate to pre-seed into this browser's records.
   *
   * Pass one to reach the result screen's "against yourself" comparison, which
   * only exists for a device that has finished a mandate of the same kind
   * before. See the init script below.
   */
  priorRecord = null,
} = {}) {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport, reducedMotion, deviceScaleFactor })

  /**
   * Run every animation and transition to its end immediately.
   *
   * Not cosmetic. Panels in this interface enter with `animate-rise`, which
   * starts at opacity 0, and both tools were reading the screen mid-flight:
   * the board photographed a doctrine's argument at about a third opacity and
   * the contrast audit measured the *declared* colour of text that was being
   * painted at a fraction of it. A screen is judged by what it looks like when
   * it has arrived.
   *
   * `prefers-reduced-motion` is not used for this, deliberately: the app
   * honours that by skipping the between-meetings interval entirely, and a
   * tool whose motion setting removed one of the screens it exists to check
   * would be the fourth entry in this project's list of audits that reported
   * clean over something they never saw.
   */
  if (settleAnimations) {
    await context.addInitScript(() => {
      const style = document.createElement('style')
      style.textContent =
        '*, *::before, *::after {' +
        ' animation-duration: 1ms !important;' +
        ' animation-delay: 0s !important;' +
        ' animation-iteration-count: 1 !important;' +
        ' transition-duration: 1ms !important;' +
        ' transition-delay: 0s !important; }'
      const attach = () => document.head.appendChild(style)
      if (document.head) attach()
      else document.addEventListener('DOMContentLoaded', attach)
    })
  }
  await context.addInitScript(
    ([dir, play, priorRecord]) => {
      try {
        window.localStorage.setItem(
          'mandate.settings.v1',
          JSON.stringify({ direction: dir, playTheInterval: play }),
        )
        // A mandate this device has already played, when the caller asks for
        // one. The result screen compares a finished run against the player's
        // own best in the same bucket, and on a fresh profile there is nothing
        // to compare against — so the only branch a tool ever reached was the
        // "your first mandate" one, and the comparison itself was a screen
        // state no audit had ever measured.
        if (priorRecord) {
          window.localStorage.setItem(
            'mandate.records.v1',
            JSON.stringify([priorRecord]),
          )
        }
      } catch {
        // A context that will not let us write gets the defaults, which is
        // also what a player in a private window gets.
      }
    },
    [direction, playTheInterval, priorRecord],
  )

  const page = await context.newPage()

  /** Everything the console said, so a tool can fail on it. */
  const consoleMessages = []
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      consoleMessages.push(`${message.type()}: ${message.text()}`)
    }
  })
  page.on('pageerror', (error) => {
    consoleMessages.push(`pageerror: ${error.message}`)
  })
  page.on('requestfailed', (request) => {
    // A static build makes no network calls once loaded; one that does is a
    // violation of the project's own first rule, not a flake.
    consoleMessages.push(`requestfailed: ${request.url()}`)
  })

  return { browser, context, page, consoleMessages }
}

/**
 * Start a mandate and stop on the briefing.
 *
 * `scenario` is a scenario id, or null for a fictional mandate — in which case
 * `institution` and `difficulty` are used. A scenario ignores both, because
 * there is no difficulty to choose on a historical mandate.
 */
export async function startMandate(
  page,
  { seed, scenario = null, institution = 'fed', difficulty = 'easy' } = {},
) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'load' })
  await page.locator('[data-start]').click()
  await page.waitForSelector('text=Set up your mandate')

  // Selected by `data-*` hooks rather than by their labels, deliberately.
  // These tools exist partly to catch copy changing, so a tool that could not
  // find the Hard button after someone rewrote its one-line summary would be
  // failing at the wrong thing, loudly, in a way that looks like a bug in the
  // game.
  const click = async (selector) => {
    const target = page.locator(selector)
    await target.waitFor({ state: 'visible' })
    await target.click()
  }

  if (scenario === null) {
    await click('[data-scenario="fictional"]')
    await click(`[data-institution="${institution}"]`)
    await click(`[data-difficulty="${difficulty}"]`)
  } else {
    // The choice is two steps now — historical or fictional, and only then
    // which record — so the catalogue is not on screen until it is asked for.
    // A tool that clicked straight at a scenario id waited thirty seconds for
    // a button behind a door it had not opened, and reported a timeout that
    // looked like the game hanging.
    await click('[data-scenario-kind="historical"]')
    await click(`[data-scenario="${scenario}"]`)
  }

  const input = page.locator('#seed-input')
  await input.fill('')
  await input.fill(seed)
  await page.getByRole('button', { name: 'Start the mandate' }).click()
  await page.waitForSelector('button:has-text("Enter the first meeting")')
}

/**
 * Leave the briefing and land in meeting one.
 *
 * `onTransient` is passed straight through, and that matters more here than
 * anywhere else: the first-meeting explanation only ever appears at this exact
 * moment, on a browser that has never played. A caller that dropped the hook
 * would click through the one screen in the game that cannot be reached any
 * other way — which is what both tools did until this took a parameter.
 */
export async function enterFirstMeeting(page, onTransient = null) {
  await page.getByRole('button', { name: 'Enter the first meeting' }).click()
  await settleMeeting(page, onTransient)
}

/**
 * Wait until the meeting's tab strip is on screen, clicking through whichever
 * transient screens stand in front of it.
 *
 * `onTransient` is called with a name before each one is dismissed, which is
 * what lets a screenshot tool photograph the interval player and the reaction
 * screen at all. The third blind spot in this project's history is exactly
 * this function written without that hook.
 */

/**
 * Wait until the page has actually stopped moving.
 *
 * `isVisible` is true on an element's *first painted frame*, and panels in
 * this interface enter from opacity zero. So a tool that returned the moment
 * something was visible was photographing and measuring panels at an opacity
 * of nought — which is exactly what happened: a full-mandate capture showed
 * the standing line, the one that carries the severe warnings, as an empty
 * gap.
 *
 * That was fixed with two animation frames, and two frames was enough for a
 * 90 ms fade. It is nothing against what is on the screen now. A figure rolls
 * for 420 ms; a chip is thrown on a spring that overshoots and settles over
 * most of a second; a shake runs five steps 42 ms apart. Two frames into any
 * of those is halfway through. The symptoms were precise and in two different
 * tools at once:
 *
 *   - the contrast audit reported `1.02:1` on a claret figure against the
 *     vault — a pair that is really 7:1 — because it measured the element on
 *     a frame where its fade-in was still at opacity 0.02, and composited it
 *     into the background;
 *   - the offline check timed out clicking a tab, with Playwright's own
 *     `element is not stable`, because something above it was still moving.
 *
 * Both are the same defect seen from two sides, and both are the *third*
 * appearance of this project's most reliable mistake: a tool that reports
 * what the browser was holding halfway through.
 *
 * So this no longer counts frames. It waits for the page to be visually
 * still: no running Web Animations, and an unchanged signature of every
 * inline `opacity` and `transform` — which is where Motion writes, frame by
 * frame — across three consecutive frames. It gives up after `timeout` and
 * returns anyway, because a tool that hangs on a spring that never quite
 * settles is worse than one that photographs the last millimetre of it.
 */
async function quiet(page, timeout = 3000) {
  await page
    .evaluate(
      (limit) =>
        new Promise((resolve) => {
          const deadline = performance.now() + limit
          let previous = null
          let stable = 0

          const signature = () => {
            // Motion drives springs by writing inline styles every frame, so
            // the inline style of everything on the page *is* the animation
            // state. Reading `cssText` catches opacity, transform and any
            // motion value bound to a custom property in one go.
            let out = ''
            for (const element of document.querySelectorAll('[style]')) {
              out += element.style.cssText + '|'
            }
            /*
             * **And the text, because not every animation moves a style.**
             *
             * `Tally` rolls a figure from zero to its value by writing
             * `textContent`. It sets no inline style and creates no WAAPI
             * animation, so it was invisible to both halves of this function:
             * the signature was identical three frames running and
             * `getAnimations()` was empty, and `quiet()` reported "still"
             * while the number was still climbing.
             *
             * Caught by looking at a capture, not by a test: an ECB report
             * photographed its headline as **"banked 0, a meeting 35"** — two
             * numbers that cannot both be true over fifteen meetings. Read
             * from the DOM two and a half seconds later, the total was 532.
             * The screen was right and the photograph was taken before it
             * had arrived, which is the family of defect this whole function
             * exists for, arriving through the one channel it did not watch.
             *
             * The mechanism did not fail. It was written for springs that
             * move styles, and was never extended when the motion vocabulary
             * gained something that moves text instead.
             *
             * `textContent` rather than `innerText` deliberately: `innerText`
             * forces layout on every frame, which on a ten-thousand-pixel
             * glossary page costs more than the whole audit saves.
             */
            return out + '||' + document.body.textContent
          }

          // WAAPI animations (CSS transitions and keyframes, and the route
          // Motion takes for a plain opacity tween) report themselves, and
          // are cheaper to ask than to infer.
          const running = () =>
            document.getAnimations().filter((a) => a.playState === 'running').length

          /*
           * **The floor, and why three frames is not enough on its own.**
           *
           * Three identical frames is about 50 ms. The result screen's total
           * is a `Tally` with a 240 ms *delay* before it starts rolling — so
           * for the first quarter of a second the page is genuinely still:
           * nothing is in `getAnimations()`, no inline style moves, the text
           * does not change. `quiet()` sampled that stillness, found three
           * identical frames, and resolved — **before the animation had
           * begun.** Adding the text to the signature did not help, because
           * during a delay there is nothing to see.
           *
           * So stillness has to be *continuous for longer than the longest
           * delay in the motion vocabulary*, which is that 240 ms. At 400 ms
           * a delay followed by motion resets the counter and the wait runs
           * through the whole animation; a page that is actually at rest
           * costs 400 ms instead of 50.
           *
           * That is about five minutes added to the full contrast walk, and
           * it buys the difference between a photograph of a screen and a
           * photograph of a screen that has arrived — which this project has
           * now got wrong seven times.
           */
          const MIN_STILL_MS = 400
          let stillSince = null

          const tick = () => {
            if (performance.now() > deadline) return resolve('timeout')
            const now = signature()
            stable = now === previous ? stable + 1 : 0
            if (now !== previous) stillSince = null
            else if (stillSince === null) stillSince = performance.now()
            previous = now
            // Three consecutive identical frames. Two is not enough: a spring
            // at its turning point holds the same value for one frame while
            // still very much in flight.
            //
            // And **nothing may be running**. A first version folded the
            // count of running animations into the signature instead, which
            // is a different and useless test: a count that sits at 1 for
            // three frames is identical three times over while the animation
            // it counts runs its whole course. The audit duly went on
            // measuring a figure at half opacity and reporting a 7.4:1 pair
            // as 3.2:1 — the invented failure this function exists to stop,
            // one layer further in.
            if (
              stable >= 3 &&
              running() === 0 &&
              stillSince !== null &&
              performance.now() - stillSince >= MIN_STILL_MS
            ) {
              return resolve('still')
            }
            requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        }),
      timeout,
    )
    .catch(() => null)
}

async function settled(page) {
  await quiet(page)
  return 'meeting'
}

export async function settleMeeting(page, onTransient = null) {
  for (let guard = 0; guard < 8; guard += 1) {
    if (await isResult(page)) return 'result'

    /*
     * **The bulletin, which is modal and therefore blocks every tool.**
     *
     * It is a real takeover — `position: fixed` over the whole viewport — so
     * Playwright's next click lands on the scrim instead of the control, and
     * the walk dies with "`<div data-bulletin=…>` intercepts pointer events"
     * after sixty retries. That is what it did: the contrast audit stopped at
     * 182 states with a `TimeoutError`, which is the *good* failure, because
     * the bad one is a tool that silently reports clean over the screens it
     * never reached.
     *
     * Handled here rather than in each caller, for the reason at the top of
     * this file: navigation lives in one place. And it is offered to
     * `onTransient` **before** being dismissed, because the bulletin is a
     * screen — the contrast audit has to measure it, the board has to
     * photograph it — and this project's three historical blind spots were
     * all a transient panel clicked past before anybody looked at it.
     */
    const bulletin = page.locator('[data-bulletin-dismiss]')
    if (await bulletin.isVisible().catch(() => false)) {
      if (onTransient) await onTransient('bulletin')
      await bulletin.click()
      await quiet(page)
      continue
    }

    const interval = page.locator(
      'button:has-text("Skip to the meeting"), button:has-text("Open the meeting")',
    )
    const reaction = page.locator('button:has-text("Continue to the next meeting")')
    // `first()`, and this is load-bearing. The desk panel has a tablist of its
    // own, so any screen with the desk tab open has two — and a bare locator
    // then throws for strict-mode ambiguity, which the `catch` below turns
    // into "no meeting here", which is a lie. The first-meeting guide opens
    // the desk tab, which is how this finally surfaced.
    const tablist = page.locator('[role="tablist"]').first()

    // `first()` because the interval player's two labels are one button in two
    // states, and a selector listing both would otherwise be strict-mode
    // ambiguous the instant the frame advances.
    if (await interval.first().isVisible().catch(() => false)) {
      if (onTransient) await onTransient('interval')
      // Let it finish rather than skipping mid-animation: the label changes to
      // "Open the meeting" on the last frame, and a tool that always skipped
      // would never photograph the final frame, which is the one with the
      // numbers in it. Four frames is a few seconds; the timeout is generous
      // for a loaded machine, not for a slow animation.
      const final = page.locator('button:has-text("Open the meeting")')
      const arrived = await final
        .waitFor({ state: 'visible', timeout: 8_000 })
        .then(() => true)
        .catch(() => false)
      if (arrived && onTransient) await onTransient('interval-final')
      if (arrived) await final.click()
      else await interval.first().click()
      continue
    }

    if (await reaction.isVisible().catch(() => false)) {
      if (onTransient) await onTransient('reaction')
      await reaction.click()
      continue
    }

    // The first-meeting explanation, which is a modal overlay in front of the
    // meeting. Checked *before* the tablist, deliberately: the tablist is
    // visible underneath it, so a check in the other order would report
    // "meeting" and then click tabs that the overlay was swallowing.
    //
    // Each step is its own screen and is handed to `onTransient` as one, so
    // the board photographs all four and the audit measures all four. Then it
    // is clicked through to the end rather than skipped, because skipping it
    // would leave the last step — the only one that names the confirm button —
    // permanently unphotographed.
    const guide = page.locator('[data-guide-overlay]')
    if (await guide.isVisible().catch(() => false)) {
      for (let step = 1; step <= 6; step += 1) {
        const next = page.locator('[data-guide-next]')
        if (!(await next.isVisible().catch(() => false))) break
        if (onTransient) await onTransient(`guide-${step}`)
        await next.click()
        await page.waitForTimeout(250)
        if (!(await guide.isVisible().catch(() => false))) break
      }
      continue
    }

    if (await tablist.isVisible().catch(() => false)) return settled(page)

    // A quick meeting has no tab strip at all — one sentence, the dial, done.
    // It is still a meeting, and it is now most of them. See
    // `simulation/meeting/tempo.ts`.
    const quick = page.locator('[data-tempo="quick"]')
    if (await quick.isVisible().catch(() => false)) return settled(page)

    // Nothing recognised yet — give React a tick and look again, rather than
    // concluding anything from an absence.
    await page.waitForTimeout(150)
  }
  throw new Error(`settleMeeting: no meeting, result or transient screen after 8 tries`)
}

/**
 * True once the run has ended **and the result screen has rendered**.
 *
 * Both halves matter. The URL changes the instant the route does, which is
 * before React has painted anything, so a caller that screenshotted on the URL
 * alone photographed an empty page — and did, for three scenarios, producing
 * images indistinguishable from the blank-screen bug they were taken to check
 * for. The text extraction in the same run read the report perfectly, which is
 * how the two were told apart.
 *
 * So: the URL, then the heading. The same rule as everywhere else in this
 * file — wait for a selector, never infer a state from a reading taken on the
 * wrong tick.
 */
export async function isResult(page) {
  if (!page.url().includes('/play/result/')) return false
  return page
    .locator('main h1')
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 })
    .then(() => true)
    .catch(() => {
      // The route is the result screen and nothing rendered on it. That is the
      // blank-screen failure, and it must be loud rather than silently
      // reported as "not the result screen yet".
      throw new Error(
        'The result route is open and nothing rendered: the report screen is blank.',
      )
    })
}

/**
 * Select one tab by its panel id. Returns false if this run has no such tab.
 *
 * Opens the room first where the meeting is a quick one: the tabs live one
 * gesture behind the fast surface, and a tool that gave up on not finding
 * them would be reporting the absence of a screen that is simply closed.
 */

/**
 * Dismiss a bulletin if one is up, so the next click reaches its target.
 *
 * `settleMeeting` already offers it to `onTransient` and dismisses it on the
 * way through a meeting boundary, which is the path that matters and the only
 * place it gets *measured*. This is the belt: `openPanel` and
 * `decideAndAdvance` are called directly in loops by the audit and the board,
 * and a modal that appeared outside a boundary would stop them the same way.
 * Returns true if it cleared one, so a caller can tell.
 */
export async function clearBulletin(page) {
  const dismiss = page.locator('[data-bulletin-dismiss]')
  if (!(await dismiss.isVisible().catch(() => false))) return false
  await dismiss.click().catch(() => {})
  await quiet(page)
  return true
}

export async function openPanel(page, panel) {
  await clearBulletin(page)
  const room = page.locator('[data-open-room]')
  if (await room.isVisible().catch(() => false)) {
    await room.click()
    // The room arrives animated. Clicking a tab inside it while it is still
    // arriving is what made the offline check time out with Playwright's
    // `element is not stable` — the tab was there and was moving.
    await quiet(page)
  }

  const tab = page.locator(`#tab-${panel}`)
  if (!(await tab.isVisible().catch(() => false))) return false
  await tab.click()
  await page.waitForSelector(`#panel-${panel}`, { state: 'visible' })
  await quiet(page)
  return true
}

export { quiet }

/**
 * Take one decision at the desk and advance.
 *
 * `move` is a signed number of basis points, snapped to the slider's own
 * detents by the slider. Null holds. The rate control is a native
 * `<input type="range">`, so it is driven the way a keyboard player drives it,
 * which also means the test exercises the accessible path.
 */
export async function decideAndAdvance(page, { move = 0, openTheRoom = false } = {}) {
  await clearBulletin(page)
  // The quick surface decides in one action: the dial and a confirm, with no
  // review screen between them. `openTheRoom` forces the full apparatus, for
  // the tools that exist to photograph it.
  const quick = page.locator('[data-tempo="quick"]')
  if (!openTheRoom && (await quick.isVisible().catch(() => false))) {
    if (move !== 0) {
      const slider = page.locator('[data-tempo="quick"] input[type="range"]').first()
      if (await slider.isVisible().catch(() => false)) {
        const step = Number((await slider.getAttribute('step')) ?? 25)
        const min = Number((await slider.getAttribute('min')) ?? -200)
        const max = Number((await slider.getAttribute('max')) ?? 200)
        const current = Number(await slider.inputValue())
        const wanted = Math.max(min, Math.min(max, current + move))
        await slider.fill(String(Math.round(wanted / step) * step))
      }
    }
    await page.locator('[data-confirm]').click()
    return settleMeeting(page)
  }

  await openPanel(page, 'desk')

  if (move !== 0) {
    const slider = page.locator('input[type="range"]').first()
    if (await slider.isVisible().catch(() => false)) {
      const current = Number(await slider.inputValue())
      const step = Number((await slider.getAttribute('step')) ?? 25)
      const min = Number((await slider.getAttribute('min')) ?? -200)
      const max = Number((await slider.getAttribute('max')) ?? 200)
      const wanted = Math.max(min, Math.min(max, current + move))
      const snapped = Math.round(wanted / step) * step
      await slider.fill(String(snapped))
    }
  }

  await page.getByRole('button', { name: 'Review policy package' }).click()
  await page.waitForSelector('text=Confirm the policy package')
  await page.getByRole('button', { name: 'Confirm and advance' }).click()
  return settleMeeting(page)
}
