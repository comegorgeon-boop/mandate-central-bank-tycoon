/**
 * Fetch and subset the three faces, once, into the repository.
 *
 * ## Why they are self-hosted
 *
 * The project's first rule is that the game makes no network call once its
 * static files are loaded, and a stylesheet from a font CDN breaks it twice
 * over: the request goes to somebody else's origin, and it goes *while the
 * player is reading*. So the faces are fetched here, at development time —
 * which is allowed, the same as `scenario-data.mjs` fetching from FRED — and
 * committed as `.woff2` files served from the same origin as everything else.
 *
 * ## Why they are subsetted
 *
 * Because a full Spectral is 120 KB a weight and this game uses about ninety
 * characters. Google's CSS API returns a subsetted face when given the exact
 * character set in `text=`, which is the cheapest correct way to do it without
 * adding `fonttools` to the toolchain for one job.
 *
 * The set below is deliberately explicit rather than a range: it is every
 * character the interface can print, and anything missing shows as a fallback
 * glyph in the browser, which is loud. Figures, the typographic minus the
 * prose uses, the arrow in the stance strip, the per-mille-adjacent symbols —
 * all of them are listed.
 *
 *     node tools/fonts.mjs
 *
 * Writes `public/fonts/*.woff2` and prints the sizes.
 */
import { mkdir, writeFile } from 'node:fs/promises'

/**
 * Every character the interface can print.
 *
 * Latin basic, the digits, and then the specific punctuation this project
 * uses — the en and em dashes, the typographic minus, the middle dot, the
 * arrow, the multiplication sign, the degree and plus-minus. A missing glyph
 * is a visible failure, so this is a list rather than a guess.
 */
const CHARSET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
  'abcdefghijklmnopqrstuvwxyz' +
  '0123456789' +
  ' !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~' +
  '£€' +
  '–—−·•…“”‘’' +
  '→←↑↓' +
  '±×÷°' +
  'éèêëàâçîïôûùüÉÈÊÀÂÇÎÔÛ'

const FACES = [
  // The display face. A serif with real contrast, for the one enormous number
  // and the headings — this is the half of the identity that stops an
  // interface reading as a template.
  { file: 'spectral-600', family: 'Spectral', weight: 600 },
  { file: 'spectral-400', family: 'Spectral', weight: 400 },
  // The working face: a grotesque with no personality of its own, which is
  // what a label wants.
  { file: 'public-sans-400', family: 'Public Sans', weight: 400 },
  { file: 'public-sans-600', family: 'Public Sans', weight: 600 },
  // Figures that line up in a column, which is most of this game.
  { file: 'ibm-plex-mono-400', family: 'IBM Plex Mono', weight: 400 },
  { file: 'ibm-plex-mono-600', family: 'IBM Plex Mono', weight: 600 },
]

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

async function fetchFace({ file, family, weight }) {
  const url =
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}` +
    `&text=${encodeURIComponent(CHARSET)}&display=swap`
  const css = await fetch(url, { headers: { 'User-Agent': UA } }).then((r) => {
    if (!r.ok) throw new Error(`${family} ${weight}: ${r.status}`)
    return r.text()
  })

  // The subsetted face comes back from `/l/font?kit=…` with **no extension**
  // — only the `format('woff2')` after it says what it is. Matching on a
  // `.woff2` suffix finds the standard-subset URLs and misses every
  // `text=`-subsetted one, which is the whole point of this script.
  const match = css.match(/url\((https:\/\/[^)]+)\)\s*format\('woff2'\)/)
  if (match === null) throw new Error(`${family} ${weight}: no woff2 in the CSS`)

  const bytes = await fetch(match[1]).then((r) => {
    if (!r.ok) throw new Error(`${family} ${weight} woff2: ${r.status}`)
    return r.arrayBuffer()
  })
  await writeFile(`public/fonts/${file}.woff2`, Buffer.from(bytes))
  return bytes.byteLength
}

async function main() {
  await mkdir('public/fonts', { recursive: true })
  let total = 0
  for (const face of FACES) {
    const size = await fetchFace(face)
    total += size
    console.log(`  ${face.file.padEnd(20)} ${(size / 1024).toFixed(1).padStart(6)} KB`)
  }
  console.log(`\n  ${'total'.padEnd(20)} ${(total / 1024).toFixed(1).padStart(6)} KB`)
  console.log(`\n  ${CHARSET.length} characters subsetted.`)
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
