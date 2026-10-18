/**
 * The project's first rule, checked rather than asserted.
 *
 * > 100 % statique. Aucun appel réseau pendant le jeu, une fois les fichiers
 * > statiques chargés.
 *
 * Nothing verified it. `drive.mjs` listens for `requestfailed`, which catches
 * a *broken* call and says nothing at all about a working one — so a
 * stylesheet pulled from a font CDN, an analytics beacon or a lazily fetched
 * chunk would have sailed through every tool in this repository while
 * violating the rule the project will not negotiate.
 *
 * This does two things, and the second is the one that matters.
 *
 * **It records every request a full mandate makes**, grouped by origin, so a
 * reader can see exactly what the page asks for and from whom.
 *
 * **Then it cuts the network and plays anyway.** Once the document has loaded,
 * every further request is aborted. A mandate that plays to its end with the
 * wire cut is a mandate that genuinely needs nothing — which is a far stronger
 * claim than "no request failed", and is the claim the rule actually makes.
 *
 *     npm run check:offline
 *
 * Against the deployed site rather than the local preview:
 *
 *     MANDATE_URL=https://<the deployment> npm run check:offline
 *
 * which is the version worth running after a deploy, because the rule is
 * about what the *player's* browser does and a deployment can acquire a
 * third-party request that a local preview never shows — an injected
 * analytics script, a font rewritten by a CDN, an edge worker adding a beacon.
 *
 * Exits non-zero on any third-party request, or if the game cannot be played
 * with the network cut.
 */
import {
  BASE_URL,
  VIEWPORTS,
  decideAndAdvance,
  enterFirstMeeting,
  isResult,
  open,
  openPanel,
  startMandate,
} from './drive.mjs'

/** Requests to these are the page loading itself, not the game calling out. */
function sameOrigin(url) {
  return (
    url.startsWith(BASE_URL) ||
    url.startsWith('data:') ||
    url.startsWith('blob:') ||
    url.startsWith('about:')
  )
}

function originOf(url) {
  try {
    return new URL(url).origin
  } catch {
    return url.slice(0, 24)
  }
}

async function observed() {
  const { browser, page } = await open({ viewport: VIEWPORTS.desktop })
  const requests = []
  page.on('request', (request) => requests.push(request.url()))

  try {
    await startMandate(page, { seed: 'OFFLINE', institution: 'ecb', difficulty: 'hard' })
    await enterFirstMeeting(page)
    for (let meeting = 1; meeting <= 4; meeting += 1) {
      for (const panel of ['press', 'brief', 'markets', 'prices', 'labor', 'area', 'treasury', 'desk']) {
        await openPanel(page, panel)
      }
      if ((await decideAndAdvance(page, { move: 25 })) === 'result') break
    }
    // And the standing pages, which load their own routes.
    for (const path of ['glossary', 'records', 'about']) {
      await page.goto(`${BASE_URL}/${path}`)
      await page.waitForSelector('main h1')
    }
  } finally {
    await browser.close()
  }

  const byOrigin = new Map()
  for (const url of requests) {
    const key = sameOrigin(url) ? '(this origin)' : originOf(url)
    byOrigin.set(key, (byOrigin.get(key) ?? 0) + 1)
  }
  return { requests, byOrigin }
}

async function withTheWireCut() {
  const { browser, page, context } = await open({ viewport: VIEWPORTS.desktop })
  const blocked = []
  try {
    // Load the application completely first: the rule is about what happens
    // *once the static files are loaded*, not about loading them.
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' })

    await context.route('**', (route) => {
      blocked.push(route.request().url())
      return route.abort()
    })

    // Set up by clicking, not by navigating. `startMandate` begins with a
    // `page.goto`, which is a document request and is exactly what the route
    // handler above now refuses — and a player does not navigate either: they
    // press buttons on a page that is already open. Everything below is
    // client-side routing, which issues no request at all, which is the whole
    // point of the test.
    await page.locator('[data-start]').click()
    await page.waitForSelector('text=Set up your mandate')
    await page.locator('[data-scenario="fictional"]').click()
    await page.locator('[data-institution="fed"]').click()
    await page.locator('[data-difficulty="easy"]').click()
    const seed = page.locator('#seed-input')
    await seed.fill('')
    await seed.fill('OFFLINE')
    await page.getByRole('button', { name: 'Start the mandate' }).click()
    await page.waitForSelector('button:has-text("Enter the first meeting")')
    await enterFirstMeeting(page)
    let served = 0
    for (let meeting = 1; meeting <= 40; meeting += 1) {
      if (await isResult(page)) break
      for (const panel of ['press', 'brief', 'markets', 'prices', 'desk']) {
        await openPanel(page, panel)
      }
      served = meeting
      if ((await decideAndAdvance(page, { move: 25 })) === 'result') break
    }
    const ended = await isResult(page)
    return { served, ended, blocked }
  } finally {
    await browser.close()
  }
}

async function main() {
  console.log('Observing what a mandate asks for')
  console.log('='.repeat(72))
  const { requests, byOrigin } = await observed()
  console.log(`${requests.length} requests in total:`)
  for (const [origin, count] of [...byOrigin.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(4)}  ${origin}`)
  }

  const foreign = requests.filter((url) => !sameOrigin(url))
  if (foreign.length > 0) {
    console.log('')
    console.log('! Requests that left this origin — the first rule forbids these:')
    for (const url of [...new Set(foreign)]) console.log(`    ${url}`)
    process.exitCode = 1
  }

  console.log('')
  console.log('Playing with the network cut after load')
  console.log('='.repeat(72))
  const { served, ended, blocked } = await withTheWireCut()
  console.log(`Served ${served} meetings; reached the report: ${ended}`)
  console.log(`Requests attempted and aborted after load: ${blocked.length}`)
  for (const url of [...new Set(blocked)].slice(0, 10)) console.log(`    ${url}`)

  if (!ended) {
    console.log('')
    console.log('! The mandate could not be played to its end with the network cut.')
    process.exitCode = 1
  }
  if (foreign.length === 0 && ended) {
    console.log('')
    console.log('Clean: nothing left this origin, and the whole mandate plays offline.')
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
