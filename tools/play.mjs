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
  startMandate,
} from './drive.mjs'

const OUT = 'captures/play'
const scenario = process.argv[2] ?? null
const seed = process.env.MANDATE_SEED ?? 'PLAY-ACHIEVEMENTS'

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
    const file = `${OUT}/${name}.png`
    await page.screenshot({ path: file, fullPage: true })
    shots.push(file)
    console.log(`  ${file}`)
  }

  try {
    await startMandate(page, { seed, scenario, difficulty: 'easy' })
    await enterFirstMeeting(page)
    console.log(`playing ${scenario ?? 'fed/easy'} on seed ${seed}`)

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
