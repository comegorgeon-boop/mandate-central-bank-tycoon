import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],

      /**
       * `opacity-*` never goes on an element that also carries a text colour.
       *
       * This is the single most repeated defect in the project — **five**
       * occurrences now. It is attractive every time and wrong every time,
       * because it is invisible in review: both halves look correct.
       * `text-onwood-faint` is a documented 5.3:1 against the vault and
       * `opacity-60` is an innocuous-looking dimmer, and the product is
       * 3.18:1, which fails AA on body text. The ratio the token promises is
       * the ratio of the token, not of the token times something else.
       *
       * The audit catches it, but the audit takes ten minutes and runs at the
       * end, which means the mistake gets *made* every time and only ever
       * caught afterwards. This is the parade: it fails in the editor, before
       * the file is saved.
       *
       * To dim something, pick a quieter token. To dim something that is not
       * read — a rosette, a seal, a guilloché band — put the opacity on the
       * SVG, which carries no text and so is not matched here.
       *
       * ## The fifth occurrence got past this rule, and the reason is the fix
       *
       * `InstrumentStepper` carried `text-ink … disabled:opacity-30` on the
       * −/+ buttons, which is this exact defect, in one `className`, and this
       * rule did not fire. The old pattern required the token to be preceded
       * by whitespace or the start of the string: `(^|\s)opacity-`. A Tailwind
       * *variant prefix* is neither, so `disabled:opacity-30` — and
       * `hover:`, `focus:`, `dark:`, `md:`, `group-hover:`, and every chain of
       * them — slipped straight through a rule written for precisely this.
       *
       * It was found by the contrast audit, at 2.3:1, on a screen the audit
       * had itself never visited until this pass. So the one defence that was
       * supposed to be a mechanism rather than a habit had a hole in it for
       * as long as it has existed, and the thing that found the hole was the
       * slow check it was written to make unnecessary.
       *
       * The pattern now allows any chain of variant prefixes before the
       * utility, on both halves — a `disabled:text-ink` paired with a bare
       * `opacity-30` is the same defect from the other side.
       */
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'JSXAttribute[name.name="className"] > Literal[value=/(^|\\s)([\\w-]+:)*(text-(ink|onwood|good|bad|accent|on-)[\\w-]*)(\\s|$)/][value=/(^|\\s)([\\w-]+:)*opacity-(\\[[^\\]]*\\]|\\d+)(\\s|$)/]',
          message:
            'Opacity on a text element composites its colour below the ratio its token documents — this is the fifth time, and the first to arrive behind a variant prefix. Choose a quieter text token instead (disabled:text-ink-faint, not disabled:opacity-30), or move the opacity onto a non-text element.',
        },
      ],
    },
  },

  /**
   * **There is one score, and no screen may show a second.**
   *
   * > "LE SCORE ENGRANGÉ EST LE SCORE. […] le joueur n'en voit plus qu'un.
   * > Deux scores qui se contredisent, c'est pire que n'importe lequel des
   * > deux."
   *
   * `calculateScore(...).score` is the old graded total. It still exists on
   * purpose — its *components* are the report's explanation and the balance
   * harnesses read them — but it is no longer a score the player is shown or
   * compared on. What made it worth a rule rather than a note is that the
   * defect was never a calculation: it was a dozen *call sites*, each
   * individually reasonable, which together meant a fourteen-year mandate
   * showed 5,437 banked beside 1,741 graded and the records page ranked on the
   * second.
   *
   * Scoped to the player's own tree. `src/simulation/dev/` and every test may
   * read it freely, because a harness comparing components is asking a
   * different question from a player reading a score.
   */
  {
    files: ['src/pages/**/*.{ts,tsx}', 'src/features/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          /*
           * Two shapes, because the first version missed most of them. The
           * common form is `entry.score.score` — a member expression whose
           * object is itself one ending in `score` — but the commonest of all
           * is the bare `score.score`, where the object is a plain identifier
           * and the first selector matched nothing. A rule that catches the
           * rarer half of a defect reads exactly like a rule that works.
           */
          selector:
            'MemberExpression[property.name="score"][object.property.name="score"], MemberExpression[property.name="score"][object.name="score"]',
          message:
            'This is the old graded total on a screen the player sees. There is one score and it is the banked one — use `theScore(state)` from simulation/scoring/theScore.ts. Two scores that contradict each other are worse than either of them.',
        },
      ],
    },
  },
)
