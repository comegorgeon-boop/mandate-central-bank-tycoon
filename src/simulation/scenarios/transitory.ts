import type { Scenario, ScenarioEvent } from '../types/scenario.ts'

/**
 * 2021-23, from two seats.
 *
 * One shock, two institutions, two mandates — and they are in the same file
 * because the point is the comparison. The Federal Reserve and the ECB faced
 * the same pandemic reopening, the same supply chains and the same energy
 * market, with the same excellent statistics arriving on schedule, and they
 * were both wrong in the same direction and by about the same amount. If the
 * two were in separate files the shared events would drift apart and the
 * comparison would stop being a comparison.
 *
 * What differs is what each was wrong *about*, and the scenarios differ in
 * exactly that: the Federal Reserve's shock is mostly demand, arriving through
 * three rounds of transfers into an economy that could not spend them on
 * services; the ECB's is mostly imported, arriving through a gas price that
 * went up by a factor of ten in a war on its own continent. One of those a
 * central bank can do something about.
 *
 * ## Why this period is hard, given the data were good
 *
 * The honest difficulty of 2021 is not noise and not lag. It is that the
 * forecast was wrong, publicly, by three points, in both institutions' own
 * published projections. From the Federal Reserve's Summary of Economic
 * Projections of 17 March 2021, the Committee's own medians:
 *
 *   | | 2021 | 2022 | 2023 | longer run |
 *   | PCE inflation | 2.4 | 2.0 | 2.1 | 2.0 |
 *   | core PCE | 2.2 | 2.0 | 2.1 | — |
 *   | unemployment | 4.5 | 3.9 | 3.5 | 4.0 |
 *   | federal funds rate | 0.1 | 0.1 | 0.1 | 2.5 |
 *
 * Core PCE printed 5.08 % in December 2021 and 5.07 % in December 2022, and
 * peaked at 5.64 % in September 2022. The Committee's own median for 2022,
 * published nine months before it began, was 2.0.
 *
 * So the measurement regime of these two scenarios has almost no noise in it,
 * and the difficulty lives in two other places: a published output gap biased
 * toward slack (the Committee's own longer-run unemployment rate was 4.0
 * against the 4.45 the CBO now estimates for 2021, which is 0.45 points of
 * labour-market slack that was not there), and a forecast fan centred on the
 * wrong number. That is a scenario about judgement rather than eyesight, and
 * it is the only one in the file that is.
 */

/** Sub-steps in one inter-meeting interval. */
const ONE_MEETING = 4
const TWO_MEETINGS = 8
const THREE_MEETINGS = 12

/**
 * What happened to both of them, on the same dates.
 *
 * Shared, with the sizes differing per institution where the shock genuinely
 * differed — the gas price is in the euro-area list at four times the size it
 * has in the American one, because that is the ratio of what happened.
 */
const REOPENING: ScenarioEvent = {
  meetingIndex: 2,
  id: 'reopening_bottleneck',
  family: 'supply_chain',
  major: true,
  date: '2021-06-16',
  title: 'Everything at once, and nothing in stock',
  newswire:
    'Container rates from Shanghai to Rotterdam are five times their ' +
    'pre-pandemic level and ships are queuing off Los Angeles. Semiconductor ' +
    'lead times have gone past twenty weeks and vehicle assembly lines are ' +
    'idle for want of them; used car prices have risen by a third in a year. ' +
    'Demand that could not be spent on services for fifteen months is being ' +
    'spent on goods instead, and the goods are not there.',
  immediate: [
    { variable: 'supplyShock', delta: 1.4 },
    { variable: 'importPriceInflation', delta: 5.5 },
    { variable: 'demandShock', delta: 1.2 },
  ],
  delayed: [
    {
      delaySteps: ONE_MEETING,
      effects: [
        { variable: 'supplyShock', delta: 0.7 },
        { variable: 'importPriceInflation', delta: 3.0 },
      ],
    },
    {
      delaySteps: THREE_MEETINGS,
      effects: [{ variable: 'supplyShock', delta: 0.5 }],
    },
  ],
}

const UKRAINE_FED: ScenarioEvent = {
  meetingIndex: 8,
  id: 'invasion_2022',
  family: 'geopolitical',
  major: true,
  date: '2022-03-16',
  title: 'War, and the commodities that come from there',
  newswire:
    'Russian forces entered Ukraine on the twenty-fourth of February. Brent ' +
    'went through a hundred and thirty dollars in the first week; wheat, ' +
    'fertiliser, nickel and neon are all off their usual sources. For an ' +
    'economy that produces its own energy this is a terms-of-trade shock ' +
    'with two signs, and the one that shows up first is the price at the ' +
    'pump.',
  immediate: [
    { variable: 'supplyShock', delta: 1.1 },
    { variable: 'importPriceInflation', delta: 6.0 },
    { variable: 'geopoliticalRisk', delta: 28 },
    { variable: 'marketVolatility', delta: 12 },
  ],
  delayed: [
    { delaySteps: ONE_MEETING, effects: [{ variable: 'supplyShock', delta: 0.4 }] },
    {
      delaySteps: THREE_MEETINGS,
      effects: [
        { variable: 'supplyShock', delta: -0.9 },
        { variable: 'importPriceInflation', delta: -4.0 },
      ],
    },
  ],
}

