import { describe, expect, it } from 'vitest'
import { ESLint } from 'eslint'

/**
 * The two lint rules that are correctness, not style, run as tests.
 *
 * ## Why this file exists
 *
 * A `useMemo` sat below an early return in `PolicyDeskPanel` for as long as
 * that file has existed. React calls hooks in order and matches them up by
 * position between renders, so a hook that is reached on some renders and
 * skipped on others desynchronises that list and React throws *Rendered fewer
 * hooks than expected*. It had never fired, because the guard above it —
 * `instrument === undefined || range === null` — is false in every
 * configuration the game ships. That is not a reason it was safe. It is the
 * exact shape of a crash that waits: harmless until the first day the
 * condition is true, and then a white screen in the middle of a mandate.
 *
 * ESLint's `react-hooks/rules-of-hooks` had been reporting it the whole time.
 * Nothing noticed, for a reason worth writing down rather than apologising
 * for: **`npm run lint` is not on the finish line.** `CLAUDE.md` lists the
 * build, the tests and the offline check, and a check that is not on the list
 * is a check that runs the day someone happens to think of it. Four of the
 * five defects in the last pass were mistakes this project had already made
 * and recorded, and the lesson written down then was that *a rule without an
 * executable check is true only until somebody breaks it*. A rule with a
 * check nobody runs is the same rule.
 *
 * So the two rules that catch crashes rather than untidiness are asserted
 * here, where `npm test` is already the gate. The rest of the lint output —
 * fast-refresh warnings, exhaustive-deps — stays advisory and stays out of
 * this file, because a test that fails on style is a test people learn to
 * skip.
 *
 * ## Why not a test that renders the broken component
 *
 * Because it would only have covered the one component. The path that
 * triggers this particular early return is unreachable without mocking the
 * instrument registry, so such a test would be a test of the mock. This
 * version covers every component in `src/`, including the ones not written
 * yet, which is the only version that makes the defect *impossible to make
 * again* rather than fixed once.
 */

/** Rules whose violation is a latent crash, not a preference. */
const FATAL = new Set([
  // A hook after an early return, inside a condition, or in a loop.
  'react-hooks/rules-of-hooks',
  // Opacity multiplied into a documented text colour. Four occurrences so
  // far; see the rule's own comment in eslint.config.js.
  'no-restricted-syntax',
])

describe('lint guards', () => {
  it(
    'has no hook-order or text-opacity violations anywhere in src/',
    async () => {
      const eslint = new ESLint()
      const results = await eslint.lintFiles(['src/**/*.{ts,tsx}'])

      const fatal = results.flatMap((result) =>
        result.messages
          .filter((message) => message.ruleId !== null && FATAL.has(message.ruleId))
          .map((message) => {
            // Trimmed to the repository-relative path by finding `/src/`
            // rather than by asking `process.cwd()`: this file compiles
            // against the app's tsconfig, which carries no node types, and
            // that is the same constraint every dev harness in
            // `simulation/dev/` is written under.
            const at = result.filePath.lastIndexOf('/src/')
            const path = at === -1 ? result.filePath : result.filePath.slice(at + 1)
            return `${path}:${message.line} [${message.ruleId}] ${message.message}`
          }),
      )

      expect(fatal).toEqual([])
    },
    // ESLint type-checks the project to run these rules, which is not fast.
    60_000,
  )

  /**
   * **The rule itself has to be checked, not just obeyed.**
   *
   * The test above passed for as long as the opacity rule has existed while
   * `InstrumentStepper` carried `text-ink … disabled:opacity-30` on both of
   * its buttons — the exact defect the rule names, in one `className`. The
   * pattern required the utility to be preceded by whitespace or the start of
   * the string, and a Tailwind variant prefix is neither, so every
   * `disabled:`, `hover:`, `focus:`, `dark:` and `md:` form was invisible to
   * it. The contrast audit found it at 2.3:1, on a screen the audit had never
   * visited before this pass, which means the mechanism written to make the
   * slow check unnecessary had been leaning on the slow check the whole time.
   *
   * So the guard needs a guard: a rule that catches nothing is
   * indistinguishable from a codebase with nothing to catch, and the only way
   * to tell them apart is to hand it something it must reject. Both forms are
   * asserted, because the variant can sit on either half.
   */
  it(
    'catches text-opacity behind a variant prefix, not only bare',
    async () => {
      const eslint = new ESLint()
      const cases = [
        // The fifth occurrence, as it was actually written.
        '<button className="text-ink disabled:opacity-30">x</button>',
        // And from the other side: a variant on the colour, bare opacity.
        '<button className="disabled:text-ink opacity-30">x</button>',
        // Chained variants, which Tailwind allows and which a pattern written
        // for one prefix would miss.
        '<button className="text-onwood group-hover:focus:opacity-50">x</button>',
      ]

      for (const source of cases) {
        const [result] = await eslint.lintText(`export const A = () => ${source}\n`, {
          filePath: 'src/__lint_probe__.tsx',
        })
        const caught = result.messages.filter(
          (message) => message.ruleId === 'no-restricted-syntax',
        )
        expect(caught, `the rule did not reject: ${source}`).not.toHaveLength(0)
      }

      // And it must not fire on the legitimate escape the rule documents:
      // opacity on an element that carries no text colour at all.
      const [clean] = await eslint.lintText(
        'export const B = () => <svg className="opacity-30" />\n',
        { filePath: 'src/__lint_probe__.tsx' },
      )
      expect(
        clean.messages.filter((message) => message.ruleId === 'no-restricted-syntax'),
      ).toHaveLength(0)
    },
    60_000,
  )
})
