import type { Institution } from '../types/core.ts'
import type { SeriesDefinition, SeriesId } from '../types/observation.ts'
import { EXCHANGE, VOLATILITY } from '../config/model.ts'
import { STRESS_PENALTY_FLOOR } from '../config/scoring.ts'
import { THRESHOLDS } from '../config/thresholds.ts'

/**
 * The observable indicator series.
 *
 * The organising rule of this file is the difference between a *price* and a
 * *statistic*:
 *
 *   - Market data — the policy rate, the priced path, spreads, the exchange
 *     rate, valuations, sovereign spreads — is observed exactly and at once.
 *     It is a price, so there is nothing to estimate and nothing to revise.
 *
 *   - Official statistics and internal estimates arrive late, carry
 *     measurement error, and are revised afterwards. The output gap is the
 *     worst offender, as it is in reality: it is not measured at all, it is
 *     inferred.
 *
 * That asymmetry is the heart of the information problem. A player who reads
 * only the statistics is always looking at an economy that has already moved;
 * markets are the fast, unbiased, but noisy-in-a-different-way alternative.
 */

const BOTH: readonly Institution[] = ['fed', 'ecb']

/**
 * Every number these descriptions quote is interpolated from the constant the
 * engine actually uses. None is written out as a literal.
 *
 * A threshold stated in prose is a second source of truth, and it drifts
 * silently because nothing type-checks a sentence. The banking stress
 * indicator told players "above 50 the system is impaired" — a number no part
 * of the engine has ever known. The real bar on easy is 95, held for three
 * consecutive meetings, so a player who stopped tightening at 43 was steering
 * by a cliff that did not exist. `descriptions.test.ts` fails on any number in
 * this file's player-facing copy that no config constant accounts for.
 */

/** Neutral level of the consumer confidence survey, shared with `read`. */
const CONFIDENCE_CENTRE = 50

/** Fair value on the asset valuation index: it is a deviation measure. */
const FAIR_VALUE = 0

