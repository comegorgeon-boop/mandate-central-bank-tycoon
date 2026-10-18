/**
 * The screenshot board.
 *
 * One HTML page with a photograph of every screen the game has, in both visual
 * directions, at phone width and desktop width. Written to a fixed path so the
 * link never changes:
 *
 *     docs/board/index.html
 *
 * This is the player's only review channel on a long unattended run, so the
 * page is built to be *scanned* rather than read: a grid per screen, the two
 * directions side by side, phone and desktop stacked, and every image clickable
 * to full size. Anything that looks wrong is one click from being looked at
 * properly.
 *
 * It also records, beside each shot, the two things a picture cannot show: how
 * tall the screen is (a screen that needs four phone-heights of scrolling is a
 * finding) and whether the page scrolled sideways (it never should).
 *
 * Run with:
 *   npm run build && npx vite preview --port 4173 &
 *   node tools/board.mjs
 */

import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { DIRECTIONS, PANELS, VIEWPORTS, decideAndAdvance, enterFirstMeeting, isResult, open, openPanel, settleMeeting, startMandate } from './drive.mjs'

const OUT = 'docs/board'
const SHOTS = `${OUT}/shots`

/**
 * What the board covers.
 *
 * Three mandates, chosen so that between them every screen in the game is
 * reachable: the tutorial (its goal panel, its named opener, its reliable
 * staff advice), ECB hard (the divided committee, the whole toolkit, the area
 * tab, the free tone) and a scenario (the dated header, the procedure choice,
 * the standard at the end).
 */
const MANDATES = [
  { id: 'fed-easy', seed: 'BOARD-EASY', institution: 'fed', difficulty: 'easy', scenario: null, meetings: 3 },
  { id: 'ecb-hard', seed: 'BOARD-HARD', institution: 'ecb', difficulty: 'hard', scenario: null, meetings: 3 },
  // Two of the six historical mandates, chosen for the screens no other
  // mandate has: 1929 for the gold floor on the dial and a zero objective,
  // 1979 for the operating-procedure choice at its second meeting.
  { id: 'volcker', seed: 'BOARD-VOLCKER', institution: 'fed', difficulty: 'hard', scenario: 'volcker_1979', meetings: 2 },
  { id: 'contraction', seed: 'BOARD-1929', institution: 'fed', difficulty: 'hard', scenario: 'great_contraction_1929', meetings: 2 },
]

/** Every shot taken, in the order it was taken. */
const shots = []

/**
 * JPEG, not PNG, and the quality is a deliberate number.
 *
 * The board is committed — it is the player's only review channel while this
 * runs unattended, and a board that lives only on the machine that built it is
 * no channel at all. Four hundred and ninety-two full-page PNGs came to
 * **132 MB**, which is not a thing to put in a git history. The same shots as
 * JPEG at this quality are an order of magnitude smaller and lose nothing that
 * matters here: what the board is read for is layout, density, colour and
 * whether a screen is blank, and none of those survive or fail on chroma
 * subsampling. Anything that needs pixels can be re-shot in a second.
 */
const SHOT_QUALITY = 62

async function shoot(page, { mandate, direction, size, screen }) {
  const name = `${mandate}--${screen}--${direction}--${size}`.replace(/[^a-z0-9.-]+/gi, '_')
  const file = `${SHOTS}/${name}.jpg`
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))))

  // What a photograph cannot show, measured instead.
  const metrics = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
    sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    // The widest element that sticks out of the viewport, if any — which is
    // what a sideways scroll is usually caused by, and much more useful than
    // knowing that one exists.
    overflowing: (() => {
      const limit = document.documentElement.clientWidth + 1
      for (const element of document.body.querySelectorAll('*')) {
        const rect = element.getBoundingClientRect()
        if (rect.right > limit && rect.width > 0) {
          return `${element.tagName.toLowerCase()}${
            typeof element.className === 'string' && element.className
              ? `.${element.className.split(/\s+/).slice(0, 2).join('.')}`
              : ''
          } (${Math.round(rect.right)}px)`
        }
      }
      return null
    })(),
  }))

  await page.screenshot({ path: file, fullPage: true, type: 'jpeg', quality: SHOT_QUALITY })
  shots.push({ mandate, direction, size, screen, file: `shots/${name}.jpg`, ...metrics })
  process.stderr.write(
    `  ${mandate} ${direction} ${size} ${screen}` +
      `${metrics.sideways ? `  SIDEWAYS SCROLL: ${metrics.overflowing}` : ''}\n`,
  )
}

