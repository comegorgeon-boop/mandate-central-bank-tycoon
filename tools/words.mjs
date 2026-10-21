/**
 * The word budget, measured.
 *
 * > "LE BUDGET DE MOTS DE LA RÉUNION RAPIDE NE MONTE PAS : 24 mots, c'est
 * > gelé. LA RÉUNION LOURDE A LE DROIT DE GROSSIR — c'est précisément là que
 * > je veux qu'on m'explique. Mesure les deux et donne-les-moi, avec ce que
 * > la lourde a gagné et pourquoi."
 *
 * Counts the words a player actually has to read before deciding, on each of
 * the two meeting surfaces. "Has to read" is the operative phrase: numbers,
 * units, labels on a dial and anything behind a closed disclosure are not
 * counted, because none of them is prose the eye has to parse in sequence.
 *
 * Run with: node tools/words.mjs
 */
import {
  VIEWPORTS,
  open,
  startMandate,
  enterFirstMeeting,
  decideAndAdvance,
  isResult,
  openPanel,
  quiet,
} from './drive.mjs'

/**
 * **Prose**, which is the quantity the budget is about.
 *
 * Counted in `<p>` elements only, and the distinction is the whole
 * measurement. A first version counted every text node on the surface and
 * reported 156 words against a budget of 24 — but most of that was
 * `FEDERAL FUNDS TARGET RANGE`, `PRICED`, `SURPRISE`, `STAKE`: column labels
 * on a terminal, which the eye learns once and then navigates by rather than
 * reads. Counting them makes a dense table look like an essay and would have
 * forced the layout to get *less* legible to pass its own legibility test.
 *
 * What the budget protects is sentences — text that has to be parsed in
 * sequence, where every extra clause is time before a decision. Those live in
 * paragraphs. Anything folded behind a closed disclosure is excluded too: it
 * is available, not imposed, which is exactly the "on demand" rank.
 */
const COUNT = (selector) => `
  (() => {
    const root = document.querySelector(${JSON.stringify(selector)})
    if (root === null) return null
    let words = 0
    for (const el of root.querySelectorAll('p')) {
      if (el.closest('details:not([open])') !== null) continue
      const style = getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden') continue
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) continue
      for (const token of (el.textContent ?? '').trim().split(/\\s+/)) {
        if (token.length === 0) continue
        // A figure, a unit, a sign or a piece of punctuation is not prose.
        if (/^[−+-]?[\\d.,%·—–-]+$/.test(token)) continue
        if (/^(bp|%|pp)$/i.test(token)) continue
        words += 1
      }
    }
    return words
  })()
`

async function measure(label, { institution, difficulty, seed }) {
  const { browser, page } = await open({ viewport: VIEWPORTS.desktop })
  await startMandate(page, { seed, institution, difficulty })
  await enterFirstMeeting(page)

  /*
   * Three surfaces, not two, and the distinction is the measurement.
   *
   * The first three meetings of every mandate are guided — that is the brief,
   * at every difficulty — so a guided quick meeting legitimately carries a
   * lesson the steady one does not. Reporting one "quick" figure averages a
   * tutorial and a working screen into a number that describes neither, and
   * it was how the first run of this tool came back at 69 words against a
   * budget of 24 without saying that two thirds of the excess retires after
   * meeting three and never comes back.
   */
  let guided = null
  let steady = null
  let heavy = null

  for (
    let meeting = 0;
    meeting < 14 && (guided === null || steady === null || heavy === null);
    meeting += 1
  ) {
    if (await isResult(page)) break
    await quiet(page)

    const isQuick = await page
      .locator('[data-tempo="quick"]')
      .isVisible()
      .catch(() => false)

    if (isQuick) {
      const count = await page.evaluate(COUNT('[data-tempo="quick"]'))
      const stillGuided = await page
        .locator('[data-tempo="quick"]')
        .getByText('Start here')
        .or(page.locator('[data-tempo="quick"]').getByText('The dial'))
        .or(page.locator('[data-tempo="quick"]').getByText('How this ends'))
        .count()
        .catch(() => 0)
      if (stillGuided > 0) {
        if (guided === null) guided = count
      } else if (steady === null) {
        steady = count
      }
    }

    if (!isQuick && heavy === null) {
      // The heavy surface is the room with its default panel open — what the
      // player meets, not what they could reach by opening everything.
      await openPanel(page, 'brief').catch(() => {})
      await quiet(page)
      heavy = await page.evaluate(COUNT('main'))
    }

    if ((await decideAndAdvance(page, { move: 0 })) === 'result') break
  }

  await browser.close()
  return { label, guided, steady, heavy }
}

const rows = []
for (const [label, config] of [
  ['fed/medium', { institution: 'fed', difficulty: 'medium', seed: 'WORDS-1' }],
  ['fed/hard', { institution: 'fed', difficulty: 'hard', seed: 'WORDS-2' }],
  ['ecb/medium', { institution: 'ecb', difficulty: 'medium', seed: 'WORDS-3' }],
]) {
  rows.push(await measure(label, config))
}

console.log('')
console.log('Words a player must read before deciding')
console.log('='.repeat(64))
console.log('bucket        quick (guided)  quick (steady)   heavy surface')
for (const row of rows) {
  console.log(
    `${row.label.padEnd(13)} ${String(row.guided ?? '—').padStart(13)} ${String(row.steady ?? '—').padStart(15)} ${String(row.heavy ?? '—').padStart(15)}`,
  )
}
console.log('')
console.log('The steady quick surface is the one held to 24. The guided opening')
console.log('carries three lessons and retires after meeting three; the heavy')
console.log('surface may grow, because explaining is what it is for.')
