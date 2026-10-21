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
       * This is the single most repeated defect in the project — four
       * occurrences now, twice in one pass. It is attractive every time and
       * wrong every time, because it is invisible in review: both halves look
       * correct. `text-onwood-faint` is a documented 5.3:1 against the vault
       * and `opacity-60` is an innocuous-looking dimmer, and the product is
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
       */
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'JSXAttribute[name.name="className"] > Literal[value=/(^|\\s)(text-(ink|onwood|good|bad|accent|on-)[\\w-]*)(\\s|$)/][value=/(^|\\s)opacity-(\\[[^\\]]*\\]|\\d+)(\\s|$)/]',
          message:
            'Opacity on a text element composites its colour below the ratio its token documents — this is the fourth time. Choose a quieter text token instead, or move the opacity onto a non-text element.',
        },
      ],
    },
  },
)
