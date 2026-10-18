/**
 * Photograph the first-meeting explanation, step by step.
 *
 * It only exists on a browser that has never played, and only on the first
 * meeting of it, so it is the one screen in the game that cannot be reached by
 * navigating anywhere. This opens a clean profile and walks it.
 *
 *     node tools/guide.mjs            # both directions, desktop and phone
 */
import { mkdir, writeFile } from 'node:fs/promises'
import {
  DIRECTIONS,
  VIEWPORTS,
  enterFirstMeeting,
  open,
  startMandate,
} from './drive.mjs'

const OUT = 'captures/guide'

async function walk(direction, size) {
  const { browser, page } = await open({
    direction,
    viewport: VIEWPORTS[size],
  })
  const shots = []
  try {
    await startMandate(page, { seed: 'GUIDE', difficulty: 'easy' })
    // `enterFirstMeeting` drives `settleMeeting`, which clicks the guide
    // through to its end — so the steps are photographed from the hook rather
    // than after the fact, which is the only moment they exist.
    await page.getByRole('button', { name: 'Enter the first meeting' }).click()

    const overlay = page.locator('[data-guide-overlay]')
    await overlay.waitFor({ state: 'visible', timeout: 10_000 })

    for (let step = 1; step <= 6; step += 1) {
      const next = page.locator('[data-guide-next]')
      if (!(await next.isVisible().catch(() => false))) break
      // The component waits for the spotlighted panel to finish rising before
      // it draws; this waits for the same thing from the outside, so a shot is
      // never taken of a step that has not settled onto its anchor.
      await page.waitForTimeout(250)
      const file = `${OUT}/${direction}-${size}-step-${step}.png`
      await page.screenshot({ path: file })
      shots.push(file)
      const caption = await page
        .locator('[data-guide-overlay] p')
        .nth(1)
        .innerText()
      console.log(`  ${direction} ${size} step ${step}: ${caption}`)
      await next.click()
      await page.waitForTimeout(300)
      if (!(await overlay.isVisible().catch(() => false))) break
    }

    // And the meeting behind it, which must be usable the instant it closes.
    await page.waitForSelector('[role="tablist"]', { state: 'visible' })
    const stillThere = await overlay.isVisible().catch(() => false)
    if (stillThere) throw new Error(`${direction}/${size}: the guide did not close`)
    const file = `${OUT}/${direction}-${size}-after.png`
    await page.screenshot({ path: file })
    shots.push(file)
  } finally {
    await browser.close()
  }
  return shots
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const all = []
  for (const direction of DIRECTIONS) {
    for (const size of ['desktop', 'phone']) {
      all.push(...(await walk(direction, size)))
    }
  }

  // And the one property that matters beyond looking right: it is shown once.
  const { browser, page } = await open({ direction: 'after-hours' })
  try {
    await startMandate(page, { seed: 'GUIDE-AGAIN', difficulty: 'easy' })
    await enterFirstMeeting(page)
    await page.goto(`${process.env.MANDATE_URL ?? 'http://localhost:4173'}/`)
    await startMandate(page, { seed: 'GUIDE-AGAIN-2', difficulty: 'easy' })
    await enterFirstMeeting(page)
    const again = await page
      .locator('[data-guide-overlay]')
      .isVisible()
      .catch(() => false)
    console.log(`\nshown again on a second mandate: ${again ? 'YES — wrong' : 'no'}`)
    if (again) process.exitCode = 1
  } finally {
    await browser.close()
  }

  await writeFile(
    `${OUT}/index.html`,
    `<!doctype html><title>First meeting</title>` +
      `<style>body{margin:0;background:#1a1613;color:#e8e0d4;font:14px system-ui}` +
      `figure{margin:0 0 1.5rem}figcaption{padding:.5rem 1rem;font-weight:600}` +
      `img{display:block;width:100%;max-width:900px;margin:0 auto;border:1px solid #444}</style>` +
      `<h1 style="padding:1rem">What a meeting is — shown once</h1>` +
      all
        .map(
          (file) =>
            `<figure><figcaption>${file.split('/').pop()}</figcaption>` +
            `<img src="${file.split('/').pop()}"></figure>`,
        )
        .join(''),
  )
  console.log(`\n  ${OUT}/index.html`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
