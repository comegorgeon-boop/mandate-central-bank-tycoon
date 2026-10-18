/**
 * Where the historical scenarios' numbers come from.
 *
 * This script is the provenance of every figure in `docs/SCENARIOS.md` that is
 * not marked as a derivation or an approximation. It fetches the published
 * series from FRED's own CSV endpoint and from the ECB's own press-release
 * index, computes the year-on-year rates itself, and prints the tables in the
 * exact markdown shape the document carries — so a reader can re-run it and
 * diff.
 *
 * It exists because the honesty rule for these scenarios is not negotiable and
 * "I remembered the number" does not meet it. Three things it is careful about:
 *
 * - **It computes rather than quotes.** Year-on-year inflation is the twelve
 *   month ratio change of the index level, done here, from the index levels.
 *   Nothing is read off a chart.
 * - **It says what it could not get.** A series that is missing for a date
 *   prints as `—` rather than as the nearest value, because silently
 *   substituting the nearest month is how a sourced table becomes a plausible
 *   one.
 * - **It does not invent the calendar.** Meeting dates come from the
 *   institution: the Federal Reserve's own historical FOMC pages (hard-coded
 *   below from them, with the fetch URL recorded) and the ECB's press-release
 *   index (fetched).
 *
 * Run with: node tools/scenario-data.mjs [scenario-id ...]
 *
 * Network access is a *development-time* dependency only. The game itself makes
 * no network calls once its static files are loaded; what this script produces
 * is source code.
 */

import { writeFileSync } from 'node:fs'

const FRED = 'https://fred.stlouisfed.org/graph/fredgraph.csv'

/** Every series this script knows how to fetch, with what it is. */
const SERIES = {
  // ---- Modern United States ----------------------------------------------
  FEDFUNDS: 'Effective federal funds rate, monthly average, %',
  DFEDTARU: 'Federal funds target range, upper limit, daily, %',
  DFEDTARL: 'Federal funds target range, lower limit, daily, %',
  DFEDTAR: 'Federal funds target rate (pre-2008 single target), daily, %',
  CPIAUCSL: 'CPI, all urban consumers, all items, SA, index',
  CPILFESL: 'CPI, all items less food and energy, SA, index',
  PCEPI: 'PCE price index, SA, index',
  PCEPILFE: 'PCE price index less food and energy, SA, index',
  UNRATE: 'Unemployment rate, %',
  NROU: 'Natural rate of unemployment (CBO), %',
  GDPC1: 'Real gross domestic product, chained 2017 dollars, SAAR, billions',
  GDPPOT: 'Real potential gross domestic product (CBO), billions',
  GS10: '10-year Treasury constant maturity rate, monthly, %',
  T10YIE: '10-year breakeven inflation rate, daily, %',
  MICH: 'University of Michigan: inflation expectation, 1 year, %',
  AHETPI: 'Average hourly earnings, production and nonsupervisory, $',
  WALCL: 'Total assets of the Federal Reserve, weekly, millions',
  TEDRATE: 'TED spread, daily, %',
  BAMLH0A0HYM2: 'ICE BofA US high yield option-adjusted spread, daily, %',
  BAA10Y: 'Moody’s Baa corporate bond yield less 10-year Treasury, daily, %',

  // ---- Euro area ----------------------------------------------------------
  ECBMRRFR: 'ECB main refinancing operations rate, fixed rate tenders, daily, %',
  ECBDFR: 'ECB deposit facility rate, daily, %',
  CP0000EZ19M086NEST: 'HICP, all items, euro area 19, index',
  CPHPTT01EZM661N: 'HICP, all items, euro area, index (OECD)',
  LRHUTTTTEZM156S: 'Harmonised unemployment rate, euro area, %',
  IRLTLT01DEM156N: '10-year government bond yield, Germany, %',
  IRLTLT01FRM156N: '10-year government bond yield, France, %',
  IRLTLT01ITM156N: '10-year government bond yield, Italy, %',
  IRLTLT01ESM156N: '10-year government bond yield, Spain, %',
  IRLTLT01NLM156N: '10-year government bond yield, Netherlands, %',
  IRLTLT01PTM156N: '10-year government bond yield, Portugal, %',
  IRLTLT01IEM156N: '10-year government bond yield, Ireland, %',
  IRLTLT01GRM156N: '10-year government bond yield, Greece, %',

  // ---- 1929-33 ------------------------------------------------------------
  M13009USM156NNBR: 'Discount rate, Federal Reserve Bank of New York, monthly, % (NBER Macrohistory)',
  M13002US35620M156NNBR: 'Commercial paper rate, New York, monthly, % (NBER Macrohistory)',
  CPIAUCNS: 'CPI, all urban consumers, all items, not seasonally adjusted, index',
  INDPRO: 'Industrial production index',
  GNPCA: 'Real gross national product, annual, chained 2017 dollars, billions',
  M0892AUSM156SNBR: 'Unemployment rate, SA, 1929-1942 (National Industrial Conference Board, via NBER Macrohistory)',
  M1109BUSM293NNBR: 'Dow-Jones industrial stock price index, monthly (NBER Macrohistory)',
  M1476BUSM027NNBR: 'Monetary gold stock, monthly (NBER Macrohistory)',
  M14062USM027NNBR: 'Total gold reserves of Federal Reserve Banks, monthly (NBER Macrohistory)',
}

const cache = new Map()

