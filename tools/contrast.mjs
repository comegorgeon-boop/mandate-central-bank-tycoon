/**
 * The contrast audit.
 *
 * Walks every rendered text node on every screen of a real mandate, in both
 * visual directions, resolves the background actually *painted* behind each one
 * (not the nearest ancestor's declared background, which is usually
 * transparent), and fails anything under WCAG AA.
 *
 * ## Read this before trusting an ALL CLEAR
 *
 * This tool has reported ALL CLEAR over a broken interface three times, and
 * the cause was the same every time: **a screen it never visited cannot have
 * failed.**
 *
 *  1. It clicked past the between-meetings panels before measuring, while the
 *     transition screen sat at 1.04:1.
 *  2. It only ever played easy, so the standing-settings panel, the instrument
 *     disclosures and the realised-effect readout went unmeasured.
 *  3. `locator.count()` does not wait. Read on the same tick as a React
 *     re-render it returns 0, the walk concluded the mandate had ended, and it
 *     stopped on its first iteration — reporting clean over six unvisited
 *     screens.
 *
 * Which is why **the itinerary is part of the output**. A pass is only a pass
 * if the list at the bottom is long and contains the screens you expected. The
 * navigation itself now lives in `drive.mjs`, which waits for selectors and
 * never infers a screen's absence from a count.
 *
 * Run with: node tools/contrast.mjs
 */

import { DIRECTIONS, PANELS, decideAndAdvance, enterFirstMeeting, isResult, open, openPanel, settleMeeting, startMandate } from './drive.mjs'

/**
 * The fewest states a complete walk can produce.
 *
 * Set from a measured complete run (246) less a margin for a mandate that
 * happens to end early on one of its seeds. Its only job is to make the
 * difference between "nothing failed" and "nothing was looked at" into an
 * error rather than a number nobody reads.
 */
const MINIMUM_STATES = 320

/**
 * Measure every text node in the page.
 *
 * Runs in the browser because it needs `getComputedStyle` and the paint order.
 * Resolving the real background means walking *up* from the text node until an
 * ancestor declares a non-transparent background — which is what the browser
 * itself does — and compositing any partially transparent layers on the way.
 */
