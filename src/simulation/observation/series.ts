import type { Institution } from '../types/core.ts'
import type { SeriesDefinition, SeriesId } from '../types/observation.ts'

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

export const SERIES: readonly SeriesDefinition[] = [
  // ---- Prices -------------------------------------------------------------
  {
    id: 'headline_inflation',
    label: 'Headline inflation',
    unit: '% y/y',
    definition:
      'Total consumer price inflation including energy and food. This is what ' +
      'households experience, and what the public judges the institution on.',
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
    id: 'wage_growth',
    label: 'Wage growth',
    unit: '% y/y',
    definition:
      'Negotiated and actual compensation growth. Wages above productivity ' +
      'plus target inflation put persistent pressure on core prices.',
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
      'Survey of household sentiment, centred on 50. Timely and forward-looking, ' +
      'but noisy and prone to reacting to headlines rather than conditions.',
    read: (latent) => 50 + latent.confidenceShock * 8 + latent.outputGap * 3,
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
    id: 'credit_spread',
    label: 'Corporate credit spread',
    unit: 'pp',
    definition:
      'Yield premium on corporate credit over the risk-free curve. Widens ' +
      'early in a downturn, which makes it one of the fastest warning signals.',
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
      'Trade-weighted value of the currency; 100 is the baseline. A stronger ' +
      'currency lowers import prices and tightens conditions for exporters.',
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
      'Housing and equity valuations relative to fundamentals; 0 is fair value. ' +
      'Sustained positive readings are where future financial stress is built.',
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
