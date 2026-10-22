/**
 * The figure budget, measured.
 *
 * > "ET MESURE-LE, comme on a fait pour les mots : COMBIEN DE CHIFFRES sont
 * > visibles par défaut sur un écran de téléphone ? Donne-moi le compte avant
 * > et après. On a un plafond de 60 mots ; il nous faut le même plafond pour
 * > les chiffres, et je veux qu'il soit bas."
 *
 * The sibling of `tools/words.mjs`, and the thing it measures is the one the
 * word budget cannot see. A terminal can be inside its sixty words and still
 * be a wall: *"énergie 62 %, demande 10 %, salaires 4 %, anticipations 22 %,
 * la monnaie 3 %"* is five figures and almost no prose. Drowning is not a
 * property of sentences.
 *
 * ## What counts as a figure
 *
 * A **numeral the eye has to read as a quantity**. So `8.2`, `−25 bp`, `62 %`
 * and `3.75` all count once each, and the units attached to them do not count
 * separately — `8.2 %` is one figure, not a figure and a symbol.
 *
 * Deliberately *not* counted, each for a reason:
 *
 *  - **Anything behind a closed disclosure.** Same rule as the word budget:
 *    available is not imposed, and the whole point of this pass is that
 *    opening a panel is a choice.
 *  - **Axis ticks and chart endpoints.** A sparkline's own scale labels are
 *    part of the drawing, not a reading — the figure a chart communicates is
 *    its shape. Counted them in a first version and `THE MANDATE SO FAR`
 *    alone reported eighteen.
 *  - **Anything not actually painted**: zero-size, hidden, or transparent.
 *
 * ## Phone width, because that is where drowning happens
 *
 * The desktop surface has room to arrange forty figures legibly. A phone does
 * not, and `VIEWPORTS.phone` is what both testers were holding.
 *
 * Run with: node tools/figures.mjs
 */
import {
  VIEWPORTS,
  clearBulletin,
  decideAndAdvance,
  enterFirstMeeting,
  isResult,
  open,
  openPanel,
  quiet,
  startMandate,
} from './drive.mjs'

/**
 * Count the figures actually painted inside one element.
 *
 * Walks text nodes rather than elements, because a figure and its unit are
 * usually two spans and one reading — counting elements would double most of
 * them.
 */
const COUNT = (selector) => `
  (() => {
    const roots = ${JSON.stringify(selector)}.split(',,')
      .map((one) => document.querySelector(one.trim()))
      .filter((one) => one !== null)
    if (roots.length === 0) return null

    const seen = []
    const walk = (root) => {
      const iterator = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      let node = iterator.nextNode()
      while (node !== null) {
        const parent = node.parentElement
        // Read the text *before* advancing. The first version advanced first
        // and then read \`node.textContent\`, which is the next node or null —
        // so it counted the wrong element's figures and then threw on the
        // last one. It threw, which is the lucky half: silently counting a
        // neighbour would have produced a plausible number.
        const text = node.textContent ?? ''
        node = iterator.nextNode()
        if (parent === null) continue

        // Behind a closed disclosure: available, not imposed.
        if (parent.closest('details:not([open])') !== null) continue
        // Part of a drawing rather than a reading.
        if (parent.closest('svg') !== null) continue
        if (parent.closest('[data-chart-scale]') !== null) continue

        const style = getComputedStyle(parent)
        if (style.display === 'none' || style.visibility === 'hidden') continue
        if (Number(style.opacity) === 0) continue
        const rect = parent.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) continue

        // A run of digits, with its decimal part and sign, is one figure. The
        // unit beside it is not a second one.
        const matches = text.match(/[−+-]?\\d[\\d.,]*/g)
        if (matches !== null) {
          for (const match of matches) seen.push(match)
        }
      }
    }
    for (const root of roots) walk(root)
    return { count: seen.length, figures: seen }
  })()
`

