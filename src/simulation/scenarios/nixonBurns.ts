import type { Scenario, ScenarioEvent } from '../types/scenario.ts'

/**
 * Nixon and Burns, January 1972 to December 1974.
 *
 * ## Why this period and not another
 *
 * Because it is the only one in this game where the political pressure can be
 * put on the screen with names attached. Everywhere else the institution
 * speaks — the administration, the Treasury, a committee of the legislature —
 * and that is a deliberate rule, because inventing a named politician who
 * leaned on a central bank is inventing a defamation. Here the record exists:
 * the White House taping system recorded the conversations, the chairman kept
 * a diary, and the whole of it has been published and studied for fifty years.
 * Burns, Arthur F., *The Diary of Arthur Burns*; Abrams, Burton A. (2006),
 * "How Richard Nixon Pressured Arthur Burns", *Journal of Economic
 * Perspectives* 20(4).
 *
 * **Nothing in this file quotes either man.** The documented fact is that the
 * pressure happened, was sustained, and was about the rate before an election.
 * What was said is in the sources; what this scenario does is give the player
 * the pressure and let them answer it.
 *
 * ## What makes it hard, which is not the size of the shock
 *
 * Three things, and only the last is a shock.
 *
 * **The published inflation number was wrong, and wrong in one direction.**
 * Wage and price controls ran from August 1971. They did not remove the
 * pressure; they postponed its appearance in the index. So a chairman reading
 * the CPI in 1972 saw 3.3 % — the lowest in four years — and every rule that
 * responds to published inflation prescribed an easier policy than the
 * situation required. This is the scenario's `seriesBias` and it is the whole
 * point: difficulty here is *what was knowable*, not how violent the year was.
 *
 * **The output gap was mismeasured the other way.** Real-time estimates of
 * potential output in the early 1970s were far too high — the productivity
 * slowdown had begun and nobody had seen it in the data yet — so the economy
 * looked like it had slack it did not have. Orphanides's argument again, and
 * the same one 1979 carries, arriving seven years earlier.
 *
 * **Then the controls came off and the embargo arrived.** April 1974 and
 * October 1973 respectively, in that causal order and the opposite
 * chronological one. The player who eased through 1972 meets both with no
 * room.
 *
 * ## The one that is already decided
 *
 * The outcome. 3.3 % inflation at the opening and 12.1 % at the end, with
 * unemployment at 7.2 % — the worst of both, which is the thing the period is
 * remembered for and the reason "stagflation" needed a word. The benchmark
 * path is what the Federal Reserve actually did, month by month, and beating
 * it is not supposed to be easy.
 */