async function series(id, { from = '1900-01-01' } = {}) {
  if (cache.has(id)) return cache.get(id)
  const url = `${FRED}?id=${id}&cosd=${from}`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${id}: HTTP ${response.status}`)
  const text = await response.text()
  const rows = text.trim().split('\n').slice(1)
  const map = new Map()
  for (const row of rows) {
    const [date, raw] = row.split(',')
    const value = Number.parseFloat(raw)
    if (Number.isFinite(value)) map.set(date, value)
  }
  if (map.size === 0) throw new Error(`${id}: no observations parsed`)
  cache.set(id, map)
  return map
}

/** The first day of the month an ISO date falls in. */
function month(date) {
  return `${date.slice(0, 7)}-01`
}

/** Shift an ISO month key by n months. */
function shiftMonths(key, n) {
  const [y, m] = key.split('-').map(Number)
  const total = y * 12 + (m - 1) + n
  return `${String(Math.floor(total / 12)).padStart(4, '0')}-${String((total % 12) + 1).padStart(2, '0')}-01`
}

/** The value for the month a date falls in, or null. */
function monthly(data, date) {
  const value = data.get(month(date))
  return value === undefined ? null : value
}

/**
 * Ten days, in milliseconds.
 *
 * The ECB announces a rate change on the Thursday and it takes effect the
 * following Wednesday. Read on the decision date itself, `asOf` therefore
 * returns the rate decided at the *previous* meeting, and the whole ECB
 * benchmark column came out one meeting behind — 0.50 against the 1.25 voted
 * on 8 September 2022, 4.00 against the 4.25 voted on 27 July 2023. The
 * Federal Reserve's changes are effective the same day, so its columns are
 * read on the day. This is the correction, and it is why the two institutions
 * are read differently.
 */
const SETTLEMENT = 10 * 86_400_000

/** The last observation at or before a date, for daily series. */
function asOf(data, date) {
  let best = null
  let bestKey = null
  for (const [key, value] of data) {
    if (key <= date && (bestKey === null || key > bestKey)) {
      bestKey = key
      best = value
    }
  }
  return best
}

/** `asOf`, a settlement period later: what a meeting decided, not inherited. */
function decidedAt(data, date) {
  return asOf(data, new Date(Date.parse(date) + SETTLEMENT).toISOString().slice(0, 10))
}

/** Year-on-year percent change of an index, computed from the levels. */
function yearOnYear(data, date) {
  const now = data.get(month(date))
  const then = data.get(shiftMonths(month(date), -12))
  if (now === undefined || then === undefined) return null
  return (now / then - 1) * 100
}

/** The quarter a date falls in, as the first day of that quarter. */
function quarter(date) {
  const [y, m] = date.split('-').map(Number)
  const q = Math.floor((m - 1) / 3) * 3 + 1
  return `${y}-${String(q).padStart(2, '0')}-01`
}

function fmt(value, digits = 2) {
  return value === null || value === undefined ? '—' : value.toFixed(digits)
}


/**
 * Print a scenario's calendar as the TypeScript literal the code carries.
 *
 * Transcribing thirty rows of four numbers by hand is a transcription error
 * waiting to be committed, and the test that parses `docs/SCENARIOS.md` would
 * catch a mismatch between the document and the code without catching a
 * mismatch between either and the series. So the calendar is *generated*: this
 * prints it, it is pasted into the scenario file, and the document's table is
 * printed from the same call.
 */
function calendarLiteral(rows) {
  const lines = ['  calendar: [']
  for (const row of rows) {
    const parts = [
      `date: '${row.date}'`,
      `label: '${row.label}'`,
      `benchmarkRate: ${row.rate}`,
    ]
    if (row.inflation !== null && row.inflation !== undefined) {
      parts.push(`actualInflation: ${row.inflation}`)
    }
    if (row.core !== null && row.core !== undefined) {
      parts.push(`actualCore: ${row.core}`)
    }
    if (row.unemployment !== null && row.unemployment !== undefined) {
      parts.push(`actualUnemployment: ${row.unemployment}`)
    }
    lines.push(`    { ${parts.join(', ')} },`)
  }
  lines.push('  ],')
  return lines.join('\n')
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** "March 17, 2021" from "2021-03-17". */
function longDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return `${MONTHS[m - 1]} ${d}, ${y}`
}

/** "August 1929" from "1929-08-01". */
function longMonth(iso) {
  const [y, m] = iso.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}

function round(value, digits = 2) {
  return value === null || value === undefined ? null : Number(value.toFixed(digits))
}

// ---------------------------------------------------------------------------
// The calendars
// ---------------------------------------------------------------------------

/**
 * FOMC meeting dates, final day of multi-day meetings.
 *
 * From the Federal Reserve's own pages:
 *   https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm
 *   https://www.federalreserve.gov/monetarypolicy/fomchistorical<year>.htm
 * Transcribed rather than scraped, because those pages render their tables in
 * a form that is not worth parsing and the lists are short enough to check by
 * eye against the source. Conference calls and unscheduled actions are
 * deliberately absent: the engine's grid has eight slots a year.
 */
const FOMC = {
  2008: ['2008-01-30', '2008-03-18', '2008-04-30', '2008-06-25', '2008-08-05', '2008-09-16', '2008-10-29', '2008-12-16'],
  2009: ['2009-01-28', '2009-03-18', '2009-04-29', '2009-06-24', '2009-08-12', '2009-09-23', '2009-11-04', '2009-12-16'],
  2010: ['2010-01-27', '2010-03-16', '2010-04-28', '2010-06-23', '2010-08-10', '2010-09-21', '2010-11-03', '2010-12-14'],
  2021: ['2021-01-27', '2021-03-17', '2021-04-28', '2021-06-16', '2021-07-28', '2021-09-22', '2021-11-03', '2021-12-15'],
  2022: ['2022-01-26', '2022-03-16', '2022-05-04', '2022-06-15', '2022-07-27', '2022-09-21', '2022-11-02', '2022-12-14'],
  2023: ['2023-02-01', '2023-03-22', '2023-05-03', '2023-06-14', '2023-07-26', '2023-09-20', '2023-11-01', '2023-12-13'],
}

/**
 * ECB monetary policy decision dates, fetched from the ECB's own
 * press-release index for the year.
 *
 * Fetched rather than transcribed because the Governing Council met monthly
 * until 2015 and every six weeks after, so the lists are long and the
 * difference between the two regimes is itself something a scenario has to
 * state. The index is HTML; what is extracted is the date immediately
 * preceding each "Monetary policy decisions" entry.
 */
async function ecbDecisions(year) {
  const url = `https://www.ecb.europa.eu/press/pr/date/${year}/html/index_include.en.html`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`ECB ${year}: HTTP ${response.status}`)
  const html = await response.text()
  const dates = new Set()
  const pattern = /Monetary policy decisions/g
  let match
  while ((match = pattern.exec(html)) !== null) {
    const before = html.slice(Math.max(0, match.index - 600), match.index)
    const found = [...before.matchAll(/(\d{4}-\d{2}-\d{2})/g)].map((m) => m[1])
    const sameYear = found.filter((d) => d.startsWith(String(year)))
    if (sameYear.length > 0) dates.add(sameYear[sameYear.length - 1])
  }
  return [...dates].sort()
}