const BUCKETS = [
  { institution: 'fed', difficulty: 'medium' },
  { institution: 'fed', difficulty: 'hard' },
  { institution: 'ecb', difficulty: 'medium' },
]

/**
 * The ceiling on the default phone surface.
 *
 * > "il nous faut le même plafond pour les chiffres, et je veux qu'il soit
 * > bas."
 *
 * **Twelve.** Derived rather than picked: the default screen is meant to carry
 * the order line, three readings, the dial and what the move buys. That is
 * three gauge values, three distances, the rate now, the rate after, the move
 * itself, and two figures in the consequence line — twelve, with nothing
 * spare. Anything above it is something that has not been folded yet.
 */
const CAP = 12

async function measure({ institution, difficulty }) {
  const { browser, page } = await open({
    direction: 'after-hours',
    viewport: VIEWPORTS.phone,
  })
  let steady = null
  let heavy = null

  try {
    await startMandate(page, { seed: 'FIGURES', institution, difficulty })
    await enterFirstMeeting(page)

    for (let meeting = 0; meeting < 14 && (steady === null || heavy === null); meeting += 1) {
      if (await isResult(page)) break
      await clearBulletin(page)
      await quiet(page)

      const isQuick = await page
        .locator('[data-tempo="quick"]')
        .isVisible()
        .catch(() => false)

      if (isQuick && steady === null) {
        // The guided opening carries three extra lessons and retires; what the
        // cap is about is the surface a player sees for the rest of the
        // mandate, which is the same split `words.mjs` makes.
        const guided = await page
          .locator('[data-tempo="quick"]')
          .getByText('Start here')
          .or(page.locator('[data-tempo="quick"]').getByText('The dial'))
          .or(page.locator('[data-tempo="quick"]').getByText('How this ends'))
          .count()
          .catch(() => 0)
        if (guided === 0) {
          steady = await page.evaluate(
            COUNT('[data-order],,[data-aim],,[data-tempo="quick"]'),
          )
        }
      }

      if (!isQuick && heavy === null) {
        await openPanel(page, 'brief').catch(() => {})
        await quiet(page)
        heavy = await page.evaluate(COUNT('main'))
      }

      if ((await decideAndAdvance(page, { move: 0 })) === 'result') break
    }
  } finally {
    await browser.close()
  }

  return { steady, heavy }
}

async function main() {
  const rows = []
  for (const bucket of BUCKETS) {
    const label = `${bucket.institution}/${bucket.difficulty}`
    process.stderr.write(`  measuring ${label}…\n`)
    const { steady, heavy } = await measure(bucket)
    rows.push({ label, steady, heavy })
  }

  console.log('')
  console.log('Figures visible before deciding, on a phone')
  console.log('='.repeat(64))
  console.log(
    `${'bucket'.padEnd(14)}${'default screen'.padStart(15)}${'the room'.padStart(12)}`,
  )
  for (const row of rows) {
    console.log(
      row.label.padEnd(14) +
        String(row.steady?.count ?? '—').padStart(15) +
        String(row.heavy?.count ?? '—').padStart(12),
    )
  }

  console.log('')
  console.log(`The default screen is capped at ${CAP}. The room may carry what it likes:`)
  console.log('opening it is a choice, and explaining is what it is for.')
  console.log('')
  console.log('What is on the default screen, in order:')
  for (const row of rows) {
    if (row.steady === null) continue
    console.log(`  ${row.label}: ${row.steady.figures.join('  ')}`)
  }

  const over = rows.filter((row) => (row.steady?.count ?? 0) > CAP)
  console.log('')
  if (over.length > 0) {
    for (const row of over) {
      console.log(
        `  OVER CAP: ${row.label} shows ${row.steady.count} figures, cap ${CAP}`,
      )
    }
    process.exitCode = 1
  } else {
    console.log('Every default screen is inside the cap.')
  }
  console.log('')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
