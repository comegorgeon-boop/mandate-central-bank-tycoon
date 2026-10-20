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
})
