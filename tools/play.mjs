/**
 * Play one mandate to its end and photograph what the player sees at it.
 *
 * `tools/board.mjs` walks every screen state but stops short of the two
 * screens that only exist *after* a finished term — the report and the records
 * page with something on it — because reaching them means actually serving a
 * mandate rather than navigating to a URL. This is the tool that serves one.
 *
 *     node tools/play.mjs                  # easy Fed, default seed
 *     node tools/play.mjs volcker_1979     # a historical mandate
 *
 * Captures land in `captures/play/`. The point is to look at them.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import {
  BASE_URL,
  decideAndAdvance,
  enterFirstMeeting,
  VIEWPORTS,
  isResult,
  open,
  quiet,
  startMandate,
} from './drive.mjs'

const scenario = process.argv[2] ?? null
const seed = process.env.MANDATE_SEED ?? 'PLAY-ACHIEVEMENTS'
/*
 * The institution and difficulty are env-settable now, and the reason is a
 * defect this tool could not have caught as it stood: it only ever played
 * fed/easy, so a change to the *ECB's* toolkit — the one institution with a
 * component of its own to steer — was unplayable by the one tool whose job is
 * to play a mandate end to end and photograph it.
 *
 *     MANDATE_INSTITUTION=ecb MANDATE_DIFFICULTY=medium node tools/play.mjs
 */
const institution = process.env.MANDATE_INSTITUTION ?? 'fed'
const difficulty = process.env.MANDATE_DIFFICULTY ?? 'easy'

// A scenario keeps the original directory; a fictional mandate away from the
// fed/easy default gets its own, so two runs do not overwrite each other's
// captures and leave a board that is half one mandate and half another.
const OUT =
  scenario !== null || (institution === 'fed' && difficulty === 'easy')
    ? 'captures/play'
    : `captures/play-${institution}-${difficulty}`

/** A move pattern with some life in it, so the run is not a flat hold. */
const MOVES = [0, 25, 25, 0, -25, 0, 50, 0, 0, -25, 25, 0]

async function main() {
  await mkdir(OUT, { recursive: true })
  const { browser, page } = await open({
    direction: 'papers-on-the-table',
    viewport: VIEWPORTS.desktop,
  })
  const shots = []
  const shoot = async (name) => {
    /*
     * **Settle first.** This helper called `page.screenshot` directly, so it
     * was the one tool in the repository that did *not* inherit `quiet()` from
     * the shared driver — and it is the tool whose docstring says "the point is
     * to look at them".
     *
     * Caught by looking: an ECB mandate's report photographed its headline as
     * **"banked 0, a meeting 35"**, two numbers that cannot both be true over
     * fifteen meetings. The total is a `Tally`, which rolls from zero over
     * 1,100 ms after a 240 ms delay, and the capture landed inside the roll.
     * Nothing was wrong with the screen; the photograph was taken before it
     * had arrived.
     *
     * That is journal 5 and journal 18's defect, in a tool written after both
     * of them, and REPRISE has been claiming "every tool inherits it" — which
     * was true of the two that existed when it was written.
     */
    await quiet(page)
    const file = `${OUT}/${name}.png`
    await page.screenshot({ path: file, fullPage: true })
    shots.push(file)
    console.log(`  ${file}`)
  }

  try {
    await startMandate(page, { seed, scenario, institution, difficulty })
    await enterFirstMeeting(page)
    console.log(
      `playing ${scenario ?? `${institution}/${difficulty}`} on seed ${seed}`,
    )

    let meeting = 1
    for (; meeting <= 60; meeting += 1) {
      if (await isResult(page)) break
      if (meeting <= 2 || meeting % 6 === 0) await shoot(`meeting-${meeting}`)
      const move = MOVES[(meeting - 1) % MOVES.length]
      const where = await decideAndAdvance(page, { move })
      if (where === 'result') break
    }
    console.log(`served ${meeting} meetings`)

    if (!(await isResult(page))) {
      throw new Error(`the mandate did not end in ${meeting} meetings`)
    }

    // The report, in full, and then the achievements section on its own so a
    // glance can tell whether it rendered at all.
    await shoot('result')
    const earned = page.locator('section[aria-labelledby="earned-heading"]')
    if (await earned.isVisible().catch(() => false)) {
      await earned.screenshot({ path: `${OUT}/result-achievements.png` })
      console.log(`  ${OUT}/result-achievements.png`)
      const rows = await earned.locator('li').count()
      console.log(`achievements shown on the report: ${rows}`)
    } else {
      console.log('NO achievements section on the report')
    }

    // And the records page, which only has anything on it now.
    await page.goto(`${BASE_URL}/records`, { waitUntil: 'load' })
    await page.waitForSelector('main h1')
    await shoot('records')
    const list = page.locator('section[aria-labelledby="achievements-heading"]')
    const counted = await list.locator('li').count()
    console.log(`achievements listed on the records page: ${counted}`)
    const summary = await list.locator('p').first().innerText()
    console.log(`records page says: ${summary.replace(/\s+/g, ' ')}`)

    const errors = await page.evaluate(() => globalThis.__consoleErrors ?? [])
    if (errors.length > 0) console.log(`console errors: ${errors.join(' | ')}`)

    await writeFile(
      `${OUT}/index.html`,
      `<!doctype html><title>One mandate</title>` +
        `<style>body{margin:0;background:#1a1613;color:#e8e0d4;font:14px system-ui}` +
        `figure{margin:0 0 2rem}figcaption{padding:.5rem 1rem;font-weight:600}` +
        `img{display:block;width:100%;max-width:1100px;margin:0 auto}</style>` +
        `<h1 style="padding:1rem">${scenario ?? 'fed/easy'} · seed ${seed}</h1>` +
        shots
          .map(
            (file) =>
              `<figure><figcaption>${file.split('/').pop()}</figcaption>` +
              `<img src="${file.split('/').pop()}"></figure>`,
          )
          .join(''),
    )
    console.log(`\n  ${OUT}/index.html`)
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