// ---------------------------------------------------------------------------
// The scenarios
// ---------------------------------------------------------------------------

/**
 * Pick `count` meeting dates from a list, spread across the whole span.
 *
 * Where an institution held more meetings a year than the engine's eight slots
 * — the ECB met twelve times a year until 2015 — some real meetings have no
 * slot. **Which ones is not a free choice.** Taking the first `count` in order
 * was the obvious implementation and it was wrong in a way worth recording: for
 * the euro-area scenario it ran January 2010 to December 2011 and dropped the
 * whole of 2012, so the mandate ended seven months before the sentence and the
 * programme that resolved the crisis. A scenario missing the thing it is about
 * is not a scenario.
 *
 * So the engine's uniform grid is laid over the span first, and each slot takes
 * the real meeting nearest to it. The maximum drift is reported, because a
 * label that sits three weeks from the meeting it names is an approximation and
 * has to be declared as one.
 */
function nearestMeetings(all, start, count) {
  const from = all.filter((date) => date >= start)
  if (from.length === 0) return { taken: [], dropped: [], maxDrift: 0 }

  const grid = uniformGrid(month(from[0]), count)
  const taken = []
  let maxDrift = 0
  for (const slot of grid) {
    let best = null
    let bestDrift = Infinity
    for (const date of from) {
      // Never the same meeting twice: a grid denser than the real calendar
      // would otherwise label two slots with one meeting.
      if (taken.includes(date)) continue
      const drift = Math.abs(daysBetween(slot, date))
      if (drift < bestDrift) {
        bestDrift = drift
        best = date
      }
    }
    if (best === null) break
    taken.push(best)
    maxDrift = Math.max(maxDrift, bestDrift)
  }
  taken.sort()
  return { taken, dropped: from.filter((date) => !taken.includes(date)), maxDrift }
}

/**
 * The Committee's own published forecast, from the Fed's own SEP page.
 *
 * The honest measure of how hard 2021 was. There was nothing wrong with the
 * data: it arrived on time and it was accurate. What was wrong was the
 * forecast, and the forecast is a published document with a median in it, so
 * the scenario can quote a number rather than an impression.
 */
async function sep(date) {
  const url = `https://www.federalreserve.gov/monetarypolicy/fomcprojtabl${date}.htm`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`SEP ${date}: HTTP ${response.status}`)
  const html = await response.text()
  const rows = html.match(/<tr[\s\S]*?<\/tr>/g) ?? []
  const wanted = [
    'Change in real GDP',
    'Unemployment rate',
    'PCE inflation',
    'Core PCE inflation',
    'Federal funds rate',
  ]
  const out = []
  for (const row of rows) {
    const cells = (row.match(/<t[hd][\s\S]*?<\/t[hd]>/g) ?? [])
      .map((cell) => cell.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').trim())
      .filter((cell) => cell.length > 0)
    if (cells.length < 2) continue
    const label = cells[0].replace(/\d$/, '').trim()
    if (!wanted.includes(label)) continue
    // The first four numbers after the label are the medians for the three
    // projection years and the longer run.
    out.push(`  ${label.padEnd(22)} ${cells.slice(1, 5).join('  ')}`)
    // Only the first occurrence of each: the second is the previous meeting's.
    wanted.splice(wanted.indexOf(label), 1)
  }
  return out
}

/**
 * Every slot on the engine's uniform eight-a-year grid for a span, labelled
 * with the month it falls nearest.
 *
 * Eight meetings a year is one every 1.5 months, so half the slots fall
 * mid-month and have to be labelled with one month or the other. **Rounded,
 * not truncated** — and that is not a detail. Truncating from August 1929 puts
 * no slot in October 1931, which is the single month this scenario exists to
 * make playable: the month the Federal Reserve raised its discount rate twice,
 * in a depression, to defend the gold standard. Rounding puts a slot there.
 */
/** A quarterly series read at the quarter containing `date`. */
function quarterly(data, date) {
  return data.get(quarter(date)) ?? null
}

/** Output gap in percent of potential, from two quarterly levels. */
function gapPercent(actual, potential, date) {
  const q = quarter(date)
  const now = actual.get(q)
  const pot = potential.get(q)
  return now === undefined || pot === undefined || !pot ? null : (now / pot - 1) * 100
}