const MEASURE = () => {
  function parseColor(value) {
    const match = /^rgba?\(([^)]+)\)$/.exec(value)
    if (!match) return null
    const parts = match[1].split(',').map((p) => Number.parseFloat(p.trim()))
    const [r, g, b] = parts
    const a = parts.length > 3 ? parts[3] : 1
    return { r, g, b, a }
  }

  function over(top, bottom) {
    const a = top.a
    return {
      r: top.r * a + bottom.r * (1 - a),
      g: top.g * a + bottom.g * (1 - a),
      b: top.b * a + bottom.b * (1 - a),
      a: 1,
    }
  }

  function luminance({ r, g, b }) {
    const channel = (value) => {
      const c = value / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
  }

  function ratio(fg, bg) {
    const a = luminance(fg)
    const b = luminance(bg)
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
  }

  /** The colour actually painted behind this element. */
  function backgroundBehind(element) {
    let stack = []
    let node = element
    while (node && node !== document.documentElement.parentNode) {
      const style = styleOf(node)
      const colour = parseColor(style.backgroundColor)
      if (colour && colour.a > 0) {
        stack.push(colour)
        if (colour.a >= 0.999) break
      }
      node = node.parentElement
    }
    // Nothing opaque anywhere up the tree: the canvas is white by default.
    let result = { r: 255, g: 255, b: 255, a: 1 }
    for (let i = stack.length - 1; i >= 0; i -= 1) result = over(stack[i], result)
    return result
  }

  const findings = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const seen = new Set()

  /**
   * `getComputedStyle` is not free and this walk calls it for every ancestor
   * of every text node, twice over: once up the tree for opacity and once up
   * the tree for the painted background. On a page with every disclosure open
   * that is tens of thousands of calls and it took the audit from about a
   * second a state to six. Memoised per element for the duration of one
   * measurement, which is correct because nothing is mutated in between.
   */
  const styleCache = new Map()
  const styleOf = (element) => {
    let style = styleCache.get(element)
    if (style === undefined) {
      style = getComputedStyle(element)
      styleCache.set(element, style)
    }
    return style
  }

  while (walker.nextNode()) {
    const node = walker.currentNode
    const text = (node.textContent ?? '').trim()
    if (text.length === 0) continue

    const element = node.parentElement
    if (!element || seen.has(element)) continue
    seen.add(element)

    const style = styleOf(element)
    if (style.visibility === 'hidden' || style.display === 'none') continue

    // Element opacity, accumulated up the tree. A `.opacity-60` wrapper or a
    // panel caught part-way through its entrance animation paints its text at
    // a fraction of the declared colour, and reading `style.color` alone
    // measures a colour nobody is looking at. Animations are settled before
    // this runs — see `settleAnimations` in drive.mjs — so what is left here
    // is deliberate transparency, which is exactly what should be measured.
    let stackOpacity = 1
    for (let node = element; node; node = node.parentElement) {
      const value = Number.parseFloat(styleOf(node).opacity)
      if (Number.isFinite(value)) stackOpacity *= value
      // An opaque ancestor's opacity cannot be undone further up, and once the
      // product is zero nothing above changes it.
      if (stackOpacity === 0) break
    }
    if (stackOpacity <= 0.01) continue

    const rect = element.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) continue

    // Screen-reader-only text is not painted and has no contrast to fail.
    if (rect.width <= 1 && rect.height <= 1) continue
    if (style.clip === 'rect(0px, 0px, 0px, 0px)') continue

    const fg = parseColor(style.color)
    if (!fg) continue
    const bg = backgroundBehind(element)
    const effective = { ...fg, a: fg.a * stackOpacity }
    const composited = effective.a >= 0.999 ? effective : over(effective, bg)

    const size = Number.parseFloat(style.fontSize)
    const weight = Number.parseInt(style.fontWeight, 10) || 400
    // WCAG's definition of large: 18pt (24px), or 14pt (18.66px) bold.
    const large = size >= 24 || (size >= 18.66 && weight >= 700)
    const required = large ? 3.0 : 4.5
    const measured = ratio(composited, bg)

    if (measured + 0.005 < required) {
      findings.push({
        text: text.slice(0, 70),
        ratio: Math.round(measured * 100) / 100,
        required,
        fontSize: size,
        fontWeight: weight,
        color: style.color,
        background: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`,
        selector:
          element.tagName.toLowerCase() +
          (element.className && typeof element.className === 'string'
            ? `.${element.className.split(/\s+/).slice(0, 3).join('.')}`
            : ''),
      })
    }
  }
  return findings
}

const itinerary = []
const failures = []

async function audit(page, label) {
  // **Open every disclosure first.**
  //
  // Blind spot number four, pre-empted. The density pass moved a great deal of
  // prose behind `<details>` — the reading and the definition under every
  // indicator, the stance decomposition, the instrument brief — and text
  // inside a closed `<details>` is not rendered, so a walk that measured the
  // page as it arrives would have reported clean over several hundred
  // characters it had simply never drawn. Folding text is a legitimate answer
  // to density and it is not an answer to contrast.
  //
  // Opened by setting the property rather than by clicking, because clicking
  // three dozen summaries per state is slow and a summary inside a closed
  // parent is not clickable at all.
  await page.evaluate(() => {
    for (const element of document.querySelectorAll('details')) element.open = true
  })
  // One animation frame, so a panel that has just been mounted — or just been
  // opened — has been painted before it is measured.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))))
  const findings = await page.evaluate(MEASURE)
  itinerary.push(`${label} (${findings.length === 0 ? 'clean' : `${findings.length} FAIL`})`)
  for (const finding of findings) failures.push({ state: label, ...finding })
  // Printed as it goes rather than only at the end. A tool that walks 250
  // screens in silence is a tool whose hang looks exactly like its success,
  // and this one's whole purpose is to be trusted when it says nothing is
  // wrong.
  process.stderr.write(
    `  ${findings.length === 0 ? ' ok ' : `FAIL`} ${label}${findings.length ? ` ×${findings.length}` : ''}\n`,
  )
}

/** One full mandate in one direction, measured at every screen it has. */
async function walk({ direction, seed, scenario, institution, difficulty, meetings, move = 0 }) {
  const tag = scenario ?? `${institution}/${difficulty}`
  const { browser, page, consoleMessages } = await open({ direction })

  await page.goto(`${process.env.MANDATE_URL ?? 'http://localhost:4173'}/`)
  await audit(page, `${direction}:${tag}:home`)

  await startMandate(page, { seed, scenario, institution, difficulty })
  await audit(page, `${direction}:${tag}:setup`)
  await audit(page, `${direction}:${tag}:briefing`)

  await enterFirstMeeting(page)

  for (let meeting = 1; meeting <= meetings; meeting += 1) {
    if (await isResult(page)) break

    for (const panel of PANELS) {
      if (await openPanel(page, panel)) {
        await audit(page, `${direction}:${tag}:m${meeting}:tab:${panel}`)
      }
    }

    // The desk's second face: the confirmation screen, which is a whole
    // screen and was unmeasured for two of this tool's three blind spots.
    await openPanel(page, 'desk')
    // Some walks tighten deliberately, to reach the screens that only exist
    // under pressure. The slider is driven the way a keyboard player drives
    // it, which also exercises the accessible path.
    if (move !== 0) {
      const slider = page.locator('input[type="range"]').first()
      if (await slider.isVisible().catch(() => false)) {
        const step = Number((await slider.getAttribute('step')) ?? 25)
        const max = Number((await slider.getAttribute('max')) ?? 200)
        await slider.fill(String(Math.min(max, Math.round(move / step) * step)))
      }
    }
    await page.getByRole('button', { name: 'Review policy package' }).click()
    await page.waitForSelector('text=Confirm the policy package')
    await audit(page, `${direction}:${tag}:m${meeting}:confirm`)
    await page.getByRole('button', { name: 'Confirm and advance' }).click()

    // And the two transient screens between meetings, measured *before* they
    // are clicked past. Blind spot number one.
    const where = await settleMeeting(page, async (kind) => {
      await audit(page, `${direction}:${tag}:m${meeting}:${kind}`)
    })
    if (where === 'result') break
  }

  if (await isResult(page)) {
    await audit(page, `${direction}:${tag}:result`)
    // The result screen's own disclosures, which are a click each.
    const buttons = page.locator('summary')
    const count = await buttons.count()
    for (let i = 0; i < count; i += 1) {
      await buttons.nth(i).click().catch(() => {})
    }
    await audit(page, `${direction}:${tag}:result:open`)
  }

  await browser.close()
  return consoleMessages
}

async function main() {
  const runs = [
    // Easy, which is the tutorial and has panels no other mode shows.
    { seed: 'AUDIT-EASY', institution: 'fed', difficulty: 'easy', scenario: null, meetings: 4 },
    // Hard on the ECB, which is where almost everything the audit has ever
    // missed lives: the divided committee, the whole toolkit, the free tone,
    // the area tab, the instrument disclosures.
    { seed: 'AUDIT-HARD', institution: 'ecb', difficulty: 'hard', scenario: null, meetings: 4 },
    // And two scenarios, because the historical mandates have screens of
    // their own: the procedure choice, the dated header, the standard at the
    // end — and, in 1929, a gold floor drawn on the dial in claret and an
    // objective of zero.
    { seed: 'AUDIT-VOLCKER', institution: 'fed', difficulty: 'hard', scenario: 'volcker_1979', meetings: 3 },
    { seed: 'AUDIT-1929', institution: 'fed', difficulty: 'hard', scenario: 'great_contraction_1929', meetings: 3 },
    // A seed and a policy that produce a demand from the government by the
    // fourth meeting, because the demand panel is a screen that only exists
    // under pressure and nothing else in this walk creates any.
    { seed: 'DEMO-8', institution: 'fed', difficulty: 'hard', scenario: null, meetings: 5, move: 100 },
  ]

  const consoleProblems = []
  for (const direction of DIRECTIONS) {
    for (const run of runs) {
      const messages = await walk({ direction, ...run })
      for (const message of messages) {
        consoleProblems.push(`${direction}:${run.scenario ?? run.difficulty}: ${message}`)
      }
    }
  }

  console.log('')
  console.log('Contrast audit — WCAG AA on every painted text node')
  console.log('='.repeat(78))

  if (failures.length === 0) {
    console.log(`No contrast failures across ${itinerary.length} states.`)
  } else {
    const byState = new Map()
    for (const failure of failures) {
      if (!byState.has(failure.state)) byState.set(failure.state, [])
      byState.get(failure.state).push(failure)
    }
    for (const [state, list] of byState) {
      console.log('')
      console.log(`  ${state}`)
      for (const f of list) {
        console.log(
          `    ${String(f.ratio).padStart(5)}:1 (needs ${f.required})  ` +
            `${f.color} on ${f.background}  ${f.fontSize}px/${f.fontWeight}`,
        )
        console.log(`           "${f.text}"`)
        console.log(`           ${f.selector}`)
      }
    }
    console.log('')
    console.log(`${failures.length} failure(s) across ${byState.size} state(s).`)
  }

  if (consoleProblems.length > 0) {
    console.log('')
    console.log('Console output during the walk (should be empty):')
    for (const problem of [...new Set(consoleProblems)]) console.log(`  ${problem}`)
  }

  console.log('')
  console.log(`States audited (${itinerary.length}) — a pass is only a pass if this list is right:`)
  for (const state of itinerary) console.log(`  ${state}`)
  console.log('')

  // The floor on the itinerary, which is the only defence against this tool's
  // one recurring failure: reporting clean because it never arrived. Three
  // separate times a navigation change silently cut the walk short and the
  // output was an ALL CLEAR over screens that were never rendered. A count is
  // a crude guard and it is the guard that would have caught all three.
  if (itinerary.length < MINIMUM_STATES) {
    console.log(
      `! Only ${itinerary.length} states audited, against a floor of ${MINIMUM_STATES}. ` +
        `Something stopped the walk early: an ALL CLEAR here would be meaningless.`,
    )
    process.exitCode = 1
  }

  if (failures.length > 0 || consoleProblems.length > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
