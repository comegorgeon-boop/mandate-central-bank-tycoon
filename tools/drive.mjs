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
} = {}) {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport, reducedMotion })

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
    ([dir, play]) => {
      try {
        window.localStorage.setItem(
          'mandate.settings.v1',
          JSON.stringify({ direction: dir, playTheInterval: play }),
        )
      } catch {
        // A context that will not let us write gets the defaults, which is
        // also what a player in a private window gets.
      }
    },
    [direction, playTheInterval],
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
  await page.getByRole('link', { name: 'Play now' }).click()
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
    await click(`[data-scenario="${scenario}"]`)
  }

  const input = page.locator('#seed-input')
  await input.fill('')
  await input.fill(seed)
  await page.getByRole('button', { name: 'Start the mandate' }).click()
  await page.waitForSelector('button:has-text("Enter the first meeting")')
}

/** Leave the briefing and land in meeting one. */
export async function enterFirstMeeting(page) {
  await page.getByRole('button', { name: 'Enter the first meeting' }).click()
  await settleMeeting(page)
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
export async function settleMeeting(page, onTransient = null) {
  for (let guard = 0; guard < 8; guard += 1) {
    if (await isResult(page)) return 'result'

    const interval = page.locator(
      'button:has-text("Skip to the meeting"), button:has-text("Open the meeting")',
    )
    const reaction = page.locator('button:has-text("Continue to the next meeting")')
    const tablist = page.locator('[role="tablist"]')

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

    if (await tablist.isVisible().catch(() => false)) return 'meeting'

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

/** Select one tab by its panel id. Returns false if this run has no such tab. */
export async function openPanel(page, panel) {
  const tab = page.locator(`#tab-${panel}`)
  if (!(await tab.isVisible().catch(() => false))) return false
  await tab.click()
  await page.waitForSelector(`#panel-${panel}`, { state: 'visible' })
  return true
}

/**
 * Take one decision at the desk and advance.
 *
 * `move` is a signed number of basis points, snapped to the slider's own
 * detents by the slider. Null holds. The rate control is a native
 * `<input type="range">`, so it is driven the way a keyboard player drives it,
 * which also means the test exercises the accessible path.
 */
export async function decideAndAdvance(page, { move = 0 } = {}) {
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