export const SERIES: readonly SeriesDefinition[] = [
  // ---- Prices -------------------------------------------------------------
  {
    id: 'headline_inflation',
    label: 'Headline inflation',
    unit: '% y/y',
    definition:
      'Total consumer price inflation including energy and food. This is what ' +
      'households experience, and what the public judges the institution on.',
    meaning:
      'A rise means prices are running further from the objective and the ' +
      'public is feeling it; a fall means the pressure is easing. Your ' +
      'standing is judged on this number, but it is a poor guide to where ' +
      'inflation is heading next.',
    read: (latent) => latent.inflationHeadline,
    category: 'official_statistic',
    publicationLagMeetings: 1,
    revisionLagMeetings: 2,
    baseNoiseSd: 0.25,
    baseRevisionSd: 0.2,
    decimals: 2,
    institutions: BOTH,
  },
  {
    id: 'core_inflation',
    label: 'Core inflation',
    unit: '% y/y',
    definition:
      'Consumer prices excluding energy and food. A better guide to the ' +
      'underlying trend, because it strips out the most volatile components.',
    meaning:
      'A rise means price pressure is spreading into the slow-moving parts of ' +
      'the basket, which are hard to reverse; a fall means the underlying ' +
      'trend is cooling. This is the better number to set policy on.',
    read: (latent) => latent.inflationCore,
    category: 'official_statistic',
    publicationLagMeetings: 1,
    revisionLagMeetings: 2,
    baseNoiseSd: 0.2,
    baseRevisionSd: 0.18,
    decimals: 2,
    institutions: BOTH,
  },
  {
    id: 'inflation_expectations',
    label: 'Inflation expectations, 5 years',
    unit: '%',
    definition:
      'Where surveys and swaps put inflation five years out. If this drifts ' +
      'from the target, the anchor is slipping and policy has a much harder job.',
    meaning:
      'A rise means people are starting to doubt the objective will be met, ' +
      'which makes inflation far more expensive to bring back down; a fall ' +
      'means the anchor is holding.',
    read: (latent) => latent.expectedInflationLong,
    category: 'survey',
    publicationLagMeetings: 0,
    revisionLagMeetings: 0,
    baseNoiseSd: 0.22,
    baseRevisionSd: 0,
    decimals: 2,
    institutions: BOTH,
  },
  {
    id: 'inflation_expectations_1y',
    label: 'Inflation expectations, 1 year',
    unit: '%',
    definition:
      'Where households, firms and markets expect prices to be a year from now. ' +
      'This is the number the policy rate is deflated by, so it decides whether ' +
      'a given nominal rate is actually tight or loose.',
    meaning:
      'A rise eats into your real rate: the same nominal rate becomes looser ' +
      'policy. A fall does the reverse. Read it against your own decision — a ' +
      'rise here larger than your hike means you eased.',
    read: (latent) => latent.expectedInflationShort,
    category: 'survey',
    publicationLagMeetings: 0,
    revisionLagMeetings: 0,
    baseNoiseSd: 0.3,
    baseRevisionSd: 0,
    decimals: 2,
    institutions: BOTH,
  },
  {
    id: 'neutral_rate_estimate',
    label: 'Neutral real rate, staff estimate',
    unit: '%',
    definition:
      'The real interest rate that neither stimulates nor restrains the economy. ' +
      'It cannot be observed, only estimated, and the estimate carries a wide ' +
      'error band — which is why the line between tight and loose policy is ' +
      'never as sharp as it looks.',
    meaning:
      'A higher estimate means it takes a higher real rate to restrain the ' +
      'economy, so the same policy is doing less than you thought; a lower ' +
      'one means the reverse. It moves rarely, and the error band never goes ' +
      'away.',
    read: (latent) => latent.neutralRealRate,
    category: 'internal_estimate',
    publicationLagMeetings: 0,
    revisionLagMeetings: 0,
    // Wide on purpose. Published r* estimates disagree by more than this.
    baseNoiseSd: 0.35,
    baseRevisionSd: 0,
    decimals: 2,
    institutions: BOTH,
    persistentError: true,
  },
  {
    id: 'wage_growth',
    label: 'Wage growth',
    unit: '% y/y',
    definition:
      'Negotiated and actual compensation growth. Wages above productivity ' +
      'plus target inflation put persistent pressure on core prices.',
    meaning:
      'A rise means labour costs are pushing on prices from the inside, which ' +
      'is the kind of inflation policy can actually address; a fall means ' +
      'that pressure is draining away.',
    read: (latent) => latent.wageGrowth,
    category: 'official_statistic',
    publicationLagMeetings: 2,
    revisionLagMeetings: 2,
    baseNoiseSd: 0.4,
    baseRevisionSd: 0.35,
    decimals: 2,
    institutions: BOTH,
  },
  {
    id: 'import_prices',
    label: 'Import prices',
    unit: '% y/y',
    definition:
      'Prices of imported goods at the border. The main route by which the ' +
      'exchange rate and world commodity prices reach domestic inflation.',
    meaning:
      'A rise means world costs or a weaker currency are pushing prices up ' +
      'from outside the economy; a fall means the reverse. Policy has little ' +
      'grip here — read it as a supply signal rather than something to fight.',
    read: (latent) => latent.importPriceInflation,
    category: 'official_statistic',
    publicationLagMeetings: 1,
    revisionLagMeetings: 0,
    baseNoiseSd: 0.8,
    baseRevisionSd: 0.5,
    decimals: 1,
    institutions: BOTH,
  },

  // ---- Labour -------------------------------------------------------------
  {
    id: 'unemployment',
    label: 'Unemployment rate',
    unit: '%',
    definition:
      'Share of the labour force without work and looking for it. Slow to ' +
      'turn, which is why it lags the output cycle by several quarters.',
    meaning:
      'A rise means slack is opening and the labour half of the mandate is ' +
      'deteriorating; a fall means a tightening labour market that will ' +
      'eventually show up in wages and prices.',
    read: (latent) => latent.unemployment,
    category: 'official_statistic',
    publicationLagMeetings: 1,
    revisionLagMeetings: 1,
    baseNoiseSd: 0.15,
    baseRevisionSd: 0.12,
    decimals: 2,
    institutions: BOTH,
  },
  {
    id: 'employment_growth',
    label: 'Employment momentum',
    unit: 'index',
    definition:
      'Pace of hiring, positive when employment is expanding. Published fast ' +
      'and revised heavily: the first print is the least reliable number here.',
    meaning:
      'A rise means hiring is accelerating; a fall means it is stalling. It ' +
      'arrives fast and is revised heavily, so treat the first print with ' +
      'suspicion.',
    read: (latent) => latent.employmentMomentum,
    category: 'official_statistic',
    publicationLagMeetings: 0,
    revisionLagMeetings: 2,
    baseNoiseSd: 0.55,
    baseRevisionSd: 0.7,
    decimals: 2,
    institutions: BOTH,
  },

  // ---- Growth -------------------------------------------------------------
  {
    id: 'real_growth',
    label: 'Real output growth',
    unit: '% annualised',
    definition:
      'Growth of real output. Published with a long lag and revised for years ' +
      'afterwards, so the current quarter is always a guess.',
    meaning:
      'A rise means the economy is expanding faster; a fall means it is ' +
      'slowing. It arrives so late, and is revised so much, that it usually ' +
      'only confirms what faster series told you meetings ago.',
    read: (latent) => latent.realGrowth,
    category: 'official_statistic',
    publicationLagMeetings: 2,
    revisionLagMeetings: 3,
    baseNoiseSd: 0.7,
    baseRevisionSd: 0.6,
    decimals: 2,
    institutions: BOTH,
  },
  {
    id: 'output_gap_estimate',
    label: 'Output gap estimate',
    unit: '% of potential',
    definition:
      'Staff estimate of output relative to potential. Potential output is not ' +
      'observed, so this is inferred, not measured: treat it as the least ' +
      'reliable number on the table.',
    meaning:
      'A positive and rising reading means demand is outrunning what the ' +
      'economy can supply, which pushes prices up; a negative one means spare ' +
      'capacity dragging them down. It is inferred rather than measured, so a ' +
      'small reading is close to no information at all.',
    read: (latent) => latent.outputGap,
    category: 'internal_estimate',
    publicationLagMeetings: 2,
    revisionLagMeetings: 3,
    baseNoiseSd: 1.1,
    baseRevisionSd: 0.9,
    decimals: 2,
    institutions: BOTH,
  },
  {
    id: 'consumer_confidence',
    label: 'Consumer confidence',
    unit: 'index',
    definition:
      `Survey of household sentiment, centred on ${CONFIDENCE_CENTRE}. Timely ` +
      'and forward-looking, but noisy and prone to reacting to headlines ' +
      'rather than conditions.',
    meaning:
      'A rise means households intend to spend more, supporting demand before ' +
      'any statistic records it; a fall warns of a slowdown ahead of the ' +
      'official data.',
    read: (latent) =>
      CONFIDENCE_CENTRE + latent.confidenceShock * 8 + latent.outputGap * 3,
    category: 'survey',
    publicationLagMeetings: 0,
    revisionLagMeetings: 0,
    baseNoiseSd: 2.5,
    baseRevisionSd: 0,
    decimals: 1,
    institutions: BOTH,
  },

  // ---- Policy and markets. Observed exactly: these are prices. ------------
  {
    id: 'policy_rate',
    label: 'Policy rate',
    unit: '%',
    definition: 'The rate currently in force, as set by this committee.',
    meaning:
      'Raising it tightens and lowering it loosens — but only relative to ' +
      'expected inflation. The nominal level on its own tells you nothing ' +
      'about whether policy is tight or loose.',
    read: (latent) => latent.policyRate,
    category: 'market_data',
    publicationLagMeetings: 0,
    revisionLagMeetings: 0,
    baseNoiseSd: 0,
    baseRevisionSd: 0,
    decimals: 2,
    institutions: BOTH,
  },
  {
    id: 'market_expected_rate',
    label: 'Market-implied rate, 1 year',
    unit: '%',
    definition:
      'The policy rate markets price roughly a year out. The gap against the ' +
      'current rate is what markets think this committee will do next.',
    meaning:
      'Above the current rate, markets expect you to tighten; below it, to ' +
      'ease. Meeting that path costs nothing; departing from it moves ' +
      'financial conditions the same day.',
    read: (latent) => latent.marketExpectedRate,
    category: 'market_data',
    publicationLagMeetings: 0,
    revisionLagMeetings: 0,
    baseNoiseSd: 0,
    baseRevisionSd: 0,
    decimals: 2,
    institutions: BOTH,
  },
  {
    id: 'market_volatility',
    label: 'Market volatility',
    unit: 'index',
    definition:
      `Implied volatility priced into options. It sits near ${VOLATILITY.base} ` +
      'in a calm market with no geopolitical risk priced in, and rises from ' +
      'there. The one series that reacts to a decision on the day it is taken, ' +
      'before any statistic can.',
    meaning:
      'A rise means the decision landed differently from what markets had ' +
      'priced, or that risk is building; a fall means they were expecting it. ' +
      'Surprising markets is not automatically a mistake, but it is never free.',
    read: (latent) => latent.marketVolatility,
    category: 'market_data',
    publicationLagMeetings: 0,
    revisionLagMeetings: 0,
    baseNoiseSd: 0,
    baseRevisionSd: 0,
    decimals: 1,
    institutions: BOTH,
  },
  {
    id: 'credit_spread',
    label: 'Corporate credit spread',
    unit: 'pp',
    definition:
      'Yield premium on corporate credit over the risk-free curve. Widens ' +
      'early in a downturn, which makes it one of the fastest warning signals.',
    meaning:
      'A rise means lenders are charging more for risk, tightening conditions ' +
      'without you deciding anything; a fall means credit is flowing more ' +
      'freely. It moves before any statistic does.',
    read: (latent) => latent.creditSpread,
    category: 'market_data',
    publicationLagMeetings: 0,
    revisionLagMeetings: 0,
    baseNoiseSd: 0,
    baseRevisionSd: 0,
    decimals: 2,
    institutions: BOTH,
  },
  {
    id: 'exchange_rate',
    label: 'Effective exchange rate',
    unit: 'index',
    definition:
      `Trade-weighted value of the currency; ${EXCHANGE.baseline} is the ` +
      'baseline. A stronger currency lowers import prices and tightens ' +
      'conditions for exporters.',
    meaning:
      'A rise means a stronger currency: cheaper imports, lower inflation, ' +
      'and a harder time for exporters. A fall does the reverse.',
    read: (latent) => latent.exchangeRate,
    category: 'market_data',
    publicationLagMeetings: 0,
    revisionLagMeetings: 0,
    baseNoiseSd: 0,
    baseRevisionSd: 0,
    decimals: 1,
    institutions: BOTH,
  },
  {
    id: 'asset_valuation',
    label: 'Asset valuation pressure',
    unit: 'index',
    definition:
      `Housing and equity valuations relative to fundamentals; ${FAIR_VALUE} is ` +
      'fair value. Sustained positive readings are where future financial ' +
      'stress is built.',
    meaning:
      'A rise means housing and equities are getting expensive relative to ' +
      'fundamentals, storing up financial stress for later; a fall means that ' +
      'pressure unwinding, sometimes painfully.',
    read: (latent) => latent.assetPricePressure,
    category: 'market_data',
    publicationLagMeetings: 0,
    revisionLagMeetings: 0,
    baseNoiseSd: 0,
    baseRevisionSd: 0,
    decimals: 1,
    institutions: BOTH,
  },
  {
    id: 'balance_sheet',
    label: 'Balance sheet',
    unit: '% of GDP',
    definition: "The institution's own holdings, published by the institution itself.",
    meaning:
      'A rise means holding more assets, which supports markets and eases ' +
      'conditions beyond what the policy rate does; a fall means the reverse.',
    read: (latent) => latent.balanceSheet,
    category: 'official_statistic',
    publicationLagMeetings: 0,
    revisionLagMeetings: 0,
    baseNoiseSd: 0,
    baseRevisionSd: 0,
    decimals: 1,
    institutions: BOTH,
  },

  // ---- Banking and transmission -------------------------------------------
  {
    id: 'bank_stress_proxy',
    label: 'Banking system stress',
    unit: 'index',
    definition:
      'Supervisory composite of liquidity, capital and funding conditions. ' +
      'Assembled from returns that reach the supervisor with a lag.',
    meaning:
      'A rise means banks are under strain and may pull back lending, which ' +
      'tightens conditions sharply and unpredictably. Readings above ' +
      `${STRESS_PENALTY_FLOOR} count against your financial stability record; ` +
      `supervisors start warning near ${THRESHOLDS.bankingCrisis.watchStress}, ` +
      `and a systemic crisis becomes possible as it approaches ` +
      `${THRESHOLDS.bankingCrisis.failStress} and stays there. Forgiving ` +
      'difficulties move both of those bars further out. This is the fastest ' +
      'route to ending a mandate early.',
    read: (latent) => latent.bankingStress,
    category: 'internal_estimate',
    publicationLagMeetings: 1,
    revisionLagMeetings: 1,
    baseNoiseSd: 3.5,
    baseRevisionSd: 2.5,
    decimals: 1,
    institutions: BOTH,
  },
  {
    id: 'fragmentation_spread',
    label: 'Sovereign fragmentation spread',
    unit: 'bp',
    definition:
      'Spread between the widest and narrowest euro-area sovereign yields. A ' +
      'market price, so it is exact — and it decides how much of the policy ' +
      'rate actually reaches the whole currency area.',
    meaning:
      'A rise means the policy rate is reaching some parts of the currency ' +
      'area and not others, so the same decision does less work overall; a ' +
      'fall means transmission is even.',
    read: (latent) => latent.fragmentation,
    category: 'market_data',
    publicationLagMeetings: 0,
    revisionLagMeetings: 0,
    baseNoiseSd: 0,
    baseRevisionSd: 0,
    decimals: 0,
    institutions: ['ecb'],
  },
  {
    id: 'regional_bank_stress',
    label: 'Regional banking stress',
    unit: 'index',
    definition:
      'Supervisory composite for regional and mid-sized lenders, where duration ' +
      'losses and deposit flight concentrate. An estimate, not a market price.',
    meaning:
      'A rise means smaller lenders are absorbing losses from the speed of ' +
      'your tightening; a fall means they are recovering. Here the speed of ' +
      'your moves matters more than their level.',
    read: (latent) => latent.fragmentation,
    category: 'internal_estimate',
    publicationLagMeetings: 1,
    revisionLagMeetings: 1,
    baseNoiseSd: 3.0,
    baseRevisionSd: 2.2,
    decimals: 1,
    institutions: ['fed'],
  },
]

const SERIES_BY_ID = new Map<SeriesId, SeriesDefinition>(
  SERIES.map((series) => [series.id, series]),
)

export function getSeries(id: SeriesId): SeriesDefinition | undefined {
  return SERIES_BY_ID.get(id)
}

/** Series published for a given institution. */
export function seriesFor(institution: Institution): readonly SeriesDefinition[] {
  return SERIES.filter((series) => series.institutions.includes(institution))
}

/** Series that get a fan chart in the Staff Forecasts panel. */
export const FORECAST_SERIES: readonly SeriesId[] = [
  'headline_inflation',
  'unemployment',
  'output_gap_estimate',
]