const UKRAINE_ECB: ScenarioEvent = {
  ...UKRAINE_FED,
  meetingIndex: 8,
  date: '2022-03-10',
  title: 'War on the continent, and the gas stops',
  newswire:
    'Russian forces entered Ukraine on the twenty-fourth of February. The ' +
    'area imported about forty per cent of its gas from Russia; front-month ' +
    'contracts have gone to several times anything in the series’ history ' +
    'and the forward curve is pricing a winter with less of it. This is an ' +
    'imported cost shock on a scale no instrument this institution holds can ' +
    'offset, and it arrives as a transfer of income out of the area.',
  immediate: [
    // Sized against the wedge that actually opened: area headline peaked at
    // 10.62 % with core near 5, so the supply disturbance at the peak was
    // about 2.3 in this model's units — and the autumn 2021 gas event is
    // already carrying most of it. The first version put 2.6 here on top of
    // that and took the modelled peak to 16.5 %.
    { variable: 'supplyShock', delta: 1.5 },
    { variable: 'importPriceInflation', delta: 11.0 },
    { variable: 'geopoliticalRisk', delta: 38 },
    { variable: 'marketVolatility', delta: 16 },
    { variable: 'confidenceShock', delta: -1.2 },
    { variable: 'fragmentation', delta: 45 },
  ],
  delayed: [
    {
      delaySteps: ONE_MEETING,
      effects: [
        { variable: 'supplyShock', delta: 0.6 },
        { variable: 'importPriceInflation', delta: 4.0 },
        { variable: 'outputGap', delta: -1.0 },
      ],
    },
    {
      delaySteps: THREE_MEETINGS,
      effects: [
        { variable: 'supplyShock', delta: -1.0 },
        { variable: 'importPriceInflation', delta: -7.0 },
      ],
    },
  ],
}

const FED_EVENTS: readonly ScenarioEvent[] = [
  {
    meetingIndex: 0,
    id: 'arp_2021',
    family: 'fiscal',
    major: false,
    date: '2021-03-17',
    title: 'The third programme is signed',
    newswire:
      'One point nine trillion dollars, signed last week: fourteen hundred ' +
      'dollars a person, extended unemployment supplements, and aid to the ' +
      'states. It follows two trillion in March 2020 and nine hundred ' +
      'billion in December. Household deposits are about two trillion above ' +
      'their pre-pandemic trend. The fiscal arithmetic of this mandate was ' +
      'decided before its first meeting.',
    immediate: [
      { variable: 'fiscalImpulse', delta: 2.8 },
      { variable: 'debtPressure', delta: 9 },
      { variable: 'confidenceShock', delta: 1.0 },
    ],
    delayed: [
      {
        delaySteps: ONE_MEETING,
        effects: [
          { variable: 'demandShock', delta: 1.8 },
          { variable: 'outputGap', delta: 1.4 },
        ],
      },
      { delaySteps: TWO_MEETINGS, effects: [{ variable: 'demandShock', delta: 0.9 }] },
    ],
  },
  REOPENING,
  {
    meetingIndex: 5,
    id: 'framework_under_strain',
    family: 'communication',
    major: false,
    date: '2021-11-03',
    title: 'The word is retired',
    newswire:
      'Headline inflation printed 6.9 % in October and core 5.0 %. The ' +
      'description of the rise as transitory has been dropped from the ' +
      'official language, and the pace at which asset purchases are being ' +
      'reduced has been doubled. The framework adopted in August 2020 — ' +
      'which committed this institution to making up past shortfalls rather ' +
      'than pre-empting overshoots — has not been revisited.',
    immediate: [
      { variable: 'expectedInflationShort', delta: 0.5 },
      { variable: 'credibility', delta: -5 },
      { variable: 'anchoring', delta: -0.07 },
      { variable: 'marketExpectedRate', delta: 0.4 },
    ],
    delayed: [
      { delaySteps: TWO_MEETINGS, effects: [{ variable: 'expectedInflationLong', delta: 0.15 }] },
    ],
  },
  UKRAINE_FED,
  {
    meetingIndex: 13,
    id: 'banking_strain_2022',
    family: 'market_cycle',
    major: false,
    date: '2022-11-02',
    title: 'What four hundred basis points in eight months does',
    newswire:
      'The securities portfolios banks bought at 2020 yields are carrying ' +
      'unrealised losses in the hundreds of billions. A pension system on ' +
      'another continent nearly failed its collateral calls in September and ' +
      'needed its own central bank to buy gilts. Nothing has broken here. ' +
      'The pace of the tightening is now itself a financial stability ' +
      'question, and it is being asked in public.',
    immediate: [
      { variable: 'bankingStress', delta: 13 },
      { variable: 'creditSpread', delta: 0.4 },
      { variable: 'marketVolatility', delta: 9 },
      { variable: 'assetPricePressure', delta: -8 },
    ],
    delayed: [
      { delaySteps: TWO_MEETINGS, effects: [{ variable: 'creditGrowth', delta: -1.8 }] },
    ],
  },
  {
    meetingIndex: 15,
    id: 'goods_unwind_2023',
    family: 'supply_chain',
    major: false,
    date: '2023-02-01',
    title: 'The bottleneck clears, and goods prices fall',
    newswire:
      'Container rates are back where they were in 2019 and the queue off ' +
      'Los Angeles is gone. Semiconductor lead times have halved. Used car ' +
      'prices have fallen for six months. Goods inflation, which was the ' +
      'whole story in 2021, has turned negative; services and shelter are ' +
      'what is left, and they move slowly. Most of this would have happened ' +
      'with any policy rate.',
    immediate: [
      { variable: 'supplyShock', delta: -1.6 },
      { variable: 'importPriceInflation', delta: -7.0 },
    ],
    delayed: [
      {
        delaySteps: ONE_MEETING,
        effects: [
          { variable: 'supplyShock', delta: -0.8 },
          { variable: 'importPriceInflation', delta: -4.0 },
        ],
      },
      {
        delaySteps: TWO_MEETINGS,
        effects: [{ variable: 'supplyShock', delta: -0.4 }],
      },
    ],
  },
  {
    meetingIndex: 16,
    id: 'bank_runs_2023',
    family: 'banking_failure',
    major: true,
    date: '2023-03-22',
    title: 'Three banks in eleven days',
    newswire:
      'A bank with two hundred billion in assets lost a quarter of its ' +
      'deposits in a day and was closed on the Friday; two others followed. ' +
      'All three had funded long securities with uninsured deposits and the ' +
      'deposits left at the speed of a phone. A new facility is lending ' +
      'against those securities at par rather than at market. Deposits are ' +
      'moving from small banks to large ones and to money funds.',
    immediate: [
      { variable: 'bankingStress', delta: 27 },
      { variable: 'creditSpread', delta: 0.8 },
      { variable: 'marketVolatility', delta: 19 },
      { variable: 'financialShock', delta: 1.5 },
    ],
    delayed: [
      {
        delaySteps: ONE_MEETING,
        effects: [
          { variable: 'creditGrowth', delta: -3.0 },
          { variable: 'demandShock', delta: -0.8 },
        ],
      },
      { delaySteps: TWO_MEETINGS, effects: [{ variable: 'bankingStress', delta: -14 }] },
    ],
  },
]