function uniformGrid(startMonth, count) {
  const slots = []
  for (let index = 0; index < count; index += 1) {
    slots.push(shiftMonths(startMonth, Math.round(index * 1.5)))
  }
  return slots
}

/**
 * Lebergott's unemployment estimates, annual, percent of the civilian labour
 * force.
 *
 * **Transcribed, not fetched** — the only numbers in this script's output that
 * are, and they are marked so wherever they appear. From the published
 * Lebergott series as reproduced in *Historical Statistics of the United
 * States, Colonial Times to 1970*, series D 85-86. They are here because they
 * are the canonical figures for these years and because the monthly series
 * that *can* be fetched (the National Industrial Conference Board's, via the
 * NBER Macrohistory database) disagrees with them by three points at the start
 * of the span.
 *
 * That disagreement is not a problem to be resolved. It is the scenario:
 * nobody in 1929 had either number.
 */
const LEBERGOTT = { 1929: 3.2, 1930: 8.7, 1931: 15.9, 1932: 23.6, 1933: 24.9 }

/** Days between two ISO dates. */
function daysBetween(a, b) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)
}

async function greatContraction() {
  const discount = await series('M13009USM156NNBR', { from: '1925-01-01' })
  const paper = await series('M13002US35620M156NNBR', { from: '1925-01-01' })
  const cpi = await series('CPIAUCNS', { from: '1925-01-01' })
  const indpro = await series('INDPRO', { from: '1925-01-01' })
  const unemployment = await series('M0892AUSM156SNBR', { from: '1925-01-01' })
  const dow = await series('M1109BUSM293NNBR', { from: '1925-01-01' })
  const gold = await series('M1476BUSM027NNBR', { from: '1925-01-01' })
  const gnp = await series('GNPCA', { from: '1920-01-01' })

  // Thirty slots on the uniform grid, August 1929 to April 1933 — from the
  // month the Board raised the discount rate to 6 % against stock speculation,
  // through the crash, the three banking panics, the October 1931 rise and the
  // bank holiday, to the month the gold standard was suspended. Three and
  // three-quarter years, which is exactly thirty slots at eight a year.
  const grid = uniformGrid('1929-08-01', 30)

  const lines = []
  lines.push(
    '| # | month | NY discount rate | commercial paper | CPI y/y | industrial production | unemployment: NICB | unemployment: Lebergott | Dow | gold stock $bn |',
  )
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
  grid.forEach((date, index) => {
    const year = Number(date.slice(0, 4))
    lines.push(
      `| ${index} | ${date.slice(0, 7)} | ${fmt(monthly(discount, date))} | ${fmt(monthly(paper, date))} | ` +
        `${fmt(yearOnYear(cpi, date))} | ${fmt(monthly(indpro, date), 1)} | ${fmt(monthly(unemployment, date))} | ` +
        `${fmt(LEBERGOTT[year], 1)} | ${fmt(monthly(dow, date), 1)} | ${fmt(monthly(gold, date), 2)} |`,
    )
  })

  lines.push('')
  lines.push(calendarLiteral(grid.map((date) => ({
    date,
    label: longMonth(date),
    rate: round(monthly(discount, date)),
    inflation: round(yearOnYear(cpi, date)),
    core: null,
    unemployment: round(LEBERGOTT[Number(date.slice(0, 4))], 1),
  }))))
  lines.push('')
  lines.push('Check: is October 1931 on the grid?')
  const october = grid.findIndex((date) => date.startsWith('1931-10'))
  lines.push(
    october === -1
      ? '  NO — the scenario cannot script the rise that has to be in it.'
      : `  yes, slot ${october}. Discount rate that month: ${fmt(monthly(discount, '1931-10-01'))}, ` +
        `the month before: ${fmt(monthly(discount, '1931-09-01'))}`,
  )

  // Two candidate output gaps for a period with no official national income
  // statistic, both derivations and both labelled as such.
  const trendKeys = [...indpro.keys()].filter((k) => k >= '1923-01-01' && k <= '1929-07-01')
  const trend = trendKeys.reduce((a, k) => a + indpro.get(k), 0) / trendKeys.length
  lines.push('')
  lines.push(`Industrial production, mean of 1923-01 to 1929-07: ${trend.toFixed(2)} (n=${trendKeys.length})`)
  for (const date of ['1929-08-01', '1932-07-01', '1933-03-01']) {
    const value = indpro.get(date)
    lines.push(
      `  ${date.slice(0, 7)}: ${value?.toFixed(2) ?? '—'} = ${(((value ?? 0) / trend - 1) * 100).toFixed(1)} % from that mean`,
    )
  }

  lines.push('')
  lines.push('Real GNP, annual (GNPCA). Note it begins in 1929, so no pre-crash')
  lines.push('trend can be fitted from it — the output gap for this scenario has to be')
  lines.push('a judgement, and the document says so.')
  for (const year of [1929, 1930, 1931, 1932, 1933, 1934]) {
    lines.push(`  ${year}: ${fmt(gnp.get(`${year}-01-01`), 1)}`)
  }
  const peak = gnp.get('1929-01-01')
  const trough = gnp.get('1933-01-01')
  if (peak && trough) {
    lines.push(`  peak to trough, 1929 to 1933: ${(((trough / peak) - 1) * 100).toFixed(1)} %`)
  }

  lines.push('')
  lines.push('Worst CPI year-on-year in the span, and when:')
  let worst = { date: null, value: 0 }
  for (const date of grid) {
    const value = yearOnYear(cpi, date)
    if (value !== null && value < worst.value) worst = { date, value }
  }
  lines.push(`  ${worst.date?.slice(0, 7)}: ${worst.value.toFixed(2)} %`)

  lines.push('')
  lines.push('The gold drain after Britain left the gold standard (21 September 1931):')
  for (const date of ['1931-08-01', '1931-09-01', '1931-10-01', '1931-11-01', '1931-12-01']) {
    lines.push(
      `  ${date.slice(0, 7)}: monetary gold stock ${fmt(monthly(gold, date), 2)} bn, ` +
        `FR gold reserves ${fmt(monthly(await series('M14062USM027NNBR', { from: '1925-01-01' }), date), 2)} bn, ` +
        `NY discount rate ${fmt(monthly(discount, date))}`,
    )
  }

  return lines.join('\n')
}

