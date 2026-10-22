/**
 * Does opening an instrument in the config actually put it on the screen?
 *
 * `config/instruments.ts` opens with the claim that instrument definitions live
 * there "so adding a tool never means editing a screen". That is a claim about
 * the interface, it has never been checked, and this pass depends on it: a
 * component was charged for at easy and medium with no instrument reachable,
 * the fix was one line of config, and the whole fix is worth nothing if the
 * desk does not render what the config opened.
 *
 * This project's recorded parade is full of exactly this shape — a gate that
 * could never fire, a verdict band comparing a pair that cannot move, a wager
 * whose payoff was unreachable code. "The config says it is available" is the
 * same kind of sentence as "the test passed".
 *
 *     node tools/instrument.mjs
 *
 * It opens an ECB mandate at each difficulty, goes to the policy desk, and
 * requires the instrument's own label to be on it — then photographs it, so
 * the claim is checkable by eye as well as by exit code. Captures land in
 * `captures/instrument/`.
 */
import { mkdir } from 'node:fs/promises'
import {
  VIEWPORTS,
  enterFirstMeeting,
  open,
  openPanel,
  quiet,
  startMandate,
} from './drive.mjs'

const OUT = 'captures/instrument'

/**
 * What must be reachable where, read as a claim rather than from the config.
 *
 * Deliberately hand-written: deriving it from `availableInstruments` would make
 * this tool agree with the configuration by construction, which is the one
 * thing it must not do. The label is the string `instruments.ts` gives for the
 * ECB, and a copy change that broke this is a result worth having.
 */
const EXPECTED = [
  { difficulty: 'easy', label: 'Transmission protection' },
  { difficulty: 'medium', label: 'Transmission protection' },
  { difficulty: 'hard', label: 'Transmission protection' },
]

async function main() {
  await mkdir(OUT, { recursive: true })
  const failures = []

  for (const direction of ['after-hours', 'papers-on-the-table']) {
    for (const { difficulty, label } of EXPECTED) {
      const { browser, page } = await open({ direction, viewport: VIEWPORTS.desktop })
      try {
        await startMandate(page, {
          seed: `INSTRUMENT-${difficulty}`,
          institution: 'ecb',
          difficulty,
        })
        await enterFirstMeeting(page)

        // The desk is behind the room on the quick surface, which is what
        // `openPanel` knows how to open. A tool that looked for the control on
        // the landing screen would report it missing at every difficulty.
        const opened = await openPanel(page, 'desk')
        if (!opened) {
          failures.push(`${direction} ecb/${difficulty}: the desk never opened`)
          continue
        }
        await quiet(page)

        /*
         * **The desk has sub-tabs, and the toolkit is not the one it opens on.**
         *
         * The first version of this tool reported the instrument ABSENT at all
         * three difficulties, including hard, where it has been available since
         * it was written. It was not absent: the desk opens on "The case", and
         * the instruments live behind "The toolkit". A tool that never clicked
         * it was reporting on a screen it had not visited — which is the
         * sentence at the top of `drive.mjs`, written after three audits made
         * the same mistake, arriving a fourth time in a tool written to check
         * that something is reachable.
         */
        const toolkit = page.locator('#panel-desk').getByRole('tab', { name: 'The toolkit' })
        if (!(await toolkit.isVisible().catch(() => false))) {
          failures.push(
            `${direction} ecb/${difficulty}: the desk has no "The toolkit" tab`,
          )
          continue
        }
        await toolkit.click()
        await quiet(page)

        const found = await page
          .locator(`#panel-desk >> text=${label}`)
          .first()
          .isVisible()
          .catch(() => false)

        const file = `${OUT}/${direction}-ecb-${difficulty}.png`
        await page.locator('#panel-desk').screenshot({ path: file })
        console.log(
          `  ${found ? 'present' : 'ABSENT '}  ecb/${difficulty}  ${direction}  ${file}`,
        )
        if (!found) {
          failures.push(
            `${direction} ecb/${difficulty}: "${label}" is open in the config and ` +
              'not on the policy desk',
          )
        }
      } finally {
        await browser.close()
      }
    }
  }

  console.log('')
  if (failures.length > 0) {
    for (const failure of failures) console.error(`  ! ${failure}`)
    console.error('')
    console.error(
      `${failures.length} instrument(s) open in the config and not on the screen.`,
    )
    process.exit(1)
  }
  console.log('Every instrument the config opens is on the desk, in both directions.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