const ECB_EVENTS: readonly ScenarioEvent[] = [
  {
    meetingIndex: 0,
    id: 'pepp_recalibration',
    family: 'communication',
    major: false,
    date: '2021-03-11',
    title: 'The purchases are stepped up, not cut',
    newswire:
      'Area yields have risen with American ones since January and the ' +
      'council has decided to conduct purchases under the pandemic ' +
      'programme at a significantly higher pace over the coming quarter. ' +
      'The deposit rate stays at minus a half, where it has been since ' +
      'September 2019. Inflation is 1.3 %. The recovery fund agreed last ' +
      'summer has not yet disbursed.',
    immediate: [
      { variable: 'fragmentation', delta: -20 },
      { variable: 'termPremium', delta: -0.2 },
      { variable: 'marketExpectedRate', delta: -0.1 },
    ],
    delayed: [
      { delaySteps: TWO_MEETINGS, effects: [{ variable: 'creditGrowth', delta: 0.7 }] },
    ],
  },
  { ...REOPENING, meetingIndex: 2, date: '2021-06-10' },
  {
    meetingIndex: 5,
    id: 'gas_autumn_2021',
    family: 'energy_commodity',
    major: true,
    date: '2021-10-28',
    title: 'The gas price, before the war',
    newswire:
      'European gas has gone from about twenty euro a megawatt hour in ' +
      'spring to over a hundred, on low storage, low wind and pipeline flows ' +
      'that are being delivered to contract and not a unit more. Electricity ' +
      'follows it by construction. Headline inflation is 4.1 % and the ' +
      'energy component is a little over half of it. Core is 2.0 %.',
    // Sized so that this and the war event together produce the wedge that
    // actually opened — area headline 10.62 % against a core near 5 — rather
    // than twice it. Each looks reasonable alone; the pair did not.
    immediate: [
      { variable: 'supplyShock', delta: 1.0 },
      { variable: 'importPriceInflation', delta: 7.0 },
      { variable: 'geopoliticalRisk', delta: 14 },
    ],
    delayed: [
      {
        delaySteps: ONE_MEETING,
        effects: [
          { variable: 'supplyShock', delta: 0.5 },
          { variable: 'importPriceInflation', delta: 3.0 },
        ],
      },
    ],
  },
  UKRAINE_ECB,
  {
    meetingIndex: 12,
    id: 'tpi_2022',
    family: 'exchange_rate',
    major: true,
    date: '2022-09-08',
    title: 'The first rise in eleven years, and the tool that had to come with it',
    newswire:
      'The deposit rate left negative territory in July for the first time ' +
      'since 2014 and has gone up by seventy-five basis points today. The ' +
      'Italian spread to Germany widened by eighty basis points in the ' +
      'fortnight after the first rise was trailed, and an unscheduled ' +
      'council meeting in June produced an instrument against it: purchases ' +
      'of a member’s debt, unlimited in principle, for countries whose ' +
      'policies are judged sound. One rate cannot be raised in this area ' +
      'without a second instrument holding it together.',
    immediate: [
      { variable: 'fragmentation', delta: -70 },
      { variable: 'marketVolatility', delta: -6 },
      { variable: 'credibility', delta: 4 },
    ],
    delayed: [
      { delaySteps: TWO_MEETINGS, effects: [{ variable: 'fragmentation', delta: -30 }] },
    ],
  },
  {
    meetingIndex: 14,
    id: 'gas_collapse_2023',
    family: 'energy_commodity',
    major: true,
    date: '2022-12-15',
    title: 'The gas price gives it all back',
    newswire:
      'Storage went into the winter full, the winter was mild, liquefied ' +
      'cargoes were bought at any price and industry simply used less. Gas ' +
      'has fallen from over three hundred euro a megawatt hour in August to ' +
      'under eighty, and the forward curve is lower still. Electricity is ' +
      'following. The energy component that was more than half of this ' +
      'inflation is about to subtract from it for a year, and none of that ' +
      'is anything this institution did.',
    immediate: [
      { variable: 'supplyShock', delta: -1.5 },
      { variable: 'importPriceInflation', delta: -10.0 },
      { variable: 'geopoliticalRisk', delta: -12 },
    ],
    delayed: [
      {
        delaySteps: ONE_MEETING,
        effects: [
          { variable: 'supplyShock', delta: -0.7 },
          { variable: 'importPriceInflation', delta: -5.0 },
        ],
      },
      {
        delaySteps: TWO_MEETINGS,
        effects: [
          { variable: 'supplyShock', delta: -0.3 },
          { variable: 'importPriceInflation', delta: -2.0 },
        ],
      },
    ],
  },
  {
    meetingIndex: 17,
    id: 'credit_suisse_2023',
    family: 'banking_failure',
    major: true,
    date: '2023-05-04',
    title: 'A global bank is married off over a weekend',
    newswire:
      'Three American banks failed in March and a Swiss one with a hundred ' +
      'and sixty years of history was merged into its rival over a weekend, ' +
      'with sixteen billion of its subordinated debt written to zero and its ' +
      'shareholders paid. Bank funding costs across the area went up with it ' +
      'and have come most of the way back. The council raised by twenty-five ' +
      'basis points today, down from fifty.',
    immediate: [
      { variable: 'bankingStress', delta: 22 },
      { variable: 'creditSpread', delta: 0.7 },
      { variable: 'marketVolatility', delta: 16 },
      { variable: 'fragmentation', delta: 30 },
    ],
    delayed: [
      {
        delaySteps: ONE_MEETING,
        effects: [
          { variable: 'creditGrowth', delta: -2.6 },
          { variable: 'bankingStress', delta: -10 },
        ],
      },
    ],
  },
]