async function walk({ mandate, direction, size, standingPages = false }) {
  // Rendered at half scale. The board is committed and it is read for layout,
  // density, colour and whether a screen is blank — none of which needs a
  // retina pixel. At full scale the four hundred and ninety-two shots came to
  // 132 MB as PNG and 69 MB as JPEG, which is not a thing to put in a git
  // history that will be rewritten every time a screen changes.
  const { browser, page } = await open({
    direction,
    viewport: VIEWPORTS[size],
    deviceScaleFactor: 0.5,
  })
  const base = { mandate: mandate.id, direction, size }
  const BASE_URL = process.env.MANDATE_URL ?? 'http://localhost:4173'

  await page.goto(`${BASE_URL}/`)
  await shoot(page, { ...base, screen: '00-home' })

  await startMandate(page, mandate)
  await shoot(page, { ...base, screen: '01-setup' })
  await shoot(page, { ...base, screen: '02-briefing' })

  // The first-meeting explanation goes on the board: four steps, each its own
  // screen, and none of them reachable once the browser has played once.
  await enterFirstMeeting(page, async (kind) => {
    await shoot(page, { ...base, screen: `03-${kind}` })
  })

  for (let meeting = 1; meeting <= mandate.meetings; meeting += 1) {
    if (await isResult(page)) break
    const prefix = `${String(10 + meeting * 10).padStart(2, '0')}-m${meeting}`
    for (const panel of PANELS) {
      if (await openPanel(page, panel)) {
        await shoot(page, { ...base, screen: `${prefix}-${panel}` })
      }
    }
    await openPanel(page, 'desk')
    await page.getByRole('button', { name: 'Review policy package' }).click()
    await page.waitForSelector('text=Confirm the policy package')
    await shoot(page, { ...base, screen: `${prefix}-confirm` })
    await page.getByRole('button', { name: 'Confirm and advance' }).click()
    const where = await settleMeeting(page, async (kind) => {
      // The interval player's middle frames are the same screen with
      // different numbers; the final one is the screen worth keeping.
      if (kind === 'interval-final' || kind === 'reaction') {
        await shoot(page, { ...base, screen: `${prefix}-${kind}` })
      }
    })
    if (where === 'result') break
  }

  // And drive it to the end, so the result screen is on the board whatever
  // happened in the middle.
  let guard = 0
  while (!(await isResult(page)) && guard < 60) {
    const where = await decideAndAdvance(page, { move: 0 })
    if (where === 'result') break
    guard += 1
  }
  if (await isResult(page)) {
    await shoot(page, { ...base, screen: '90-result' })
    const disclosures = page.locator('summary')
    const count = await disclosures.count()
    for (let i = 0; i < count; i += 1) await disclosures.nth(i).click().catch(() => {})
    await shoot(page, { ...base, screen: '91-result-open' })
  }

  // The standing pages last, and only on one mandate, because they do not
  // depend on which one was played — but *after* it, deliberately: the
  // records page empty and the records page with a finished mandate and
  // earned achievements on it are two different screens, and the one worth
  // looking at is the one a player who has played will see.
  if (standingPages) {
    for (const [path, screen] of [
      ['glossary', '95-page-glossary'],
      ['records', '96-page-records'],
      ['about', '97-page-about'],
    ]) {
      await page.goto(`${BASE_URL}/${path}`)
      await page.waitForSelector('main h1')
      await shoot(page, { ...base, screen })
    }
  }

  await browser.close()
}