async function lehman() {
  const funds = await series('FEDFUNDS', { from: '2006-01-01' })
  const upper = await series('DFEDTARU', { from: '2008-01-01' })
  const target = await series('DFEDTAR', { from: '2006-01-01' })
  const cpi = await series('CPIAUCSL', { from: '2006-01-01' })
  const core = await series('CPILFESL', { from: '2006-01-01' })
  const unemployment = await series('UNRATE', { from: '2006-01-01' })
  const natural = await series('NROU', { from: '2006-01-01' })
  const gdp = await series('GDPC1', { from: '2006-01-01' })
  const potential = await series('GDPPOT', { from: '2006-01-01' })
  const long = await series('GS10', { from: '2006-01-01' })
  const breakeven = await series('T10YIE', { from: '2006-01-01' })
  const michigan = await series('MICH', { from: '2006-01-01' })
  const wages = await series('AHETPI', { from: '2006-01-01' })
  const ted = await series('TEDRATE', { from: '2006-01-01' })
  const highYield = await series('BAMLH0A0HYM2', { from: '2006-01-01' })
  const balanceSheet = await series('WALCL', { from: '2006-01-01' })

  const dates = [...FOMC[2008].filter((d) => d >= '2008-09-16'), ...FOMC[2009], ...FOMC[2010]]

  const lines = []
  lines.push(`Meetings: ${dates.length} (${dates[0]} to ${dates[dates.length - 1]})`)
  lines.push('')
  lines.push('| # | FOMC meeting | funds rate | target (upper) | CPI y/y | core CPI y/y | unemployment |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- |')
  dates.forEach((date, index) => {
    const targetHere = asOf(upper, date) ?? asOf(target, date)
    lines.push(
      `| ${index} | ${date} | ${fmt(monthly(funds, date))} | ${fmt(targetHere)} | ` +
        `${fmt(yearOnYear(cpi, date))} | ${fmt(yearOnYear(core, date))} | ${fmt(monthly(unemployment, date), 1)} |`,
    )
  })

  lines.push('')
  lines.push(calendarLiteral(dates.map((date) => ({
    date,
    label: longDate(date),
    rate: round(asOf(upper, date) ?? asOf(target, date)),
    inflation: round(yearOnYear(cpi, date)),
    core: round(yearOnYear(core, date)),
    unemployment: round(monthly(unemployment, date), 1),
  }))))

  const open = dates[0]
  lines.push('')
  lines.push(`Opening state, ${open}:`)
  lines.push(`  funds rate (monthly avg, ${month(open).slice(0, 7)}) ${fmt(monthly(funds, open))}`)
  lines.push(`  target rate as of that day            ${fmt(asOf(target, open))}`)
  lines.push(`  CPI y/y                               ${fmt(yearOnYear(cpi, open))}`)
  lines.push(`  core CPI y/y                          ${fmt(yearOnYear(core, open))}`)
  lines.push(`  unemployment                          ${fmt(monthly(unemployment, open), 1)}`)
  lines.push(`  natural rate (CBO, ${quarter(open).slice(0, 7)})     ${fmt(natural.get(quarter(open)))}`)
  const q = quarter(open)
  const gapNow = gdp.get(q)
  const potNow = potential.get(q)
  lines.push(
    `  output gap (GDPC1 ${fmt(gapNow, 3)} / GDPPOT ${fmt(potNow, 3)})  ${
      gapNow && potNow ? fmt((gapNow / potNow - 1) * 100) : '—'
    }`,
  )
  lines.push(`  10-year Treasury                      ${fmt(monthly(long, open))}`)
  lines.push(`  10-year breakeven (daily, as of)      ${fmt(asOf(breakeven, open))}`)
  lines.push(`  Michigan 1-year expectations          ${fmt(monthly(michigan, open), 1)}`)
  const wageNow = monthly(wages, open)
  const wageThen = wages.get(shiftMonths(month(open), -12))
  lines.push(
    `  wage growth (AHETPI ${fmt(wageNow)} vs ${fmt(wageThen)})  ${
      wageNow && wageThen ? fmt((wageNow / wageThen - 1) * 100) : '—'
    }`,
  )
  lines.push(`  TED spread (daily, as of)             ${fmt(asOf(ted, open))}`)
  lines.push(`  high-yield spread (daily, as of)      ${fmt(asOf(highYield, open))}`)
  lines.push(`  Fed total assets, $m (weekly, as of)  ${fmt(asOf(balanceSheet, open), 0)}`)
  lines.push('')
  lines.push('When the floor arrived, and what the balance sheet did instead:')
  for (const date of ['2008-12-16', '2009-03-18', '2010-11-03', '2010-12-14']) {
    lines.push(
      `  ${date}: target upper ${fmt(asOf(upper, date))}, Fed assets $${fmt(asOf(balanceSheet, date), 0)}m`,
    )
  }

  return lines.join('\n')
}

