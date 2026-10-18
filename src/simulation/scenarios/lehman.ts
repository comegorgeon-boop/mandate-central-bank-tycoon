import type { Scenario, ScenarioEvent } from '../types/scenario.ts'

/** Sub-steps in one inter-meeting interval. */
const ONE_MEETING = 4
const TWO_MEETINGS = 8
const THREE_MEETINGS = 12

/**
 * The dated events of 2008-10.
 *
 * Fewer than 1929-33 has, and that is deliberate rather than an omission. The
 * autumn of 2008 is mostly *this institution acting*, and the actions belong
 * to the player: the facilities, the balance sheet and the floor are all on
 * the desk. What is scripted is what happened *to* the Federal Reserve —
 * failures, a fiscal programme, a sovereign crisis on another continent — and
 * nothing it chose.
 *
 * That line is the design of this scenario. 1929-33 is about a constraint; the
 * Lehman mandate is about an instrument that runs out, and a scenario that
 * scripted the replacement instruments would be scripting the lesson.
 */
const SCENARIO_EVENTS: readonly ScenarioEvent[] = [
  {
    meetingIndex: 0,
    id: 'lehman_week',
    family: 'banking_failure',
    major: true,
    date: '2008-09-16',
    title: 'The week of the fifteenth',
    newswire:
      'A major investment bank filed for bankruptcy on Monday with no buyer ' +
      'and no public support. The largest insurer in the country is being ' +
      'lent eighty-five billion dollars against its equity. A money market ' +
      'fund has broken the buck and redemptions across the industry are ' +
      'running at tens of billions a day. Three-month dollar funding is ' +
      'trading two points over expected policy and the commercial paper ' +
      'market has stopped rolling.',
    immediate: [
      { variable: 'bankingStress', delta: 30 },
      { variable: 'creditSpread', delta: 2.1 },
      { variable: 'marketVolatility', delta: 38 },
      { variable: 'financialShock', delta: 2.4 },
      { variable: 'assetPricePressure', delta: -18 },
    ],
    delayed: [
      {
        delaySteps: ONE_MEETING,
        effects: [
          { variable: 'creditGrowth', delta: -6.0 },
          { variable: 'demandShock', delta: -2.2 },
          { variable: 'confidenceShock', delta: -2.0 },
        ],
      },
      {
        delaySteps: TWO_MEETINGS,
        effects: [
          { variable: 'outputGap', delta: -3.2 },
          { variable: 'unemployment', delta: 1.4 },
        ],
      },
    ],
  },
  {
    meetingIndex: 1,
    id: 'oil_collapse_2008',
    family: 'energy_commodity',
    major: false,
    date: '2008-10-29',
    title: 'Oil gives back a year in four months',
    newswire:
      'Crude reached a hundred and forty-five dollars in July and is in the ' +
      'sixties today; it will be in the thirties by Christmas. Petrol has ' +
      'halved. Freight rates, metals and food are following it down as the ' +
      'world economy stops. The headline inflation rate that printed 5.6 % in ' +
      'July will print below zero inside three months, and almost none of ' +
      'that is anything policy did.',
    immediate: [
      { variable: 'supplyShock', delta: -1.5 },
      { variable: 'importPriceInflation', delta: -9.0 },
    ],
    delayed: [
      {
        delaySteps: ONE_MEETING,
        effects: [
          { variable: 'supplyShock', delta: -0.6 },
          { variable: 'importPriceInflation', delta: -4.0 },
        ],
      },
      {
        delaySteps: THREE_MEETINGS,
        effects: [
          { variable: 'supplyShock', delta: 0.8 },
          { variable: 'importPriceInflation', delta: 5.0 },
        ],
      },
    ],
  },
  {
    meetingIndex: 1,
    id: 'tarp_october',
    family: 'fiscal',
    major: false,
    date: '2008-10-29',
    title: 'The capital goes in',
    newswire:
      'Seven hundred billion dollars were authorised at the start of the ' +
      'month, and the first two hundred and fifty are going into bank equity ' +
      'rather than into buying their assets. Nine institutions took it ' +
      'together, some of them under protest, so that taking it would not be ' +
      'a signal. Guarantees now cover new senior bank debt and the money ' +
      'funds.',
    immediate: [
      { variable: 'bankingStress', delta: -12 },
      { variable: 'creditSpread', delta: -0.7 },
      { variable: 'fiscalImpulse', delta: 1.2 },
      { variable: 'debtPressure', delta: 7 },
    ],
    delayed: [
      { delaySteps: TWO_MEETINGS, effects: [{ variable: 'bankingStress', delta: -8 }] },
    ],
  },
  {
    meetingIndex: 4,
    id: 'arra_2009',
    family: 'fiscal',
    major: false,
    date: '2009-03-18',
    title: 'The fiscal programme arrives',
    newswire:
      'An eight hundred billion dollar recovery act was signed in February: ' +
      'tax relief, transfers to the states, and infrastructure spread over ' +
      'three years. The deficit is projected near ten per cent of output. ' +
      'Whatever monetary policy does from here, it does alongside this.',
    immediate: [
      { variable: 'fiscalImpulse', delta: 2.2 },
      { variable: 'debtPressure', delta: 11 },
      { variable: 'confidenceShock', delta: 0.8 },
    ],
    delayed: [
      {
        delaySteps: TWO_MEETINGS,
        effects: [
          { variable: 'demandShock', delta: 1.4 },
          { variable: 'outputGap', delta: 1.2 },
        ],
      },
      { delaySteps: THREE_MEETINGS, effects: [{ variable: 'fiscalImpulse', delta: 0.5 }] },
    ],
  },
  {
    meetingIndex: 5,
    id: 'stress_tests_2009',
    family: 'communication',
    major: false,
    date: '2009-04-29',
    title: 'The banks are examined in public',
    newswire:
      'Nineteen holding companies were examined against a common adverse ' +
      'scenario and the results are to be published with the numbers, not ' +
      'summarised. Ten must raise capital within six months. ' +
      'Publishing the examination is the opposite of what supervision ' +
      'normally does, and the argument for it is that the uncertainty is ' +
      'costing more than the bad news will.',
    immediate: [
      { variable: 'bankingStress', delta: -14 },
      { variable: 'marketVolatility', delta: -9 },
      { variable: 'creditSpread', delta: -0.5 },
    ],
    delayed: [
      {
        delaySteps: TWO_MEETINGS,
        effects: [
          { variable: 'bankingStress', delta: -6 },
          { variable: 'creditGrowth', delta: 1.5 },
        ],
      },
    ],
  },
  {
    meetingIndex: 9,
    id: 'dubai_and_greece',
    family: 'exchange_rate',
    major: false,
    date: '2009-11-04',
    title: 'Sovereign credit, somewhere else',
    newswire:
      'A Gulf state investment company has asked for a standstill on its ' +
      'debts, and a new government in Athens has restated last year’s deficit ' +
      'at more than twice the reported figure. Neither is large. What is ' +
      'large is that sovereign credit has become a thing the market prices ' +
      'at all, eighteen months after bank credit became one.',
    immediate: [
      { variable: 'creditSpread', delta: 0.4 },
      { variable: 'marketVolatility', delta: 8 },
      { variable: 'geopoliticalRisk', delta: 9 },
    ],
    delayed: [
      { delaySteps: TWO_MEETINGS, effects: [{ variable: 'financialShock', delta: 0.5 }] },
    ],
  },
  {
    meetingIndex: 13,
    id: 'greek_programme_2010',
    family: 'exchange_rate',
    major: true,
    date: '2010-04-28',
    title: 'The euro area gets its first programme',
    newswire:
      'Greece has asked for assistance and a hundred and ten billion euro ' +
      'package is being assembled with the Fund. Spreads on Portuguese and ' +
      'Irish debt moved with it rather than apart from it, which is the part ' +
      'that matters. Dollar funding for European banks has tightened again ' +
      'and the swap lines that were closed in February are being reopened.',
    immediate: [
      { variable: 'marketVolatility', delta: 14 },
      { variable: 'creditSpread', delta: 0.5 },
      { variable: 'financialShock', delta: 0.9 },
      { variable: 'assetPricePressure', delta: -7 },
    ],
    delayed: [
      {
        delaySteps: ONE_MEETING,
        effects: [
          { variable: 'demandShock', delta: -0.7 },
          { variable: 'confidenceShock', delta: -0.6 },
        ],
      },
    ],
  },
  {
    meetingIndex: 16,
    id: 'disinflation_scare_2010',
    family: 'market_cycle',
    major: false,
    date: '2010-09-21',
    title: 'The word is deflation again',
    newswire:
      'Core inflation has printed below one per cent for three months, the ' +
      'lowest readings in the series’ history, and the five-year inflation ' +
      'compensation priced in the index-linked market has fallen with it. ' +
      'Unemployment has not moved from nine and a half per cent in a year. ' +
      'The committee’s own statement has begun describing inflation as ' +
      'below what is consistent with its mandate.',
    immediate: [
      { variable: 'expectedInflationLong', delta: -0.3 },
      { variable: 'expectedInflationShort', delta: -0.4 },
      { variable: 'anchoring', delta: -0.06 },
    ],
    delayed: [
      { delaySteps: TWO_MEETINGS, effects: [{ variable: 'expectedInflationLong', delta: -0.15 }] },
    ],
  },
]