function render() {
  const screens = [...new Set(shots.map((shot) => `${shot.mandate}|${shot.screen}`))]
  const sideways = shots.filter((shot) => shot.sideways)
  const tall = shots.filter((shot) => shot.size === 'phone' && shot.scrollHeight > 3 * shot.clientHeight)

  const rows = screens
    .map((key) => {
      const [mandate, screen] = key.split('|')
      const group = shots.filter((shot) => shot.mandate === mandate && shot.screen === screen)
      const cells = DIRECTIONS.flatMap((direction) =>
        ['desktop', 'phone'].map((size) => {
          const shot = group.find((s) => s.direction === direction && s.size === size)
          if (!shot) return '<td class="missing">—</td>'
          const notes = [
            `${shot.scrollHeight}px tall`,
            shot.sideways ? `<b class="bad">sideways: ${shot.overflowing}</b>` : '',
          ]
            .filter(Boolean)
            .join(' · ')
          return `<td class="${size}"><a href="${shot.file}" target="_blank"><img src="${shot.file}" loading="lazy" alt="${screen} ${direction} ${size}"></a><p>${notes}</p></td>`
        }),
      )
      return `<tr><th><code>${mandate}</code><br>${screen}</th>${cells.join('')}</tr>`
    })
    .join('\n')

  const head = DIRECTIONS.flatMap((direction) =>
    ['desktop', 'phone'].map((size) => `<th>${direction}<br><small>${size}</small></th>`),
  ).join('')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mandate — screenshot board</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; padding: 1.5rem; font: 14px/1.5 ui-sans-serif, system-ui, sans-serif; }
  h1 { font-size: 1.4rem; margin: 0 0 .25rem; }
  .meta { color: #666; margin: 0 0 1.5rem; }
  .alerts { border-left: 4px solid #b00; padding: .5rem .75rem; margin-bottom: 1.5rem; background: #fff3f3; color: #300; }
  .alerts.clear { border-color: #0a7; background: #f1fbf7; color: #030; }
  .alerts ul { margin: .35rem 0 0; padding-left: 1.2rem; }
  table { border-collapse: collapse; width: 100%; }
  th, td { vertical-align: top; border-top: 1px solid #ccc8; padding: .6rem .4rem; }
  th { text-align: left; font-weight: 600; width: 10rem; position: sticky; left: 0; }
  td p { margin: .3rem 0 0; font-size: 11px; color: #777; }
  img { display: block; width: 100%; max-width: 420px; height: auto; border: 1px solid #0003; }
  td.phone img { max-width: 200px; }
  .missing { color: #999; }
  b.bad { color: #b00; }
  @media (prefers-color-scheme: dark) {
    body { background: #15130f; color: #eee; }
    .meta, td p { color: #aaa; }
    .alerts { background: #2a1214; color: #fdd; }
    .alerts.clear { background: #10251c; color: #dfd; }
  }
</style>
</head>
<body>
<h1>Mandate — screenshot board</h1>
<p class="meta">${shots.length} shots across ${screens.length} screens · ${DIRECTIONS.join(' and ')} · desktop 1280 and phone 390 · built ${new Date().toISOString().replace('T', ' ').slice(0, 16)}</p>

<div class="alerts ${sideways.length === 0 && tall.length === 0 ? 'clear' : ''}">
${
  sideways.length === 0 && tall.length === 0
    ? '<b>No sideways scrolling, and no screen over three phone-heights.</b>'
    : `<b>${sideways.length} screen(s) scroll sideways; ${tall.length} run over three phone-heights.</b><ul>` +
      [
        ...sideways.map((s) => `<li>sideways — ${s.mandate} ${s.screen} ${s.direction} ${s.size}: ${s.overflowing}</li>`),
        ...tall.map(
          (s) =>
            `<li>tall — ${s.mandate} ${s.screen} ${s.direction}: ${s.scrollHeight}px, ${(s.scrollHeight / s.clientHeight).toFixed(1)} screenfuls</li>`,
        ),
      ].join('\n') +
      '</ul>'
}
</div>

<table>
<thead><tr><th>screen</th>${head}</tr></thead>
<tbody>
${rows}
</tbody>
</table>
</body>
</html>
`
}

/**
 * How many browsers run at once.
 *
 * Sixteen walks, each of which plays a whole mandate to its end so the result
 * screen can be photographed — easy runs to twenty-eight meetings. Serially
 * that is over two hours, which is long enough that the board stops being
 * rebuilt every time it should be, and a board that is not current is worse
 * than no board because it is believed. Four at a time on an ordinary machine
 * is about the point where the browsers start contending for CPU rather than
 * for wall clock.
 */
const CONCURRENCY = 4

/** Run `jobs` with at most `limit` in flight, preserving nothing but results. */
async function inParallel(jobs, limit) {
  const queue = [...jobs]
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    for (let job = queue.shift(); job !== undefined; job = queue.shift()) {
      await job()
    }
  })
  await Promise.all(workers)
}

async function main() {
  rmSync(SHOTS, { recursive: true, force: true })
  mkdirSync(SHOTS, { recursive: true })

  const jobs = []
  for (const [index, mandate] of MANDATES.entries()) {
    for (const direction of DIRECTIONS) {
      for (const size of ['desktop', 'phone']) {
        // The glossary, records and about pages go on the board once per
        // direction and size rather than once per mandate: they are the same
        // three screens whichever mandate was played, and sixteen copies of
        // each would bury the mandates they sit beside.
        jobs.push(() => walk({ mandate, direction, size, standingPages: index === 0 }))
      }
    }
  }
  await inParallel(jobs, CONCURRENCY)

  // Deterministic order, because the walks no longer finish in the order they
  // started and a board whose rows reshuffled between builds would be
  // impossible to diff by eye.
  shots.sort(
    (a, b) =>
      a.mandate.localeCompare(b.mandate) ||
      a.screen.localeCompare(b.screen) ||
      a.direction.localeCompare(b.direction) ||
      a.size.localeCompare(b.size),
  )

  writeFileSync(`${OUT}/index.html`, render())
  console.log('')
  console.log(`Board written to ${OUT}/index.html — ${shots.length} shots.`)
  const sideways = shots.filter((shot) => shot.sideways)
  if (sideways.length > 0) {
    console.log(`! ${sideways.length} screen(s) scroll sideways:`)
    for (const shot of sideways) {
      console.log(`    ${shot.mandate} ${shot.screen} ${shot.direction} ${shot.size}: ${shot.overflowing}`)
    }
    process.exitCode = 1
  }
  console.log('')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