async function euroArea({ label, startAfter, meetings, years, openingDate }) {
  const refi = await series('ECBMRRFR', { from: '2008-01-01' })
  const deposit = await series('ECBDFR', { from: '2008-01-01' })
  const hicp = await series('CP0000EZ19M086NEST', { from: '2008-01-01' })
  const unemployment = await series('LRHUTTTTEZM156S', { from: '2008-01-01' })
  const countries = {
    DE: await series('IRLTLT01DEM156N', { from: '2008-01-01' }),
    FR: await series('IRLTLT01FRM156N', { from: '2008-01-01' }),
    IT: await series('IRLTLT01ITM156N', { from: '2008-01-01' }),
    ES: await series('IRLTLT01ESM156N', { from: '2008-01-01' }),
    NL: await series('IRLTLT01NLM156N', { from: '2008-01-01' }),
    PT: await series('IRLTLT01PTM156N', { from: '2008-01-01' }),
    IE: await series('IRLTLT01IEM156N', { from: '2008-01-01' }),
    GR: await series('IRLTLT01GRM156N', { from: '2008-01-01' }),
  }

  const all = []
  for (const year of years) all.push(...(await ecbDecisions(year)))
  all.sort()
  const { taken, dropped, maxDrift } = nearestMeetings(all, startAfter, meetings)

  const lines = []
  lines.push(`=== ${label} ===`)
  lines.push(`Governing Council monetary policy decisions found: ${all.length} across ${years.join(', ')}`)
  lines.push(`Using ${taken.length}, from ${taken[0]} to ${taken[taken.length - 1]}`)
  lines.push(`Maximum drift between a grid slot and the meeting it is labelled with: ${maxDrift} days`)
  if (dropped.length > 0) {
    lines.push(`No slot for ${dropped.length}: ${dropped.join(', ')}`)
  }
  lines.push('')
  lines.push('| # | Governing Council | refi rate | deposit rate | HICP y/y | unemployment | DE 10y | IT 10y | ES 10y | IT−DE | ES−DE |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
  taken.forEach((date, index) => {
    const de = monthly(countries.DE, date)
    const it = monthly(countries.IT, date)
    const es = monthly(countries.ES, date)
    lines.push(
      `| ${index} | ${date} | ${fmt(decidedAt(refi, date))} | ${fmt(decidedAt(deposit, date))} | ` +
        `${fmt(yearOnYear(hicp, date))} | ${fmt(monthly(unemployment, date), 1)} | ` +
        `${fmt(de)} | ${fmt(it)} | ${fmt(es)} | ` +
        `${de && it ? fmt(it - de) : '—'} | ${de && es ? fmt(es - de) : '—'} |`,
    )
  })

  lines.push('')
  lines.push(calendarLiteral(taken.map((date) => ({
    date,
    label: longDate(date),
    rate: round(decidedAt(refi, date)),
    inflation: round(yearOnYear(hicp, date)),
    core: null,
    unemployment: round(monthly(unemployment, date), 1),
  }))))

  lines.push('')
  lines.push(`Opening state, ${openingDate}:`)
  lines.push(`  refi rate      ${fmt(decidedAt(refi, openingDate))}`)
  lines.push(`  deposit rate   ${fmt(decidedAt(deposit, openingDate))}`)
  lines.push(`  HICP y/y       ${fmt(yearOnYear(hicp, openingDate))}`)
  lines.push(`  unemployment   ${fmt(monthly(unemployment, openingDate), 1)}`)
  lines.push('  10-year yields and spreads to Germany:')
  const bund = monthly(countries.DE, openingDate)
  for (const [code, data] of Object.entries(countries)) {
    const value = monthly(data, openingDate)
    lines.push(
      `    ${code} ${fmt(value)}${code === 'DE' ? '' : `  spread ${value && bund ? fmt(value - bund) : '—'}`}`,
    )
  }

  lines.push('')
  lines.push('Widest spread in the span, per country:')
  for (const [code, data] of Object.entries(countries)) {
    if (code === 'DE') continue
    let widest = { date: null, value: -Infinity }
    for (const date of taken) {
      const value = monthly(data, date)
      const bundHere = monthly(countries.DE, date)
      if (value !== null && bundHere !== null && value - bundHere > widest.value) {
        widest = { date, value: value - bundHere }
      }
    }
    lines.push(`    ${code} ${fmt(widest.value)} at ${widest.date ?? '—'}`)
  }

  return lines.join('\n')
}

async function transitoryFed() {
  const funds = await series('FEDFUNDS', { from: '2019-01-01' })
  const upper = await series('DFEDTARU', { from: '2019-01-01' })
  const cpi = await series('CPIAUCSL', { from: '2019-01-01' })
  const core = await series('CPILFESL', { from: '2019-01-01' })
  const pce = await series('PCEPI', { from: '2019-01-01' })
  const corePce = await series('PCEPILFE', { from: '2019-01-01' })
  const unemployment = await series('UNRATE', { from: '2019-01-01' })
  const natural = await series('NROU', { from: '2019-01-01' })
  const gdp = await series('GDPC1', { from: '2019-01-01' })
  const potential = await series('GDPPOT', { from: '2019-01-01' })
  const long = await series('GS10', { from: '2019-01-01' })
  const breakeven = await series('T10YIE', { from: '2019-01-01' })
  const michigan = await series('MICH', { from: '2019-01-01' })
  const wages = await series('AHETPI', { from: '2019-01-01' })

  const dates = [
    ...FOMC[2021].filter((d) => d >= '2021-03-17'),
    ...FOMC[2022],
    ...FOMC[2023].filter((d) => d <= '2023-07-26'),
  ]

  const lines = []
  lines.push(`Meetings: ${dates.length} (${dates[0]} to ${dates[dates.length - 1]})`)
  lines.push('')
  lines.push('| # | FOMC meeting | target (upper) | funds rate | CPI y/y | core CPI y/y | core PCE y/y | unemployment |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |')
  dates.forEach((date, index) => {
    lines.push(
      `| ${index} | ${date} | ${fmt(asOf(upper, date))} | ${fmt(monthly(funds, date))} | ` +
        `${fmt(yearOnYear(cpi, date))} | ${fmt(yearOnYear(core, date))} | ${fmt(yearOnYear(corePce, date))} | ` +
        `${fmt(monthly(unemployment, date), 1)} |`,
    )
  })

  lines.push('')
  lines.push(calendarLiteral(dates.map((date) => ({
    date,
    label: longDate(date),
    rate: round(asOf(upper, date)),
    inflation: round(yearOnYear(cpi, date)),
    core: round(yearOnYear(core, date)),
    unemployment: round(monthly(unemployment, date), 1),
  }))))

  const open = dates[0]
  lines.push('')
  lines.push(`Opening state, ${open}:`)
  lines.push(`  target upper                 ${fmt(asOf(upper, open))}`)
  lines.push(`  funds rate (monthly avg)     ${fmt(monthly(funds, open))}`)
  lines.push(`  CPI y/y                      ${fmt(yearOnYear(cpi, open))}`)
  lines.push(`  core CPI y/y                 ${fmt(yearOnYear(core, open))}`)
  lines.push(`  PCE y/y                      ${fmt(yearOnYear(pce, open))}`)
  lines.push(`  core PCE y/y                 ${fmt(yearOnYear(corePce, open))}`)
  lines.push(`  unemployment                 ${fmt(monthly(unemployment, open), 1)}`)
  lines.push(`  natural rate (CBO)           ${fmt(natural.get(quarter(open)))}`)
  const q = quarter(open)
  const gdpNow = gdp.get(q)
  const potNow = potential.get(q)
  lines.push(
    `  output gap, today's vintage  ${gdpNow && potNow ? fmt((gdpNow / potNow - 1) * 100) : '—'} ` +
      `(GDPC1 ${fmt(gdpNow, 1)} / GDPPOT ${fmt(potNow, 1)})`,
  )
  lines.push(`  10-year Treasury             ${fmt(monthly(long, open))}`)
  lines.push(`  10-year breakeven            ${fmt(asOf(breakeven, open))}`)
  lines.push(`  Michigan 1-year              ${fmt(monthly(michigan, open), 1)}`)
  const wageNow = monthly(wages, open)
  const wageThen = wages.get(shiftMonths(month(open), -12))
  lines.push(
    `  wage growth                  ${wageNow && wageThen ? fmt((wageNow / wageThen - 1) * 100) : '—'}`,
  )
  lines.push('')
  lines.push('Peak inflation in the span:')
  let peak = { date: null, value: -Infinity }
  for (const date of dates) {
    const value = yearOnYear(cpi, date)
    if (value !== null && value > peak.value) peak = { date, value }
  }
  lines.push(`  CPI y/y ${fmt(peak.value)} at ${peak.date}`)

  return lines.join('\n')
}

/**
 * What was believed in real time in 2021, and what happened.
 *
 * The Orphanides problem with none of 1979's excuses. In 1979 the output gap
 * was mismeasured by three and a half points and the chairman could not have
 * known; in 2021 the statistics were excellent, arrived on schedule, and the
 * Committee published a median forecast that was wrong by three points at a
 * one-year horizon. That is a different game and this is the number that says
 * so.
 *
 * ALFRED's vintage CSV endpoint is not reachable without an API key, so the
 * real-time view is taken from the Committee's own published projections
 * instead — which is better evidence anyway: a vintage of a statistic is what
 * the staff saw, while the SEP is what the Committee concluded.
 */
async function realTimeBelief() {
  const lines = []
  const corePce = await series('PCEPILFE', { from: '2019-01-01' })
  const unemployment = await series('UNRATE', { from: '2019-01-01' })
  const natural = await series('NROU', { from: '2019-01-01' })

  for (const date of ['20210317', '20211215', '20220316']) {
    lines.push('')
    lines.push(`FOMC Summary of Economic Projections, ${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}`)
    lines.push('  (medians: this year, next, the year after, longer run)')
    try {
      for (const row of await sep(date)) lines.push(row)
    } catch (error) {
      lines.push(`  FAILED: ${error.message}`)
    }
  }

  lines.push('')
  lines.push('Against what printed (core PCE, year-on-year, December of each year):')
  for (const year of [2021, 2022, 2023]) {
    lines.push(`  ${year}: ${fmt(yearOnYear(corePce, `${year}-12-01`))}`)
  }
  lines.push('')
  lines.push('Peak core PCE year-on-year, and when:')
  let peak = { date: null, value: -Infinity }
  for (const [key] of corePce) {
    if (key < '2021-01-01' || key > '2023-12-01') continue
    const value = yearOnYear(corePce, key)
    if (value !== null && value > peak.value) peak = { date: key, value }
  }
  lines.push(`  ${fmt(peak.value)} at ${peak.date?.slice(0, 7)}`)

  lines.push('')
  lines.push('How much slack the Committee thought it had, and how much there was:')
  lines.push('  SEP March 2021 longer-run unemployment rate (its own u*): see table above')
  lines.push(`  CBO natural rate, 2021 Q1, today's vintage: ${fmt(natural.get('2021-01-01'))}`)
  lines.push(`  unemployment, March 2021: ${fmt(monthly(unemployment, '2021-03-01'), 1)}`)
  lines.push(`  unemployment, December 2021: ${fmt(monthly(unemployment, '2021-12-01'), 1)}`)
  lines.push(`  unemployment, trough: ${fmt(Math.min(...[...unemployment.entries()].filter(([k]) => k >= '2022-01-01' && k <= '2023-12-01').map(([, v]) => v)), 1)}`)

  return lines.join('\n')
}

// ---------------------------------------------------------------------------

/**
 * Nixon and Burns, 1972-74.
 *
 * The one period in this game where a named living — in 1972 — politician
 * pressing a named chairman is *documented* rather than inferred, and so the
 * only one where the pressure can be put on the screen with names attached.
 *
 * Slots are **months on a uniform grid**, not FOMC meeting dates. The 1972-74
 * FOMC met roughly monthly, but this script does not carry that calendar and
 * will not invent it, so the scenario's slots are labelled as months and the
 * document says so — the same rule `greatContraction` follows for 1929.
 */
async function nixonBurns() {
  const funds = await series('FEDFUNDS', { from: '1969-01-01' })
  const cpi = await series('CPIAUCSL', { from: '1969-01-01' })
  const core = await series('CPILFESL', { from: '1969-01-01' })
  const unemployment = await series('UNRATE', { from: '1969-01-01' })
  const natural = await series('NROU', { from: '1969-01-01' })
  const gdp = await series('GDPC1', { from: '1969-01-01' })
  const potential = await series('GDPPOT', { from: '1969-01-01' })
  const long = await series('GS10', { from: '1969-01-01' })
  const wages = await series('AHETPI', { from: '1969-01-01' })

  // January 1972 to December 1974: the year of the re-election pressure and
  // the price controls, then the controls unravelling, then the oil embargo
  // and the recession. Twenty-four slots at eight a year is three years.
  const grid = uniformGrid('1972-01-01', 24)

  const lines = []
  lines.push(`Slots: ${grid.length} (${grid[0]} to ${grid[grid.length - 1]}), uniform months — NOT FOMC dates`)
  lines.push('')
  lines.push('| # | month | funds rate | CPI y/y | core CPI y/y | unemployment | natural rate | output gap % | 10y | wages y/y |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
  grid.forEach((date, index) => {
    const g = gapPercent(gdp, potential, date)
    lines.push(
      `| ${index} | ${date.slice(0, 7)} | ${fmt(monthly(funds, date))} | ` +
        `${fmt(yearOnYear(cpi, date))} | ${fmt(yearOnYear(core, date))} | ` +
        `${fmt(monthly(unemployment, date), 1)} | ${fmt(quarterly(natural, date), 2)} | ` +
        `${fmt(g, 2)} | ${fmt(monthly(long, date))} | ${fmt(yearOnYear(wages, date))} |`,
    )
  })

  const open = grid[0]
  lines.push('')
  lines.push('Opening, January 1972:')
  lines.push(`  policyRate            ${fmt(monthly(funds, open))}`)
  lines.push(`  inflationHeadline     ${fmt(yearOnYear(cpi, open))}`)
  lines.push(`  inflationCore         ${fmt(yearOnYear(core, open))}`)
  lines.push(`  unemployment          ${fmt(monthly(unemployment, open), 1)}`)
  lines.push(`  naturalUnemployment   ${fmt(quarterly(natural, open), 2)}`)
  lines.push(`  outputGap             ${fmt(gapPercent(gdp, potential, open), 2)}`)
  lines.push(`  longRate              ${fmt(monthly(long, open))}`)
  lines.push(`  wageGrowth            ${fmt(yearOnYear(wages, open))}`)
  return lines.join('\n')
}

const TASKS = {
  great_contraction_1929: greatContraction,
  lehman_2008: lehman,
  euro_crisis_2010: () =>
    euroArea({
      label: 'Euro area, 2010-2012',
      startAfter: '2010-01-01',
      meetings: 24,
      years: [2010, 2011, 2012],
      openingDate: '2010-01-14',
    }),
  transitory_fed_2021: transitoryFed,
  transitory_ecb_2021: () =>
    euroArea({
      label: 'Euro area, 2021-2023',
      startAfter: '2021-03-01',
      meetings: 20,
      years: [2021, 2022, 2023],
      openingDate: '2021-03-11',
    }),
  nixon_burns_1972: nixonBurns,
  real_time_belief: realTimeBelief,
}

async function main() {
  const wanted = process.argv.slice(2)
  const names = wanted.length > 0 ? wanted : Object.keys(TASKS)
  const out = []
  for (const name of names) {
    const task = TASKS[name]
    if (!task) {
      console.error(`Unknown: ${name}. Known: ${Object.keys(TASKS).join(', ')}`)
      process.exitCode = 1
      continue
    }
    out.push('')
    out.push('#'.repeat(78))
    out.push(`# ${name}`)
    out.push('#'.repeat(78))
    try {
      out.push(await task())
    } catch (error) {
      out.push(`FAILED: ${error.message}`)
      process.exitCode = 1
    }
  }
  out.push('')
  out.push('Series used:')
  for (const id of [...cache.keys()].sort()) {
    out.push(`  ${id.padEnd(24)} ${SERIES[id] ?? '(undocumented)'}`)
  }
  out.push('')
  out.push(`Retrieved ${new Date().toISOString().slice(0, 10)} from FRED and the ECB.`)
  const text = out.join('\n')
  console.log(text)
  writeFileSync('/tmp/scenario-data.txt', text)
}

main()