/**
 * After Lehman, 2008-10.
 *
 * Nineteen meetings, 16 September 2008 to 14 December 2010: from the morning
 * after the filing, with the target at 2 %, to the meeting two months into the
 * second purchase programme.
 *
 * **The instrument runs out in three meetings.** That is the whole design. The
 * rate goes 2.00 → 1.00 → 0-0.25 by December 2008, and from there the mandate
 * is sixteen meetings long with the dial on the floor. What is left is the
 * balance sheet, the facilities, and words — and the scenario is about
 * discovering that those are instruments rather than gestures.
 *
 * Which is why, unlike every other scenario here, this one scripts almost
 * nothing the central bank did. The facilities are on the desk. The purchases
 * are on the desk. A player who leaves them there watches the same economy the
 * passive arm watches, and the counterfactual at the end says so.
 *
 * **Every figure is sourced in `docs/SCENARIOS.md`, and `lehman.test.ts`
 * parses that document and fails if the two disagree.**
 */
export const LEHMAN_2008: Scenario = {
  id: 'lehman_2008',
  title: 'After Lehman',
  subtitle: 'The Federal Reserve, September 2008 to December 2010',
  briefing:
    'An investment bank failed yesterday with no buyer and no support, the ' +
    'largest insurer in the country is being lent against its equity tonight, ' +
    'and three-month dollar funding is trading two points over expected ' +
    'policy. The target is 2 %. Headline inflation is 4.9 % because oil ' +
    'reached a hundred and forty dollars in July, and core is 2.4 %. ' +
    'Unemployment is 6.1 % and rising. You have the rate for about three more ' +
    'meetings. You have two and a quarter years.',
  institution: 'fed',
  // Hard supplies the non-measurement rules. The *data* of 2008 were modern
  // and good; what makes this hard is that the instrument is exhausted and the
  // replacements have no track record, which is a different problem from not
  // being able to see.
  rules: 'hard',
  meetingCount: 19,

  opening: {
    // FRED DFEDTAR: the target in force on the day of the meeting. The monthly
    // average effective rate for September 2008 was 1.81, which is lower
    // because the rate traded below target through the crisis; the target is
    // what the Committee held and so what the player starts holding.
    policyRate: 2.0,
    // Computed from FRED CPIAUCSL and CPILFESL, August 2008 vintage — the last
    // print available at the September meeting.
    inflationHeadline: 4.95,
    inflationCore: 2.44,
    unemployment: 6.1,
    // FRED NROU (CBO), 2008 Q3.
    naturalUnemployment: 5.05,
    // Computed from FRED GDPC1 16854.295 against GDPPOT 16929.753, 2008 Q3.
    // **Today's vintage**, which reads -0.45 %: at the time the published gap
    // was much closer to zero, and the bias below is that difference.
    outputGap: -0.45,
    // FRED GS10, September 2008.
    longRate: 3.69,
    // FRED AHETPI, year-over-year, August 2008 (18.20 against 17.55).
    wageGrowth: 3.7,
    // FRED MICH, September 2008.
    expectedInflationShort: 4.3,
    // FRED T10YIE, the ten-year breakeven as of 15 September 2008 — a market
    // price, observed, and the first scenario in this file whose long-run
    // expectations do not have to be derived from a yield.
    expectedInflationLong: 1.63,
    // Oil at $140 in July and $100 in September: a real cost-push shock, still
    // unwinding. Derived from the model's own identity as in 1979 — headline
    // stands 2.5 points above core.
    supplyShock: 0.9,
    importPriceInflation: 3.6,
    // **Judgements.** The institution had been widely criticised for Bear
    // Stearns in March and for not acting on housing earlier; it also had
    // twenty-five years of successful inflation targeting behind it. High but
    // not untouchable.
    credibility: 68,
    anchoring: 0.78,
    // The financial side, and here it is the whole table. The TED spread stood
    // at 2.04 points on 15 September (FRED TEDRATE) — a published price, on
    // the day, and the number the meeting was actually about.
    bankingStress: 58,
    creditSpread: 2.04,
    marketVolatility: 52,
    assetPricePressure: -14,
    creditGrowth: 1.5,
    // FRED WALCL, 10 September 2008: $925.7bn, against the ~$2.25tn it reached
    // by December. The engine's balance sheet is an index rather than a dollar
    // figure, so this is the opening scaled to the institution's own base.
    balanceSheet: 100,
    // FRED NROU and the CBO's own real-rate assumptions put the neutral real
    // rate near 2 % in 2008, before the post-crisis decline.
    neutralRealRate: 2.0,
  },

  measurement: {
    // Modern statistics: monthly CPI and unemployment on schedule, quarterly
    // national accounts, large revisions in a turning point and small ones
    // otherwise. The noise scales sit *below* hard's own, because this is not
    // a period where the data were bad.
    observationNoiseScale: 0.9,
    revisionScale: 1.3,
    missingObservationProbability: 0.0,
    publicationLagRelief: 0,
    // Wide, and for a reason that is not measurement error: nobody had a
    // forecast distribution for an economy with no interbank market. The
    // fan is honest about a model being outside its range.
    forecastUncertaintyScale: 1.9,

    // **The bias of this period.** Potential output was believed to be much
    // higher than it turned out to be, because the pre-crisis path was assumed
    // to resume — so the real-time gap read far more negative than the gap
    // reads now, and every rule responding to it asked for more easing than
    // the economy could use. The *opposite* sign to 1929-33 and the same sign
    // as 1979-83, which is the pattern Orphanides's work describes: the gap is
    // mismeasured at every turning point, in whichever direction flatters the
    // recent past.
    //
    // Calibrated, not sourced: today's vintage puts the 2008 Q3 gap at -0.45
    // and the 2009 Q2 gap at about -5, while contemporary estimates of the
    // 2009 trough ran past -7. Two points is the conservative reading.
    seriesBias: { output_gap_estimate: -2.0 },

    ratePassThrough: 0,
    ratePassThroughEndsAt: 0,
  },

  // Almost nothing is withheld, and that is the scenario. Interest on reserves
  // was authorised in the Emergency Economic Stabilization Act of October 2008
  // and paid from that month; the purchase programmes began in November 2008;
  // the discount window, the swap lines and the term facilities were all in
  // use within weeks. The reverse repo facility is the one genuine anachronism
  // — it was first tested in 2013 — and forward guidance in its *binding*,
  // calendar-dated form came in August 2011, after this mandate ends.
  withheldInstruments: ['reverse_repo'],

  // The Committee cut 50 bp at a scheduled meeting in October 2008, 75 bp in
  // December, and 75 bp intermeeting in January 2008 before this window. One
  // hundred is enough to reproduce every move inside it.
  instrumentRanges: {
    policy_rate: { min: -100, max: 100, increment: 25 },
  },

  // Set from the path that prevailed: about 2 points of cumulative movement
  // over two and a quarter years and no reversals, because the rate went to
  // the floor and stayed. Below the desk's 3.5 — a mandate where the rate
  // barely moves should charge a player who churns it.
  churnAllowancePerYear: 2.0,

  // **Below 1 rather than above it, and this is the only scenario in the file
  // where that is true.** With the interbank market closed, the policy rate
  // reached the economy through intermediaries that were not functioning: the
  // first 325 bp of cuts between September 2007 and April 2008 did not stop
  // the contraction, and the last 175 went into a system where mortgage
  // spreads over Treasuries were widening faster than the policy rate was
  // falling. A broken transmission is this period's structural fact in the way
  // Regulation Q is 1979's.
  rateTransmission: 0.65,
  // Near the engine's own. The missing disinflation of 2009-10 — core never
  // went below 0.6 % against an output gap near -6 — is the famous flatness,
  // and it is *flatter* than the engine's 0.45 by some margin.
  phillipsGapSlope: 0.18,
  // Low: the recovery was slow and the gap did not close on its own. Real GDP
  // regained its 2007 peak in 2011 and the gap was still negative in 2015.
  gapMeanReversion: 0.45,
  // Unemployment rose from 6.1 % to 10.0 % while the gap fell about 5 points:
  // a touch above the engine's 0.42, and much less extreme than 1929 or 1979
  // because this recession was, by those standards, a normal one.
  okun: 0.5,
  // Below hard's 1.45. The energy collapse of late 2008 and the 2009-10
  // disinflation are scripted on their own dates; the ambient process adds a
  // second oil shock nobody had. Measured, the modelled peak ran to 8.6 %
  // against the 4.95 % the mandate opens on, which is its own historical
  // maximum.
  shockScale: 0.8,
  // Hard's event dials as they stood when this scenario was calibrated. Stated
  // rather than inherited, because hard's own were later raised to compensate
  // for its term being cut to 24 meetings and a scenario sets its own length.
  // See `Scenario.eventSeverityScale`.
  eventProbability: 0.7,
  eventSeverityScale: 1.35,

  goldStandard: null,
  procedureChoiceAt: null,

  // Higher than the other scenarios, at 0.7. 2008-10 has fewer scripted events
  // than 1929-33 because most of what happened was the central bank acting,
  // and the balance has to come from somewhere: the drawn stream is what makes
  // two seeds of this mandate different.
  proceduralEventScale: 0.7,

  // The banking story is scripted above on the dates it happened, and this
  // economy's whole arithmetic runs through banking stress. Letting the
  // catalogue draw its own failures beside them is the same crisis counted
  // twice.
  suppressedFamilies: ['banking_failure', 'energy_commodity'],

  thresholds: {
    bankingCrisis: {
      // The system did not fail, and it did not fail partly because this
      // institution lent against everything it was allowed to lend against.
      // The bar sits above what the autumn of 2008 actually reached, so that
      // the lesson — the facilities are the instrument now — is reachable
      // rather than pre-empted. The watch tier sits at the opening value: a
      // player should be warned about the banks from the first screen, because
      // that is the situation.
      failStress: 92,
      watchStress: 55,
      meetingsToFail: 3,
    },
    deflationSpiral: {
      // The live risk of 2009-10 and the reason the second purchase programme
      // happened. Core CPI printed 0.6 % in late 2010 and the five-year
      // breakeven fell under 1.2 %. Left near the engine's own bar, because
      // here it is doing the job it was built for.
      failInflation: -2.0,
      watchInflation: 0.4,
    },
    inflationSpiral: {
      // The mandate opens at 4.95 % headline on an oil shock that was already
      // reversing — crude fell from $145 to $40 inside six months — so the
      // watch tier would otherwise be lit on the first screen for a risk that
      // was not the risk.
      watchInflation: 7,
      // And the *failure* bar is moved because the model runs about two points
      // hot on headline through this mandate (see the fit table) and, played
      // passively, spiralled a seed out at meeting 17. Ending the Lehman
      // scenario on runaway inflation is the game teaching the opposite of
      // what happened: this period's risk was deflation, the five-year
      // breakeven fell under 1.2 % in 2010, and the second purchase programme
      // existed because of it. Sixteen is above anything the model produces
      // here and still reachable by a player who does something extraordinary.
      failInflation: 16,
      failExpectations: 7,
    },
    dismissal: {
      // Reachable, and it nearly was: the institution's emergency lending was
      // the subject of legislation and of an audit bill that passed the House
      // in 2010. Left at the engine's own bar.
      failCredibility: 25,
      watchCredibility: 40,
    },
    currencyDysfunction: {
      // The mandate *opens* on a volatility of 52 and the Lehman week puts 38
      // more on it; the engine's bar of 90 fired in seven of twelve replays of
      // the historical path, for the autumn of 2008 being the autumn of 2008.
      // The dollar did not fail — it rose, on a flight to it.
      watchVolatility: 80,
      failVolatility: 99,
      failExchangeRateMove: 35,
      meetingsToFail: 4,
    },
    capitulation: {
      // Meaningless here: the real rate is *supposed* to be negative and
      // getting it lower is the objective. Pushed out of reach.
      meetingsToFail: 99,
    },
  },

  benchmarkNote:
    'The upper limit of the federal funds target range, meeting by meeting, ' +
    'from the Committee’s own statements. From 16 December 2008 it is ' +
    '0.25 % and never moves again inside this mandate, which is the point: ' +
    'the column that compares you with history goes flat after three meetings ' +
    'and everything that separates the two paths after that happened ' +
    'somewhere other than the rate.',

  calendar: [
    { date: '2008-09-16', label: 'September 16, 2008', benchmarkRate: 2, actualInflation: 4.95, actualCore: 2.44, actualUnemployment: 6.1 },
    { date: '2008-10-29', label: 'October 29, 2008', benchmarkRate: 1, actualInflation: 3.73, actualCore: 2.22, actualUnemployment: 6.5 },
    { date: '2008-12-16', label: 'December 16, 2008', benchmarkRate: 0.25, actualInflation: -0.02, actualCore: 1.76, actualUnemployment: 7.3 },
    { date: '2009-01-28', label: 'January 28, 2009', benchmarkRate: 0.25, actualInflation: -0.11, actualCore: 1.67, actualUnemployment: 7.8 },
    { date: '2009-03-18', label: 'March 18, 2009', benchmarkRate: 0.25, actualInflation: -0.45, actualCore: 1.79, actualUnemployment: 8.7 },
    { date: '2009-04-29', label: 'April 29, 2009', benchmarkRate: 0.25, actualInflation: -0.58, actualCore: 1.93, actualUnemployment: 9 },
    { date: '2009-06-24', label: 'June 24, 2009', benchmarkRate: 0.25, actualInflation: -1.23, actualCore: 1.71, actualUnemployment: 9.5 },
    { date: '2009-08-12', label: 'August 12, 2009', benchmarkRate: 0.25, actualInflation: -1.48, actualCore: 1.43, actualUnemployment: 9.6 },
    { date: '2009-09-23', label: 'September 23, 2009', benchmarkRate: 0.25, actualInflation: -1.38, actualCore: 1.48, actualUnemployment: 9.8 },
    { date: '2009-11-04', label: 'November 4, 2009', benchmarkRate: 0.25, actualInflation: 1.91, actualCore: 1.71, actualUnemployment: 9.9 },
    { date: '2009-12-16', label: 'December 16, 2009', benchmarkRate: 0.25, actualInflation: 2.81, actualCore: 1.82, actualUnemployment: 9.9 },
    { date: '2010-01-27', label: 'January 27, 2010', benchmarkRate: 0.25, actualInflation: 2.62, actualCore: 1.51, actualUnemployment: 9.8 },
    { date: '2010-03-16', label: 'March 16, 2010', benchmarkRate: 0.25, actualInflation: 2.29, actualCore: 1.16, actualUnemployment: 9.9 },
    { date: '2010-04-28', label: 'April 28, 2010', benchmarkRate: 0.25, actualInflation: 2.21, actualCore: 0.97, actualUnemployment: 9.9 },
    { date: '2010-06-23', label: 'June 23, 2010', benchmarkRate: 0.25, actualInflation: 1.12, actualCore: 0.95, actualUnemployment: 9.4 },
    { date: '2010-08-10', label: 'August 10, 2010', benchmarkRate: 0.25, actualInflation: 1.15, actualCore: 0.92, actualUnemployment: 9.5 },
    { date: '2010-09-21', label: 'September 21, 2010', benchmarkRate: 0.25, actualInflation: 1.12, actualCore: 0.81, actualUnemployment: 9.5 },
    { date: '2010-11-03', label: 'November 3, 2010', benchmarkRate: 0.25, actualInflation: 1.08, actualCore: 0.67, actualUnemployment: 9.8 },
    { date: '2010-12-14', label: 'December 14, 2010', benchmarkRate: 0.25, actualInflation: 1.44, actualCore: 0.66, actualUnemployment: 9.3 },
  ],

  events: SCENARIO_EVENTS,
}