const NIXON_BURNS_EVENTS: readonly ScenarioEvent[] = [
  {
    meetingIndex: 4,
    id: 'grain_sales_1972',
    date: '1972-07-08',
    family: 'energy_commodity',
    major: false,
    title: 'A very large grain sale is agreed',
    newswire:
      'Export sales of close to a quarter of the wheat crop are agreed with ' +
      'a single buyer over a few weeks, at prices set before the scale of ' +
      'the purchases was public. Stocks are drawn down to post-war lows.',
    immediate: [
      { variable: 'supplyShock', delta: 0.4 },
    ],
    delayed: [
      // Food prices were the single largest contributor to 1973 inflation,
      // and they arrive with a harvest's lag rather than a quarter's.
      { delaySteps: 12, effects: [{ variable: 'supplyShock', delta: 1.1 }] },
      { delaySteps: 16, effects: [{ variable: 'inflationHeadline', delta: 0.9 }] },
      { delaySteps: 26, effects: [{ variable: 'supplyShock', delta: -1.2 }] },
    ],
  },
  {
    meetingIndex: 5,
    id: 'benefit_increase_1972',
    date: '1972-09-01',
    family: 'fiscal',
    major: false,
    title: 'Social security benefits are raised by a fifth',
    newswire:
      'A twenty per cent across-the-board increase in benefits takes effect, ' +
      'legislated in the summer and payable from this month. It is the ' +
      'largest single increase in the programme’s history.',
    immediate: [
      { variable: 'fiscalImpulse', delta: 1.1 },
      { variable: 'confidenceShock', delta: 0.5 },
    ],
    delayed: [
      { delaySteps: 4, effects: [{ variable: 'outputGap', delta: 0.9 }] },
      { delaySteps: 10, effects: [{ variable: 'outputGap', delta: 0.7 }] },
      { delaySteps: 20, effects: [{ variable: 'fiscalImpulse', delta: -0.8 }] },
    ],
  },
  {
    meetingIndex: 8,
    id: 'phase_three_controls',
    date: '1973-01-11',
    family: 'data_revision',
    major: false,
    title: 'Controls move to a voluntary phase',
    newswire:
      'The administration replaces mandatory price and wage controls with a ' +
      'largely self-administered phase. Firms that had deferred increases ' +
      'through the mandatory period are free to take them.',
    immediate: [
      { variable: 'supplyShock', delta: 1.3 },
      { variable: 'importPriceInflation', delta: 3 },
      { variable: 'expectedInflationShort', delta: 0.5 },
    ],
    delayed: [
      { delaySteps: 4, effects: [{ variable: 'inflationCore', delta: 0.8 }] },
      { delaySteps: 8, effects: [{ variable: 'inflationHeadline', delta: 0.7 }] },
      { delaySteps: 16, effects: [{ variable: 'supplyShock', delta: -0.9 }] },
    ],
  },
  {
    meetingIndex: 9,
    id: 'bretton_woods_ends',
    date: '1973-03-19',
    family: 'exchange_rate',
    major: false,
    title: 'The major currencies float',
    newswire:
      'The attempt to hold the post-war parities is abandoned and the major ' +
      'currencies float. Import prices are no longer anchored by a fixed ' +
      'rate, and the dollar falls.',
    immediate: [
      { variable: 'exchangeRate', delta: -9 },
      { variable: 'importPriceInflation', delta: 4 },
      { variable: 'marketVolatility', delta: 8 },
    ],
    delayed: [
      { delaySteps: 4, effects: [{ variable: 'inflationHeadline', delta: 0.3 }] },
    ],
  },
  {
    meetingIndex: 11,
    id: 'june_1973_freeze',
    date: '1973-06-13',
    family: 'data_revision',
    major: false,
    title: 'A second freeze is announced',
    newswire:
      'With prices accelerating, a second across-the-board freeze is ' +
      'announced. Ranchers withhold cattle from market and shortages appear ' +
      'within weeks.',
    immediate: [
      { variable: 'supplyShock', delta: 0.6 },
      { variable: 'outputGap', delta: -0.3 },
    ],
    delayed: [
      // A freeze suppresses the index and then gives it back with interest.
      { delaySteps: 4, effects: [{ variable: 'inflationHeadline', delta: -0.6 }] },
      { delaySteps: 10, effects: [{ variable: 'inflationHeadline', delta: 1.1 }] },
    ],
  },
  {
    meetingIndex: 14,
    id: 'oil_embargo_1973',
    date: '1973-10-17',
    family: 'energy_commodity',
    major: true,
    title: 'An oil embargo is imposed',
    newswire:
      'Producing states impose an embargo on several importing countries and ' +
      'cut output. The posted price of crude quadruples within three months. ' +
      'Queues form at filling stations and speed limits are cut to save fuel.',
    immediate: [
      { variable: 'supplyShock', delta: 2.8 },
      { variable: 'importPriceInflation', delta: 11 },
      { variable: 'confidenceShock', delta: -1.2 },
      { variable: 'geopoliticalRisk', delta: 22 },
    ],
    delayed: [
      { delaySteps: 4, effects: [{ variable: 'supplyShock', delta: 0.9 }] },
      {
        delaySteps: 8,
        effects: [
          { variable: 'outputGap', delta: -2.6 },
          { variable: 'confidenceShock', delta: -0.8 },
          { variable: 'supplyShock', delta: -1.2 },
        ],
      },
      { delaySteps: 12, effects: [{ variable: 'outputGap', delta: -1.4 }] },
      {
        delaySteps: 14,
        effects: [
          { variable: 'supplyShock', delta: -1.8 },
          { variable: 'geopoliticalRisk', delta: -12 },
        ],
      },
    ],
  },
  {
    meetingIndex: 18,
    id: 'controls_expire_1974',
    date: '1974-04-30',
    family: 'data_revision',
    major: true,
    title: 'The controls expire',
    newswire:
      'The authority to control prices and wages lapses. Increases deferred ' +
      'through nearly three years of controls arrive in the index at once, ' +
      'and bargaining rounds reopen to recover what they lost.',
    immediate: [
      { variable: 'supplyShock', delta: 1.4 },
      { variable: 'wageGrowth', delta: 1.6 },
      { variable: 'expectedInflationShort', delta: 0.8 },
    ],
    delayed: [
      { delaySteps: 4, effects: [{ variable: 'inflationCore', delta: 1.2 }] },
      { delaySteps: 8, effects: [{ variable: 'wageGrowth', delta: 0.8 }] },
      // No unwind inside this mandate, and that is the point rather than an
      // omission. The post-controls catch-up did not burn itself out in 1974:
      // inflation was still 12.1 % in December with unemployment at 7.2 %,
      // which is the definition of the word the period produced. The unwind
      // belongs to 1975-76, after this term ends — and a scenario that
      // disinflated on its own in the last six months would be teaching that
      // stagflation resolves itself, which is the one thing it did not do.
      { delaySteps: 10, effects: [{ variable: 'expectedInflationShort', delta: 0.5 }] },
    ],
  },
  {
    meetingIndex: 22,
    id: 'franklin_national_1974',
    date: '1974-10-08',
    family: 'banking',
    major: false,
    title: 'A large commercial bank fails',
    newswire:
      'One of the twenty largest commercial banks in the country has failed ' +
      'after losses in foreign exchange trading, the largest failure in the ' +
      'system’s history to date. Its deposits are assumed by another bank.',
    immediate: [
      { variable: 'bankingStress', delta: 16 },
      { variable: 'creditSpread', delta: 0.7 },
      { variable: 'marketVolatility', delta: 12 },
    ],
    delayed: [
      { delaySteps: 4, effects: [{ variable: 'creditGrowth', delta: -1.8 }] },
      { delaySteps: 10, effects: [{ variable: 'bankingStress', delta: -9 }] },
    ],
  },
]