/** The measurement regime both halves share. See the note at the top. */
const GOOD_DATA_WRONG_FORECAST = {
  // The best statistics in the file, and they should be: monthly CPI and
  // unemployment on schedule, quarterly accounts, revisions that are small by
  // any historical standard. Nothing here is the difficulty.
  observationNoiseScale: 0.75,
  revisionScale: 0.9,
  missingObservationProbability: 0,
  publicationLagRelief: 0,
  // Wide, and this is where the difficulty lives. The fan is not noisy because
  // the data are noisy; it is wide because the structural relationship between
  // slack and prices was behaving in a way no forecast in either institution
  // had in its distribution. A fan that was narrow and wrong would be the
  // actual 2021 and would also be unplayable.
  forecastUncertaintyScale: 1.8,
  ratePassThrough: 0,
  ratePassThroughEndsAt: 0,
}

/**
 * Transitory, 2021-23: the Federal Reserve.
 *
 * Twenty meetings, 17 March 2021 to 26 July 2023: from the meeting whose
 * published projections put 2022 inflation at 2.0 %, to the last rise of the
 * cycle.
 *
 * **Every figure is sourced in `docs/SCENARIOS.md`, and `transitory.test.ts`
 * parses that document and fails if the two disagree.**
 */
export const TRANSITORY_FED_2021: Scenario = {
  id: 'transitory_fed_2021',
  title: 'Transitory',
  subtitle: 'The Federal Reserve, March 2021 to July 2023',
  briefing:
    'The vaccines are working and the economy is reopening into one point ' +
    'nine trillion dollars of transfers signed last week, on top of three ' +
    'trillion already spent. Headline inflation is 2.7 % and core is 1.7 %, ' +
    'both of which are being read as base effects against a collapsed spring. ' +
    'Unemployment is 6.1 %, two points above where the committee believes it ' +
    'can settle. The target range is zero to a quarter, the balance sheet is ' +
    'growing by a hundred and twenty billion a month, and the framework ' +
    'adopted last August commits you to making up past shortfalls rather ' +
    'than pre-empting overshoots. Your own committee’s published median has ' +
    'inflation at 2.0 % next year. You have two and a third years.',
  institution: 'fed',
  // Medium, not hard, and this is the one scenario where that is the right
  // answer. Hard's regime is about not being able to see; 2021's statistics
  // were excellent and the committee that was wrong about them had every
  // number on time. What makes it difficult is the judgement, and the
  // judgement is the player's whatever the noise setting says.
  rules: 'medium',
  meetingCount: 20,

  opening: {
    // FRED DFEDTARU as of 17 March 2021: the upper limit of the target range.
    policyRate: 0.25,
    // Computed from FRED CPIAUCSL and CPILFESL, February 2021 — the last
    // print available at the March meeting.
    inflationHeadline: 2.67,
    inflationCore: 1.65,
    unemployment: 6.1,
    // FRED NROU (CBO), 2021 Q1, today's vintage. **The Committee's own
    // published longer-run median at this meeting was 4.0**, which is 0.45
    // points lower — and that gap is the whole of the real-time
    // misperception. The engine gets the number that turned out to be right;
    // the *player* sees the published gap, which carries the bias below.
    naturalUnemployment: 4.45,
    // Computed from FRED GDPC1 21106.6 against GDPPOT 21216.9, 2021 Q1.
    outputGap: -0.52,
    // FRED GS10, March 2021.
    longRate: 1.61,
    // FRED AHETPI, year-over-year, February 2021. **Distorted upward** by the
    // composition of who was still employed — low-wage service jobs were
    // disproportionately gone, so the average of what remained rose. One of
    // the real measurement problems of this period and it is not in the
    // engine's bias list because it is a composition effect rather than an
    // error.
    wageGrowth: 5.02,
    // FRED MICH, March 2021.
    expectedInflationShort: 3.1,
    // FRED T10YIE, the ten-year breakeven as of 17 March 2021.
    expectedInflationLong: 2.3,
    // Derived from the model's identity, as in every scenario: headline stands
    // 1.0 point above core at this date, on energy base effects.
    supplyShock: 0.35,
    importPriceInflation: 0.7,
    // **Judgements.** Twenty-five years of anchored expectations and a
    // pandemic response widely judged successful. The highest credibility any
    // scenario in this file opens with, which is the point: this is the only
    // one where the institution has it all to lose.
    credibility: 82,
    anchoring: 0.88,
    bankingStress: 22,
    creditSpread: 0.9,
    marketVolatility: 22,
    creditGrowth: 2.0,
    // Equities had roughly doubled off the March 2020 low and the policy rate
    // was at zero. Rich, and known to be.
    assetPricePressure: 22,
    // The balance sheet had gone from $4.2tn to $7.6tn in a year and was still
    // growing at $120bn a month.
    balanceSheet: 180,
    debtPressure: 62,
    // The post-2008 decline, which the Committee's own longer-run funds rate
    // median of 2.5 against a 2 % objective puts at 0.5.
    neutralRealRate: 0.5,
  },

  measurement: {
    ...GOOD_DATA_WRONG_FORECAST,
    // **The bias, derived rather than sourced, and the derivation is its whole
    // authority.** The Committee's own longer-run unemployment median at this
    // meeting was 4.0 %; the CBO now puts the 2021 natural rate at 4.45 %. So
    // in real time the labour market was read as having 0.45 points more slack
    // than it had, which through this scenario's own Okun coefficient of 0.5
    // is 0.9 points of output gap. Rounded to one point, and *negative*: the
    // published gap says the economy is weaker than it is, exactly as it did
    // in 1979 and 2008, for the third different reason.
    seriesBias: { output_gap_estimate: -1.0 },
  },

  // Nothing withheld. Every instrument this game models existed and was in use
  // in 2021 — which is itself the difference between this scenario and the
  // other four, and the reason it is about judgement rather than about running
  // out of things to do.
  withheldInstruments: [],

  // The Committee moved 75 bp four times in a row in 2022, which is the
  // fastest tightening since 1981 and the thing a player has to be able to
  // reproduce.
  instrumentRanges: {
    policy_rate: { min: -100, max: 100, increment: 25 },
  },

  // Set from the path that prevailed: 5.25 points of movement in one direction
  // over two and a third years, 2.25 a year, no reversals. Below the desk's
  // 3.5, because a mandate whose historical path never once changed direction
  // should charge a player who does.
  churnAllowancePerYear: 2.5,

  // Near 1. The transmission of 2022 was ordinary — mortgage rates followed
  // the policy rate almost immediately and housing turned within two quarters.
  // What was *not* ordinary was how little of the rest followed, and that is
  // the flat Phillips curve below rather than a transmission failure.
  // Below medium's 1.0. The shock of 2021-23 is scripted on its own dates in
  // both directions — the bottleneck, the war, and the unwind — and the
  // ambient supply process adds a fourth one nobody had. Measured, the
  // modelled mandate ended at 6.7 % against the 3.29 % that printed, almost
  // all of it the ambient process refusing to let the scripted unwind land.
  shockScale: 0.6,
  rateTransmission: 1.0,
  // Very flat, and this is the fact of the period. Core inflation fell from
  // 6.6 % to 3.2 % while unemployment never went above 3.7 % — a disinflation
  // with no sacrifice ratio at all, which nothing in the 1979 model can
  // produce. Most of it was the supply side unwinding rather than the gap.
  phillipsGapSlope: 0.12,
  // High. This economy snapped back: the gap closed in four quarters and
  // stayed closed through a tightening cycle.
  gapMeanReversion: 0.95,
  // Barely binding, because unemployment barely moved. 0.5 is a touch above
  // the engine's own.
  okun: 0.5,

  goldStandard: null,
  procedureChoiceAt: null,
  proceduralEventScale: 0.6,
  // The energy story is scripted twice on its own dates and the banking story
  // once. Drawing more of either beside them is the same history twice.
  suppressedFamilies: ['energy_commodity', 'banking_failure'],

  thresholds: {
    inflationSpiral: {
      // Headline peaked at 8.98 % in June 2022 and the anchor held: the ten
      // year breakeven never went above about 3 %. So the bar sits above the
      // actual peak, and the *expectations* bar does the work instead, which
      // is exactly the right shape for this scenario — the question of 2022
      // was never the print, it was whether the print got into expectations.
      failInflation: 13,
      watchInflation: 6,
      failExpectations: 4,
    },
    bankingCrisis: {
      // Three banks failed in March 2023 and the system held. The bar sits
      // above what that reached.
      failStress: 88,
      watchStress: 50,
      meetingsToFail: 3,
    },
    capitulation: {
      // Live, and this is the only modern scenario where it is. A player who
      // cuts back to a negative real rate in 2022 with expectations still
      // above target is doing the thing the whole mandate is a test of.
      meetingsToFail: 4,
    },
    dismissal: {
      failCredibility: 25,
      watchCredibility: 40,
    },
  },

  benchmarkNote:
    'The upper limit of the federal funds target range, meeting by meeting, ' +
    'from the Committee’s own statements: zero to a quarter until March 2022, ' +
    'then 5.25 % by July 2023. It is a decision rather than an outcome. What ' +
    'the column cannot show is that for the first five meetings of it the ' +
    'Committee’s published forecast had no rise in it at all before 2024 — ' +
    'so the first third of this comparison is not a comparison ' +
    'of policies, it is a comparison of what two forecasters believed.',

  calendar: [
    { date: '2021-03-17', label: 'March 17, 2021', benchmarkRate: 0.25, actualInflation: 2.67, actualCore: 1.65, actualUnemployment: 6.1 },
    { date: '2021-04-28', label: 'April 28, 2021', benchmarkRate: 0.25, actualInflation: 4.13, actualCore: 2.98, actualUnemployment: 6.1 },
    { date: '2021-06-16', label: 'June 16, 2021', benchmarkRate: 0.25, actualInflation: 5.3, actualCore: 4.44, actualUnemployment: 5.9 },
    { date: '2021-07-28', label: 'July 28, 2021', benchmarkRate: 0.25, actualInflation: 5.25, actualCore: 4.21, actualUnemployment: 5.4 },
    { date: '2021-09-22', label: 'September 22, 2021', benchmarkRate: 0.25, actualInflation: 5.35, actualCore: 4, actualUnemployment: 4.7 },
    { date: '2021-11-03', label: 'November 3, 2021', benchmarkRate: 0.25, actualInflation: 6.9, actualCore: 4.97, actualUnemployment: 4.1 },
    { date: '2021-12-15', label: 'December 15, 2021', benchmarkRate: 0.25, actualInflation: 7.17, actualCore: 5.49, actualUnemployment: 3.9 },
    { date: '2022-01-26', label: 'January 26, 2022', benchmarkRate: 0.25, actualInflation: 7.56, actualCore: 6.05, actualUnemployment: 4 },
    { date: '2022-03-16', label: 'March 16, 2022', benchmarkRate: 0.25, actualInflation: 8.57, actualCore: 6.48, actualUnemployment: 3.7 },
    { date: '2022-05-04', label: 'May 4, 2022', benchmarkRate: 0.5, actualInflation: 8.54, actualCore: 6.03, actualUnemployment: 3.6 },
    { date: '2022-06-15', label: 'June 15, 2022', benchmarkRate: 1, actualInflation: 8.98, actualCore: 5.91, actualUnemployment: 3.6 },
    { date: '2022-07-27', label: 'July 27, 2022', benchmarkRate: 1.75, actualInflation: 8.46, actualCore: 5.9, actualUnemployment: 3.5 },
    { date: '2022-09-21', label: 'September 21, 2022', benchmarkRate: 2.5, actualInflation: 8.19, actualCore: 6.62, actualUnemployment: 3.5 },
    { date: '2022-11-02', label: 'November 2, 2022', benchmarkRate: 3.25, actualInflation: 7.12, actualCore: 5.97, actualUnemployment: 3.6 },
    { date: '2022-12-14', label: 'December 14, 2022', benchmarkRate: 4, actualInflation: 6.4, actualCore: 5.69, actualUnemployment: 3.5 },
    { date: '2023-02-01', label: 'February 1, 2023', benchmarkRate: 4.5, actualInflation: 5.96, actualCore: 5.5, actualUnemployment: 3.6 },
    { date: '2023-03-22', label: 'March 22, 2023', benchmarkRate: 4.75, actualInflation: 4.92, actualCore: 5.57, actualUnemployment: 3.5 },
    { date: '2023-05-03', label: 'May 3, 2023', benchmarkRate: 5, actualInflation: 4.13, actualCore: 5.34, actualUnemployment: 3.6 },
    { date: '2023-06-14', label: 'June 14, 2023', benchmarkRate: 5.25, actualInflation: 3.07, actualCore: 4.85, actualUnemployment: 3.6 },
    { date: '2023-07-26', label: 'July 26, 2023', benchmarkRate: 5.25, actualInflation: 3.29, actualCore: 4.7, actualUnemployment: 3.5 },
  ],

  events: FED_EVENTS,
}

