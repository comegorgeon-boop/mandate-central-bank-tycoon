/**
 * Does every class name in `src/` actually exist?
 *
 * ## The failure this catches
 *
 * `text-ink-primary`, `text-ink-secondary`, `text-ink-muted` and
 * `border-edge-panel` were used ninety-seven times across one pass and **none
 * of them is a token**. The real names are `text-ink`, `text-ink-soft`,
 * `text-ink-faint` and `border-edge`.
 *
 * Tailwind emits no rule at all for an unknown colour name, so each was an
 * inert class and the element silently inherited its parent's colour. In the
 * terminal direction the inherited colour was also a terminal grey, so it
 * looked perfect. In the other direction it was 1.16:1, three hundred times
 * over, and the only thing that noticed was a ten-minute contrast audit run
 * at the very end — which is the wrong place to find a typo.
 *
 * The build passes. The tests pass. The lint passes. Nothing in the toolchain
 * objects to a class name that means nothing, because to Tailwind it is
 * indistinguishable from a class that something else defines.
 *
 * ## How it decides
 *
 * Extracts every candidate token from `className` strings in `src/`, then
 * checks each against the generated stylesheet. A token is fine if a rule
 * exists for it, if it is one of the known non-Tailwind hooks (`group`,
 * `sr-only` and friends are all real rules, so this list is short), or if it
 * carries an arbitrary value in brackets, which Tailwind always emits.
 *
 * It is deliberately *not* exhaustive about variants: `sm:col-span-2` is
 * checked as `col-span-2`. A false negative here is a missed typo; a false
 * positive is a tool people turn off.
 *
 * Run with: node tools/classes.mjs  (after npm run build)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) walk(path, out)
    else if (/\.tsx?$/.test(entry)) out.push(path)
  }
  return out
}

const cssFile = readdirSync('dist/assets').find((f) => f.endsWith('.css'))
if (cssFile === undefined) {
  console.error('No built stylesheet. Run `npm run build` first.')
  process.exit(2)
}
const css = readFileSync(join('dist/assets', cssFile), 'utf8')

/** Every class selector the stylesheet actually defines. */
const defined = new Set()
for (const match of css.matchAll(/\.((?:[\w-]|\\.)+)/g)) {
  defined.add(match[1].replace(/\\/g, ''))
}

const found = new Map()
for (const file of walk('src')) {
  const source = readFileSync(file, 'utf8')
  /*
   * Every quoted chunk inside a `className`, including the branches of a
   * ternary and the literal parts of a template string — which is why this
   * finds classes in conditionals, where most of the interesting ones live.
   *
   * The chunk has to *look* like a class list before any of it is believed.
   * Without that guard the scan walks straight into the surrounding
   * expression and reports `id`, `verdict`, `won` and `||` as dead classes,
   * which is a tool nobody will run twice.
   */
  const region = /className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([\s\S]{0,1200}?)\}\s*\n?\s*(?:>|\w+=))/g
  for (const match of source.matchAll(region)) {
    const body = match[1] ?? match[2] ?? match[3] ?? ''
    const chunks =
      match[3] === undefined ? [body] : [...body.matchAll(/[`"']([^`"']*)[`"']/g)].map((m) => m[1])

    for (const chunk of chunks) {
      // Class lists are lowercase, dashed, and contain no stray punctuation.
      if (!/^[\s\w\-/:.[\]%()#!]*$/.test(chunk)) continue

      const tokens = chunk
        .split(/\s+/)
        .filter(
          (raw) =>
            raw.length > 0 &&
            !raw.includes('[') && // arbitrary value: always emitted
            !raw.includes('$') && // interpolated: not a literal token
            /^-?[a-z][a-z0-9:/.%!-]*$/.test(raw),
        )

      /*
       * **A class list is recognised by containing at least one class.**
       *
       * Scanning the quoted chunks inside `className={…}` is what lets this
       * see the branches of a ternary, where a great deal of this codebase's
       * styling lives — and it also walks straight into the *conditions*.
       * `direction === 'flat' ? … : …` offers up `flat`; a style object
       * nearby offers `flex-end`. Both are lowercase, both look plausible,
       * and reporting them is how a tool earns a reputation for crying wolf.
       *
       * A real class list almost never consists entirely of names nothing
       * defines. So: if no token in a chunk is a known class, the chunk is
       * not a class list and none of it is believed.
       *
       * The honest cost: a chunk that is *only* a typo — a lone
       * `'text-ink-primray'` in a ternary branch — is missed. That is a
       * narrower hole than the one this closes, and it is the direction to
       * err in for a check that has to be trusted enough to stay on.
       */
      if (!tokens.some((raw) => defined.has(raw) || defined.has(raw.split(':').pop() ?? raw))) {
        continue
      }

      for (const raw of tokens) {
        if (!found.has(raw)) found.set(raw, [])
        found.get(raw).push(file)
      }
    }
  }
}

const dead = []
for (const [token, files] of found) {
  /*
   * A variant is part of the selector, not a wrapper around it.
   * `disabled:opacity-50` is emitted as `.disabled\:opacity-50:disabled`,
   * so the *bare* `opacity-50` may legitimately not exist — which is how a
   * first version of this tool reported four perfectly good classes as dead
   * and buried the real finding under them.
   */
  if (defined.has(token)) continue
  const bare = token.split(':').pop() ?? token
  if (defined.has(bare)) continue
  // Fractions and decimals are emitted under escaped selectors.
  if (/[/.]/.test(token)) continue
  dead.push({ token, files: [...new Set(files)] })
}

if (dead.length === 0) {
  console.log(`Every one of the ${found.size} class names in src/ exists.`)
  process.exit(0)
}

console.log('')
console.log('Class names with no rule in the generated stylesheet')
console.log('='.repeat(70))
for (const { token, files } of dead.sort((a, b) => b.files.length - a.files.length)) {
  console.log(`  ${token}`)
  for (const file of files.slice(0, 4)) console.log(`      ${file}`)
  if (files.length > 4) console.log(`      … and ${files.length - 4} more`)
}
console.log('')
console.log(`${dead.length} dead class name(s). Each one silently does nothing.`)
process.exitCode = 1