export const NIXON_BURNS_1972: Scenario = {
  id: 'nixon_burns_1972',
  title: 'Burns',
  subtitle: 'The Federal Reserve, January 1972 to December 1974',
  briefing:
    'Inflation reads 3.3 %, the lowest in four years, and it reads that way ' +
    'because wage and price controls have been in force since August. The ' +
    'funds rate is 3.51 %, unemployment is 5.8 % and the economy looks to ' +
    'have slack. There is an election in November, and the administration ' +
    'has been explicit, repeatedly and in private, about what it wants from ' +
    'you. Three years.',
  institution: 'fed',
  rules: 'hard',
  meetingCount: 24,

  // Monthly slots on a uniform grid, not FOMC meeting dates: the committee met
  // roughly monthly in this period, but this project does not hold that
  // calendar and will not invent one. The labels are months and say so, which
  // is the rule 1929 already follows. `tools/scenario-data.mjs` prints the
  // table; `docs/SCENARIOS.md` carries it.
  calendar: [
    { date: '1972-01-01', label: 'January 1972', benchmarkRate: 3.51, actualInflation: 3.26, actualCore: 3.33, actualUnemployment: 5.8 },
    { date: '1972-03-01', label: 'March 1972', benchmarkRate: 3.83, actualInflation: 3.5, actualCore: 3.32, actualUnemployment: 5.8 },
    { date: '1972-04-01', label: 'April 1972', benchmarkRate: 4.17, actualInflation: 3.49, actualCore: 3.3, actualUnemployment: 5.7 },
    { date: '1972-06-01', label: 'June 1972', benchmarkRate: 4.46, actualInflation: 2.96, actualCore: 2.8, actualUnemployment: 5.7 },
    { date: '1972-07-01', label: 'July 1972', benchmarkRate: 4.55, actualInflation: 2.96, actualCore: 2.8, actualUnemployment: 5.6 },
    { date: '1972-09-01', label: 'September 1972', benchmarkRate: 4.87, actualInflation: 3.19, actualCore: 3.02, actualUnemployment: 5.5 },
    { date: '1972-10-01', label: 'October 1972', benchmarkRate: 5.05, actualInflation: 3.18, actualCore: 3.02, actualUnemployment: 5.6 },
    { date: '1972-12-01', label: 'December 1972', benchmarkRate: 5.33, actualInflation: 3.41, actualCore: 3, actualUnemployment: 5.2 },
    { date: '1973-01-01', label: 'January 1973', benchmarkRate: 5.94, actualInflation: 3.64, actualCore: 2.53, actualUnemployment: 4.9 },
    { date: '1973-03-01', label: 'March 1973', benchmarkRate: 7.09, actualInflation: 4.83, actualCore: 3.21, actualUnemployment: 4.9 },
    { date: '1973-04-01', label: 'April 1973', benchmarkRate: 7.12, actualInflation: 5.3, actualCore: 2.97, actualUnemployment: 5 },
    { date: '1973-06-01', label: 'June 1973', benchmarkRate: 8.49, actualInflation: 6, actualCore: 3.18, actualUnemployment: 4.9 },
    { date: '1973-07-01', label: 'July 1973', benchmarkRate: 10.4, actualInflation: 5.74, actualCore: 3.17, actualUnemployment: 4.8 },
    { date: '1973-09-01', label: 'September 1973', benchmarkRate: 10.78, actualInflation: 7.36, actualCore: 3.84, actualUnemployment: 4.8 },
    { date: '1973-10-01', label: 'October 1973', benchmarkRate: 10.01, actualInflation: 8.06, actualCore: 4.28, actualUnemployment: 4.6 },
    { date: '1973-12-01', label: 'December 1973', benchmarkRate: 9.95, actualInflation: 8.94, actualCore: 4.71, actualUnemployment: 4.9 },
    { date: '1974-01-01', label: 'January 1974', benchmarkRate: 9.65, actualInflation: 9.6, actualCore: 5.16, actualUnemployment: 5.1 },
    { date: '1974-03-01', label: 'March 1974', benchmarkRate: 9.35, actualInflation: 10.14, actualCore: 5.78, actualUnemployment: 5.1 },
    { date: '1974-04-01', label: 'April 1974', benchmarkRate: 10.51, actualInflation: 10.07, actualCore: 6.21, actualUnemployment: 5.1 },
    { date: '1974-06-01', label: 'June 1974', benchmarkRate: 11.93, actualInflation: 10.86, actualCore: 7.93, actualUnemployment: 5.4 },
    { date: '1974-07-01', label: 'July 1974', benchmarkRate: 12.92, actualInflation: 11.54, actualCore: 8.79, actualUnemployment: 5.5 },
    { date: '1974-09-01', label: 'September 1974', benchmarkRate: 11.34, actualInflation: 11.95, actualCore: 10.22, actualUnemployment: 5.9 },
    { date: '1974-10-01', label: 'October 1974', benchmarkRate: 10.06, actualInflation: 11.84, actualCore: 10.58, actualUnemployment: 6 },
    { date: '1974-12-01', label: 'December 1974', benchmarkRate: 8.53, actualInflation: 12.1, actualCore: 11.35, actualUnemployment: 7.2 },
  ],

  opening: {
    // Every figure here is January 1972 from the series named in
    // `tools/scenario-data.mjs`, except where marked.
    policyRate: 3.51,
    inflationHeadline: 3.26,
    inflationCore: 3.33,
    unemployment: 5.8,
    naturalUnemployment: 6.01,
    outputGap: -0.19,
    longRate: 5.95,
    wageGrowth: 7.65,

    // Approximation. No monthly survey of one-year inflation expectations
    // exists for January 1972 — the Michigan series begins in 1978 — and the
    // Livingston survey is semi-annual. 3.4 is a shade above the published
    // headline, which is what a household reading a controlled index would
    // say, and it is a judgement rather than a measurement.
    expectedInflationShort: 3.4,

    // Derived, the same way 1979's is: the ten-year yield of 5.95 % less an
    // assumed 2 % long-run real rate, rounded. A derivation from a sourced
    // number, and the derivation is the whole of its authority.
    expectedInflationLong: 4.0,

    // Wages are running 7.65 % against 3.3 % prices, which is a gap the model
    // would otherwise read as an inconsistency and close. It is not one: it is
    // a controlled price index sitting on top of an uncontrolled labour
    // market, and the suppressed pressure is exactly what the supply shock
    // term represents. Set so headline sits where it is observed while the
    // pressure underneath is carried rather than discarded.
    supplyShock: 0.55,
    importPriceInflation: 1.1,

    // The institution that had held the anchor through the 1960s had not yet
    // visibly lost it: inflation had been 3 % or less for most of two decades
    // before 1966. Higher than 1979's 45, well below a modern central bank's.
    // Approximations, and marked as such in docs/SCENARIOS.md.
    credibility: 62,
    anchoring: 0.62,

    // The scenario's premise, and the only opening in the game that sets it.
    // Above `SPEAKS_ABOVE` (46) from the first meeting, below `FORMAL_ABOVE`
    // (64): the administration is already pressing, in private, and has not
    // yet gone public. That is where the record puts it in January 1972.
    politicalPressure: 58,
  },

  measurement: {
    observationNoiseScale: 1.3,
    revisionScale: 1.5,
    missingObservationProbability: 0.08,
    publicationLagRelief: 0,
    forecastUncertaintyScale: 1.4,

    seriesBias: {
      // The two biases that define the period, pointing in opposite
      // directions, which is what makes it genuinely hard rather than merely
      // noisy.
      //
      // **Published inflation reads low.** Controls did not remove price
      // pressure, they deferred its appearance. Estimates of the suppression
      // vary; around a point of CPI through the mandatory phases is the middle
      // of the published range, and this is an approximation of a contested
      // quantity rather than a measurement.
      headline_inflation: -1.0,
      core_inflation: -1.0,

      // **The gap reads high.** Real-time potential output in the early 1970s
      // was estimated well above what later vintages show, because the
      // productivity slowdown had started and had not yet appeared in the
      // data. So the economy looked slacker than it was, and every rule
      // responding to the gap prescribed an easier policy. Orphanides (2003),
      // and here a number rather than a paragraph.
      output_gap_estimate: 2.4,
    },

    ratePassThrough: 1,
    ratePassThroughEndsAt: 0,
  },

  events: NIXON_BURNS_EVENTS,

  // The toolkit of 1972. No forward guidance — the committee did not publish
  // a path, a statement or a vote until decades later — and no asset
  // purchases as a policy instrument.
  withheldInstruments: ['forward_guidance', 'asset_purchases', 'yield_curve_control'],

  instrumentRanges: {},

  // Structural settings. Transmission is faster than a modern economy's: a
  // banking system without securitisation or a deep mortgage market passes a
  // funds-rate change through in quarters rather than years.
  rateTransmission: 1.15,

  // The Phillips curve of the period was steeper than today's, which is most
  // of why the 1970s happened as they did: a tight labour market moved prices
  // quickly, and expectations moved with them.
  phillipsGapSlope: 1.35,
  gapMeanReversion: 0.55,

  goldStandard: null,

  // Three years of monthly slots, and a period where the right answer changed
  // direction more than once. Generous rather than tight.
  churnAllowancePerYear: 2.4,

  // No operating-procedure choice: the committee targeted the funds rate
  // throughout, and the reserve-targeting experiment is 1979's.
  procedureChoiceAt: null,
  proceduralEventScale: 0.9,

  // The period's own energy story, its own banking failure and its own
  // controls-and-float sequence are all scripted above, on their dates. The
  // drawn catalogue must not put a second oil shock or a second large bank
  // failure on top of them.
  suppressedFamilies: ['energy_commodity', 'banking', 'exchange_rate'],

  benchmarkNote:
    'The benchmark is the effective federal funds rate, month by month, as ' +
    'it actually stood — 3.51 % in January 1972, 12.92 % at the July 1974 ' +
    'peak, 8.53 % by December. It is not a reconstruction of what the ' +
    'committee intended: it is the rate that prevailed, which is the only ' +
    'thing a comparison can honestly be made against.',

  // The event dials are pinned rather than inherited, for the reason the other
  // scenarios pin theirs: a scenario sets its own length, so hard's dials —
  // which were raised to compensate for a shorter fictional term — would
  // retune this period behind its back.
  eventProbability: 0.45,
  eventSeverityScale: 1.1,

  thresholds: {
    // 1972-74 ends at 12.1 % inflation with unemployment at 7.2 %. A mandate
    // that ends roughly where the real one did must not be scored as a failed
    // run: the benchmark comparison is the whole point of a historical
    // mandate, and comparing against a path the game would have dismissed you
    // for taking is not a comparison.
    inflationSpiral: {
      // The benchmark's own last reading is 12.1, which is exactly the
      // fictional bar. Sixteen marks an acceleration past where the real
      // thing ended rather than arrival at it.
      failInflation: 16,
      // And the watch tier above the level the period spends two of its three
      // years at, or the warning panel is lit from the middle of 1973 onwards
      // and stops meaning anything.
      watchInflation: 9,
      failExpectations: 8,
    },
    dismissal: {
      // The one override that is about what the scenario *is*.
      //
      // Political pressure opens at 58 and the period's whole subject is an
      // administration pressing a chairman who did not lose the office over
      // it — he was reappointed in 1974. A dismissal rule that fires on the
      // premise would end the mandate for having been given it. The pressure
      // still costs: it moves expectations, it feeds the demand generator,
      // and yielding to it is recorded. It does not end the run on its own.
      watchPoliticalPressure: 88,
      failCredibility: 12,
      meetingsToFail: 6,
    },
  },
}