/**
 * Transitory, 2021-23: the European Central Bank.
 *
 * Twenty meetings, 11 March 2021 to 27 July 2023. The same shock from the
 * other seat, and the differences are the point:
 *
 *  - It **starts below zero**, at a deposit rate of −0.50 %, where it had been
 *    since September 2019. The first rise is the first in eleven years.
 *  - Its inflation is **imported**. Area gas went from about €20 a megawatt
 *    hour to over €300 at the peak, and the area pays for that in a transfer
 *    of income out of it. No instrument this institution holds offsets a
 *    terms-of-trade loss; what it can do is stop it becoming a wage-price
 *    spiral, which is a different objective and the scorecard knows it.
 *  - It **cannot raise without a second instrument**. The Italian spread
 *    widened by eighty basis points in the fortnight after the first rise was
 *    trailed, and an unscheduled meeting in June 2022 produced the
 *    transmission protection instrument. Raising in this area is two
 *    decisions, not one.
 */
export const TRANSITORY_ECB_2021: Scenario = {
  id: 'transitory_ecb_2021',
  title: 'Transitory, from Frankfurt',
  subtitle: 'The European Central Bank, March 2021 to July 2023',
  briefing:
    'The deposit rate has been at minus a half for eighteen months and the ' +
    'pandemic purchase programme is being stepped up today, not wound down, ' +
    'because area yields have been dragged up by American ones. Inflation is ' +
    '1.3 % and has spent a decade below the objective; the fear in this ' +
    'building is still of too little. Unemployment is 8.2 %. The Italian ' +
    'spread to Germany is 1.07 points and nothing is straining. Within a ' +
    'year the gas price will be the only subject and you will have no ' +
    'instrument that touches it. You have two and a third years.',
  institution: 'ecb',
  rules: 'medium',
  meetingCount: 20,

  opening: {
    // FRED ECBMRRFR as of 11 March 2021: the main refinancing rate, 0.00 %.
    // The deposit facility rate was −0.50 % and was the effective policy rate
    // in this period, which the document says and the engine cannot carry:
    // the dial here is the refi rate, as in the 2010-12 scenario.
    policyRate: 0.0,
    // Computed from FRED CP0000EZ19M086NEST, year-over-year, February 2021.
    inflationHeadline: 1.33,
    // **Derived**, 0.2 points below headline: area core ran a little under
    // headline through early 2021. Marked as a derivation in both places.
    inflationCore: 1.13,
    // FRED LRHUTTTTEZM156S, February 2021.
    unemployment: 8.2,
    // **A judgement**, as in the 2010-12 scenario and for the same reason:
    // no euro-area NROU is published. The area's structural rate had come
    // down from the crisis; 7.5 is the conservative reading.
    naturalUnemployment: 7.5,
    // **Derived** from the unemployment gap through this scenario's Okun
    // coefficient: (7.5 − 8.2) / 0.5 = −1.4.
    outputGap: -1.4,
    // FRED IRLTLT01DEM156N, March 2021. Negative, which is a fact about this
    // period that nothing else in this file can show.
    longRate: -0.36,
    // **A judgement.** Negotiated area wage growth ran near 1.5 % in 2021.
    wageGrowth: 1.5,
    // **Judgements**, from the ECB's own Survey of Professional Forecasters,
    // whose one-year and longer-run points sat near these at this date.
    expectedInflationShort: 1.5,
    expectedInflationLong: 1.7,
    supplyShock: 0.3,
    importPriceInflation: 1.2,
    // **Judgements.** An institution that had spent a decade undershooting its
    // objective and had just completed a strategy review about it.
    credibility: 76,
    anchoring: 0.85,
    // The Italy-Germany ten-year spread, March 2021: 1.07 points (FRED
    // IRLTLT01ITM156N against IRLTLT01DEM156N), so 107 basis points.
    fragmentation: 107,
    bankingStress: 26,
    creditSpread: 0.8,
    marketVolatility: 21,
    creditGrowth: 3.0,
    assetPricePressure: 14,
    balanceSheet: 190,
    debtPressure: 70,
    // Lower than the Fed's: the area's neutral rate was widely estimated near
    // zero in real terms at this date.
    neutralRealRate: 0.0,
  },

  measurement: {
    ...GOOD_DATA_WRONG_FORECAST,
    // Smaller than the Fed's, and the asymmetry is the argument: the ECB's
    // 2021 error was less about reading its own labour market and more about
    // a price it does not produce. Half a point.
    seriesBias: { output_gap_estimate: -0.5 },
    // The area's statistics are an aggregate of twenty national offices and a
    // flash estimate that is sometimes revised.
    revisionScale: 1.1,
    missingObservationProbability: 0.02,
  },

  withheldInstruments: ['iorb_spread', 'reverse_repo', 'discount_window'],

  instrumentRanges: {
    policy_rate: { min: -75, max: 75, increment: 25 },
  },

  // 4.25 points of movement in one direction over two and a third years, 1.8
  // a year, no reversals.
  churnAllowancePerYear: 2.0,

  // Below the Fed's: the area's transmission runs through banks rather than
  // through capital markets, and bank lending rates followed the policy rate
  // with a longer lag than American mortgage rates did.
  // Below medium's 1.0, for the reason given in the Federal Reserve scenario
  // above. More so here: the area's whole inflation was one price.
  shockScale: 0.55,
  rateTransmission: 0.85,
  // Flat, as in the United States, and for a reason that is more obviously
  // true here: almost all of the area's inflation arrived through the import
  // bill and left the same way.
  phillipsGapSlope: 0.14,
  gapMeanReversion: 0.8,
  okun: 0.5,

  goldStandard: null,
  procedureChoiceAt: null,
  proceduralEventScale: 0.6,
  suppressedFamilies: ['energy_commodity', 'banking_failure'],

  thresholds: {
    inflationSpiral: {
      // Area headline peaked at 10.62 % in October 2022 — higher than the
      // American peak — and the anchor held. Same shape as the Fed scenario:
      // the bar on the print sits above what happened and the bar on
      // expectations is the one that matters.
      failInflation: 15,
      watchInflation: 7,
      failExpectations: 4,
    },
    fragmentationCrisis: {
      // Live, because raising the rate in this area reopens the question the
      // 2010-12 scenario is about. The spread stayed inside 250 bp through
      // 2022 and the bar sits above that.
      failSpread: 500,
      watchSpread: 200,
      meetingsToFail: 4,
    },
    bankingCrisis: {
      failStress: 88,
      watchStress: 50,
      meetingsToFail: 3,
    },
    capitulation: { meetingsToFail: 4 },
    dismissal: { failCredibility: 25, watchCredibility: 40 },
  },

  benchmarkNote:
    'The main refinancing rate the Governing Council actually voted, meeting ' +
    'by meeting: 0.00 % until July 2022, then 4.25 % by July 2023. The rate ' +
    'that mattered for most of the first half of this mandate was the deposit ' +
    'facility rate at minus a half, which this game does not model as a ' +
    'separate dial — so the first eleven rows of this column are flat at zero ' +
    'while the policy they describe was not.',

  calendar: [
    { date: '2021-03-11', label: 'March 11, 2021', benchmarkRate: 0, actualInflation: 1.33, actualUnemployment: 8.2 },
    { date: '2021-04-22', label: 'April 22, 2021', benchmarkRate: 0, actualInflation: 1.61, actualUnemployment: 8.2 },
    { date: '2021-06-10', label: 'June 10, 2021', benchmarkRate: 0, actualInflation: 1.9, actualUnemployment: 7.8 },
    { date: '2021-07-22', label: 'July 22, 2021', benchmarkRate: 0, actualInflation: 2.16, actualUnemployment: 7.7 },
    { date: '2021-09-09', label: 'September 9, 2021', benchmarkRate: 0, actualInflation: 3.36, actualUnemployment: 7.4 },
    { date: '2021-10-28', label: 'October 28, 2021', benchmarkRate: 0, actualInflation: 4.05, actualUnemployment: 7.3 },
    { date: '2021-12-16', label: 'December 16, 2021', benchmarkRate: 0, actualInflation: 4.97, actualUnemployment: 7 },
    { date: '2022-02-03', label: 'February 3, 2022', benchmarkRate: 0, actualInflation: 5.88, actualUnemployment: 6.8 },
    { date: '2022-03-10', label: 'March 10, 2022', benchmarkRate: 0, actualInflation: 7.44, actualUnemployment: 6.8 },
    { date: '2022-04-14', label: 'April 14, 2022', benchmarkRate: 0, actualInflation: 7.45, actualUnemployment: 6.7 },
    { date: '2022-06-09', label: 'June 9, 2022', benchmarkRate: 0, actualInflation: 8.64, actualUnemployment: 6.7 },
    { date: '2022-07-21', label: 'July 21, 2022', benchmarkRate: 0.5, actualInflation: 8.86, actualUnemployment: 6.7 },
    { date: '2022-09-08', label: 'September 8, 2022', benchmarkRate: 1.25, actualInflation: 9.93, actualUnemployment: 6.7 },
    { date: '2022-10-27', label: 'October 27, 2022', benchmarkRate: 2, actualInflation: 10.62, actualUnemployment: 6.6 },
    { date: '2022-12-15', label: 'December 15, 2022', benchmarkRate: 2.5, actualInflation: 9.2, actualUnemployment: 6.7 },
    { date: '2023-02-02', label: 'February 2, 2023', benchmarkRate: 3, actualInflation: 8.5 },
    { date: '2023-03-16', label: 'March 16, 2023', benchmarkRate: 3.5, actualInflation: 6.88 },
    { date: '2023-05-04', label: 'May 4, 2023', benchmarkRate: 3.75, actualInflation: 6.1 },
    { date: '2023-06-15', label: 'June 15, 2023', benchmarkRate: 4, actualInflation: 5.51 },
    { date: '2023-07-27', label: 'July 27, 2023', benchmarkRate: 4.25, actualInflation: 5.28 },
  ],

  events: ECB_EVENTS,
}
