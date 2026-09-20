import type { Scenario, ScenarioEvent } from '../types/scenario.ts'

/** Sub-steps in one inter-meeting interval. */
const ONE_MEETING = 4
const TWO_MEETINGS = 8
const THREE_MEETINGS = 12

/**
 * The dated events.
 *
 * Scripted, because they happened on dates, and a 1980 with no credit
 * controls in it is not 1980. The procedural catalogue still draws beside
 * them at reduced probability, which is where a different seed gets a
 * different mandate out of the same history.
 *
 * Each newswire says what happened and quotes nobody. That rule is the reason
 * these are written as reports rather than as scenes: the cost of putting one
 * invented sentence in a real person's mouth is higher than anything the
 * sentence could add, and a player revising from this has to be able to trust
 * every line of it.
 */
const SCENARIO_EVENTS: readonly ScenarioEvent[] = [
  {
    meetingIndex: 1,
    id: 'october_1979',
    family: 'communication',
    major: true,
    date: '1979-10-06',
    title: 'The Saturday meeting',
    newswire:
      'The Board raises the discount rate from 11 % to 12 % and imposes an ' +
      '8 % marginal reserve requirement on managed liabilities. At an ' +
      'unscheduled Saturday meeting the Committee changes how policy is ' +
      'conducted: more weight on the supply of bank reserves, less on ' +
      'holding the funds rate inside a narrow range. Markets will have to ' +
      'find the rate themselves.',
    immediate: [
      { variable: 'marketVolatility', delta: 9 },
      { variable: 'credibility', delta: 4 },
      { variable: 'termPremium', delta: 0.4 },
    ],
    delayed: [
      { delaySteps: TWO_MEETINGS, effects: [{ variable: 'anchoring', delta: 0.03 }] },
    ],
  },
  {
    meetingIndex: 2,
    id: 'oil_second_shock',
    family: 'energy_commodity',
    major: false,
    date: '1979-11-20',
    title: 'Crude keeps climbing',
    newswire:
      'Iranian exports have not recovered and the producers have raised ' +
      'posted prices again. Crude is now more than double its level at the ' +
      'start of the year, and the increases are still coming through into ' +
      'petrol, heating oil and freight. Nothing in the pipeline has stopped.',
    immediate: [
      { variable: 'supplyShock', delta: 1.0 },
      { variable: 'importPriceInflation', delta: 4.0 },
      { variable: 'geopoliticalRisk', delta: 12 },
    ],
    delayed: [
      {
        delaySteps: ONE_MEETING,
        effects: [
          { variable: 'supplyShock', delta: 0.55 },
          { variable: 'importPriceInflation', delta: 2.0 },
        ],
      },
      { delaySteps: TWO_MEETINGS, effects: [{ variable: 'supplyShock', delta: 0.27 }] },
    ],
  },
  {
    meetingIndex: 10,
    id: 'gulf_war_oil',
    family: 'geopolitical',
    major: false,
    date: '1980-11-18',
    title: 'War between two producers',
    newswire:
      'Fighting between Iraq and Iran has taken a large share of Gulf ' +
      'production off the market and put the rest at risk. Crude has spiked ' +
      'again and tanker insurance with it. Whatever else this year was ' +
      'going to be, it is now also a second supply interruption.',
    immediate: [
      { variable: 'supplyShock', delta: 0.7 },
      { variable: 'importPriceInflation', delta: 3.0 },
      { variable: 'geopoliticalRisk', delta: 20 },
      { variable: 'marketVolatility', delta: 6 },
    ],
    delayed: [
      { delaySteps: TWO_MEETINGS, effects: [{ variable: 'supplyShock', delta: -0.4 }] },
    ],
  },
  {
    meetingIndex: 5,
    id: 'credit_controls_imposed',
    family: 'fiscal',
    major: true,
    date: '1980-03-18',
    title: 'Credit controls',
    newswire:
      'The administration invokes the Credit Control Act of 1969 and the ' +
      'Federal Reserve puts a Special Credit Restraint Program in place: ' +
      'deposits required against increases in certain consumer credit, ' +
      'restraint asked of banks on lending growth. Consumer borrowing stops ' +
      'almost at once, and by considerably more than anyone intended.',
    immediate: [
      { variable: 'creditGrowth', delta: -6.5 },
      { variable: 'demandShock', delta: -1.9 },
      { variable: 'confidenceShock', delta: -1.1 },
      { variable: 'creditSpread', delta: 0.5 },
    ],
    delayed: [
      {
        delaySteps: ONE_MEETING,
        effects: [
          { variable: 'outputGap', delta: -2.4 },
          { variable: 'unemployment', delta: 0.9 },
        ],
      },
    ],
  },
  {
    meetingIndex: 7,
    id: 'credit_controls_lifted',
    family: 'fiscal',
    major: false,
    date: '1980-07-09',
    title: 'The controls come off',
    newswire:
      'The credit restraint programme is dismantled. Borrowing resumes ' +
      'immediately and the sharpest quarterly contraction since the war ' +
      'reverses almost as fast as it arrived. Prices never stopped rising ' +
      'through any of it.',
    immediate: [
      { variable: 'creditGrowth', delta: 7.0 },
      { variable: 'demandShock', delta: 2.0 },
      { variable: 'confidenceShock', delta: 1.2 },
    ],
    delayed: [
      {
        delaySteps: ONE_MEETING,
        effects: [
          { variable: 'outputGap', delta: 2.2 },
          { variable: 'unemployment', delta: -0.6 },
        ],
      },
      {
        delaySteps: TWO_MEETINGS,
        effects: [{ variable: 'demandShock', delta: 0.7 }],
      },
    ],
  },
  {
    meetingIndex: 29,
    id: 'opec_price_cut_1983',
    family: 'energy_commodity',
    major: false,
    date: '1983-03-28',
    title: 'The oil price is cut',
    newswire:
      'For the first time in its history the producers cartel has lowered ' +
      'its official price, from 34 to 29 dollars a barrel, after two years ' +
      'of falling demand and rising supply from outside it. The decade of ' +
      'energy driving the price level is over, and it ends on the way down.',
    immediate: [
      { variable: 'supplyShock', delta: -0.75 },
      { variable: 'importPriceInflation', delta: -4.0 },
      { variable: 'geopoliticalRisk', delta: -8 },
    ],
    delayed: [
      { delaySteps: TWO_MEETINGS, effects: [{ variable: 'supplyShock', delta: -0.25 }] },
    ],
  },
  {
    meetingIndex: 16,
    id: 'tax_act_1981',
    family: 'fiscal',
    major: false,
    date: '1981-08-18',
    title: 'A large tax cut is signed',
    newswire:
      'The Economic Recovery Tax Act becomes law: marginal rates cut in ' +
      'stages over three years, accelerated depreciation for business, and ' +
      'from 1985 the brackets indexed to inflation. Projected deficits widen ' +
      'sharply. Fiscal policy is now pulling against monetary policy, in ' +
      'public, for the rest of this mandate.',
    immediate: [
      { variable: 'fiscalImpulse', delta: 1.5 },
      { variable: 'debtPressure', delta: 9 },
      { variable: 'termPremium', delta: 0.35 },
    ],
    delayed: [
      { delaySteps: TWO_MEETINGS, effects: [{ variable: 'demandShock', delta: 0.8 }] },
      { delaySteps: THREE_MEETINGS, effects: [{ variable: 'fiscalImpulse', delta: 0.5 }] },
    ],
  },
  {
    meetingIndex: 24,
    id: 'debt_crisis_1982',
    family: 'banking_failure',
    major: true,
    date: '1982-08-24',
    title: 'A sovereign borrower suspends payments',
    newswire:
      'Mexico announces it cannot meet payments on its external debt. The ' +
      'exposure of the large money-centre banks to Latin American borrowers ' +
      'is suddenly the only subject in the market, and it is very large. ' +
      'Other borrowers are expected to follow.',
    immediate: [
      { variable: 'bankingStress', delta: 16 },
      { variable: 'creditSpread', delta: 0.8 },
      { variable: 'marketVolatility', delta: 11 },
      { variable: 'financialShock', delta: 1.2 },
    ],
    delayed: [
      {
        delaySteps: ONE_MEETING,
        effects: [
          { variable: 'bankingStress', delta: 5 },
          { variable: 'creditGrowth', delta: -2.0 },
        ],
      },
      { delaySteps: THREE_MEETINGS, effects: [{ variable: 'bankingStress', delta: -8 }] },
    ],
  },
  {
    meetingIndex: 25,
    id: 'm1_deemphasised',
    family: 'communication',
    major: false,
    date: '1982-10-05',
    title: 'The monetary target is set aside',
    newswire:
      'The Committee gives much less weight to its M1 target. Deregulation ' +
      'has made the aggregate mean something different from one month to the ' +
      'next, and a target nobody can interpret is not a constraint. Whatever ' +
      'replaces it, the rule that was supposed to take discretion out of ' +
      'this office has just been set aside by the people it was binding.',
    immediate: [
      { variable: 'marketVolatility', delta: -6 },
      { variable: 'credibility', delta: -2 },
    ],
    delayed: [
      { delaySteps: TWO_MEETINGS, effects: [{ variable: 'marketVolatility', delta: -3 }] },
    ],
  },
]

/**
 * Volcker, 1979-83.
 *
 * Thirty-two meetings, 14 August 1979 to 12 July 1983: from the first FOMC
 * meeting Paul Volcker chaired, with headline inflation at 11.8 % and
 * expectations unanchored, to the meeting at which it printed 2.4 %.
 *
 * The only winnable one of the five designed scenarios, and the point is what
 * winning costs. The whole bill for a disinflation arrives before any of its
 * benefit: unemployment peaks at 10.8 % in late 1982, more than two years
 * after the tightening began and after inflation had already halved.
 *
 * **Every figure here is sourced in `docs/SCENARIOS.md`, and
 * `volcker.test.ts` parses that document and fails if the two disagree.**
 * Approximations are marked in both places. Nothing anybody said is quoted.
 */

export const VOLCKER_1979: Scenario = {
  id: 'volcker_1979',
  title: 'Volcker',
  subtitle: 'The Federal Reserve, August 1979 to July 1983',
  briefing:
    'Inflation has run above 10 % for a year and nobody believes it is ' +
    'coming down. Two oil shocks in six years have taught firms and unions ' +
    'to write the next rise into their prices and their contracts before it ' +
    'arrives, which is most of the reason it does. The funds rate is 10.94 % ' +
    'and real short rates are close to nothing. The labour market is tight. ' +
    'You have four years.',
  institution: 'fed',
  // Hard supplies the non-measurement rules: the instrument ranges, the
  // information ladder, the scoring weights. What was knowable in 1979 is in
  // `measurement` below and is the scenario's own.
  rules: 'hard',
  meetingCount: 32,

  opening: {
    policyRate: 10.94,
    inflationHeadline: 11.84,
    inflationCore: 9.98,
    unemployment: 6.0,
    naturalUnemployment: 6.23,
    outputGap: 0.78,
    longRate: 9.03,
    wageGrowth: 8.11,
    expectedInflationShort: 9.9,
    // The one approximation in the table. No monthly survey or market measure
    // of ten-year inflation expectations exists for 1979; this is the
    // ten-year Treasury yield of 9.03 % less an assumed 2 % long-run real
    // rate, rounded. A derivation from a sourced number, not a measurement,
    // and the derivation is the whole of its authority.
    expectedInflationLong: 7.0,

    // Derived rather than observed, and derived from the model's own identity
    // rather than guessed: headline stands 1.86 points above core, and in
    // this engine that wedge is exactly what a cost-push shock produces —
    // `0.06 x importPrices + 2.4 x supplyShock`, with import prices resting at
    // twice the shock. Solving gives 0.74 and 1.48. Without them the model
    // would read the wedge as an inconsistency and close it in three
    // meetings, handing the player two free points of disinflation that the
    // second oil shock was in fact still adding to.
    supplyShock: 0.74,
    importPriceInflation: 1.48,

    // Approximations, and on a weaker footing than the rest: an institution
    // whose last three chairmen had each presided over a rise in inflation,
    // holding an anchor that had already slipped.
    credibility: 45,
    anchoring: 0.45,
  },

  measurement: {
    // Hard's own scales: monthly prints with a short lag, national accounts
    // with a long one and large revisions. No separate claim is made about
    // 1979 release calendars beyond the two biases below.
    observationNoiseScale: 1.35,
    revisionScale: 1.4,
    missingObservationProbability: 0.08,
    publicationLagRelief: 0,
    forecastUncertaintyScale: 1.4,

    // The single most important fact about reading this economy. Real-time
    // output gap estimates were systematically too pessimistic, so every rule
    // that responds to the gap prescribed an easier policy than the situation
    // required — Orphanides's argument, and here it is a number rather than a
    // paragraph. Average real-time misperception after mid-1979: -3.6 points.
    seriesBias: { output_gap_estimate: -3.6 },

    // Until January 1983 the CPI-U measured owner-occupied housing with an
    // asset-price approach that included mortgage interest costs, so
    // tightening fed straight into the index the Fed was judged on. Calibrated
    // against the CPI-U-X1 comparison in docs/SCENARIOS.md: it reproduces the
    // right sign and order on both the way up and the way down, and it is not
    // a measured elasticity.
    ratePassThrough: 0.4,
    // Meeting 28 is labelled 8 February 1983, the first slot after the
    // methodology changed with the January 1983 index.
    ratePassThroughEndsAt: 28,
  },

  // Nothing the Fed of 1979 did not have. Interest on reserves arrived in
  // 2008, asset purchases in 2008, the overnight reverse repo facility in
  // 2013. Forward guidance is withheld for a different reason and a better
  // one: the FOMC did not announce its policy decisions at all until February
  // 1994, and after October 1979 it was not targeting the rate it would have
  // been announcing. Communication stays; binding commitments do not.
  withheldInstruments: [
    'iorb_spread',
    'asset_purchases',
    'balance_sheet_runoff',
    'reverse_repo',
    'forward_guidance',
  ],

  // The desk's 200 bp describes a modern committee voting a target. The
  // effective funds rate moved more than that between consecutive labelled
  // meetings ten times in this period, and by 621 bp once — March to May 1980
  // — so a player capped at 200 could not reach the path the standard at the
  // end compares them with. Three hundred, in the same quarter-point detents,
  // which is still short of the largest move and is meant to be: the very
  // largest ones were not votes.
  instrumentRanges: {
    policy_rate: { min: -300, max: 300, increment: 25 },
  },

  // Set from the path that actually prevailed: 50.5 points of cumulative
  // movement over four years, 12.6 a year, twelve direction reversals. The
  // desk's ordinary allowance is 3.5 a year, which describes a committee that
  // is not doing this; against it every conceivable mandate here, including
  // the one that actually happened, scores a steadiness gate of 0.03 and the
  // score stops measuring anything. Thirteen means: a player steadier than
  // the history pays nothing, and one less steady pays.
  churnAllowancePerYear: 13,

  // Regulation Q. When market rates rose past the deposit ceilings, thrifts
  // and banks lost their funding outright and mortgage credit stopped being
  // available rather than merely repricing; housing starts roughly halved
  // between 1979 and 1982, and the 1980 credit controls did the same to
  // consumer credit inside one quarter. Calibrated, not estimated: see the fit
  // table in docs/SCENARIOS.md. At 1.0 the model runs the funds rate to 19 %
  // and produces an output gap of +0.4, which is not a recession and makes the
  // sacrifice ratio invisible.
  rateTransmission: 2.2,
  // Below the engine's 0.45, which its own comment calls above the modern
  // empirical range and defends as the price of a twelve-meeting mandate. A
  // four-year mandate does not need the discount, and at 0.45 an output gap of
  // -7 drives core inflation below zero by 1983 against the 4.5 % that
  // actually printed. The sacrifice ratio is what this scenario teaches and a
  // steep curve makes it cheap.
  phillipsGapSlope: 0.35,
  gapMeanReversion: 0.83,

  // 6 October 1979, the unscheduled Saturday meeting.
  procedureChoiceAt: 1,

  // Reduced but not switched off: the dated events make this recognisable as
  // 1979-83, the drawn ones make two seeds of it different mandates.
  proceduralEventScale: 0.5,

  // The oil story of 1979-83 is scripted above, twice, on the dates it
  // happened. Letting the procedural catalogue draw its own energy shocks
  // beside them is not extra variety, it is the same history counted twice.
  // Everything else — productivity, banking, housing, wages, market cycles —
  // still draws, which is where two seeds of this mandate differ.
  suppressedFamilies: ['energy_commodity'],

  // Only where the fictional calibration would call August 1979 already lost.
  // Nothing here makes a catastrophe unreachable; each is argued in
  // docs/SCENARIOS.md against the number the mandate actually opens on.
  thresholds: {
    inflationSpiral: {
      // Opens at 11.84 % against a threshold of 12. Eighteen is four points
      // above the actual 1980 peak, so it still marks acceleration away from
      // a situation that was already bad rather than the situation itself.
      failInflation: 20,
      // Long-run expectations open at 7 %, five points above a 2 % objective.
      failExpectations: 11,
      // And the watch tier has to sit above the opening too, or the warning
      // panel is lit from the first meeting and means nothing thereafter.
      watchInflation: 13,
    },
    lossOfMonetaryControl: {
      // The opening miss is five points. Nine is the level at which the
      // anchor has plainly gone rather than merely slipped.
      failExpectationsMiss: 9,
    },
    bankingCrisis: {
      // The system really was under this much strain: Penn Square failed in
      // July 1982, a sovereign borrower suspended payments in August, and the
      // money-centre banks' Latin American exposure was the only subject in
      // the market for a year. It did not fail systemically, and one reason
      // is that the Federal Reserve lent — which the player can do here, and
      // which is the lesson the bar exists to make teachable. Ninety-five,
      // held three meetings rather than two.
      failStress: 95,
      watchStress: 62,
      meetingsToFail: 3,
    },
    dismissal: {
      // Out of reach, deliberately, and this is the one override that changes
      // what the scenario *is* rather than what its numbers are.
      //
      // The fictional bar assumes a bank starting near 75; this mandate opens
      // at 45, which is one bad year of distance, and it opens there because
      // that is the standing the office actually had. More to the point, it
      // is the wrong ending for this scenario. The person who held this office
      // through 1979-83 faced bills in Congress, builders posting lumber to
      // the Board and dealers posting car keys, and was reappointed in 1983.
      // You cannot lose this mandate by being hated. You lose it by giving
      // in, which is `capitulation` below.
      failCredibility: 0,
      watchCredibility: 22,
    },
    capitulation: {
      // Five, not four, and the extra meeting is the whole of 1980 in it.
      // Real short rates were negative from May to September of that year —
      // four meetings on this calendar — and the Federal Reserve came back.
      // At four the scenario would end on the episode that history survived;
      // at five, a player who repeats 1980 comes within one meeting of losing
      // the mandate, which is the right amount of frightening.
      meetingsToFail: 5,
    },
  },

  benchmarkNote:
    'The effective federal funds rate that actually prevailed, month by ' +
    'month. It is not a target the Committee voted: between October 1979 and ' +
    'October 1982 the FOMC voted reserve paths, and the rate is an outcome of ' +
    'those votes rather than an instruction. That is the whole point of the ' +
    'period, and it is why this column is what prevailed rather than what was ' +
    'decided.',

  calendar: [
  { date: '1979-08-14', label: 'August 14, 1979', benchmarkRate: 10.94 },
  { date: '1979-10-06', label: 'October 6, 1979', benchmarkRate: 13.77 },
  { date: '1979-11-20', label: 'November 20, 1979', benchmarkRate: 13.18 },
  { date: '1980-01-08', label: 'January 8, 1980', benchmarkRate: 13.82 },
  { date: '1980-02-04', label: 'February 4, 1980', benchmarkRate: 14.13 },
  { date: '1980-03-18', label: 'March 18, 1980', benchmarkRate: 17.19 },
  { date: '1980-05-20', label: 'May 20, 1980', benchmarkRate: 10.98 },
  { date: '1980-07-09', label: 'July 9, 1980', benchmarkRate: 9.03 },
  { date: '1980-08-12', label: 'August 12, 1980', benchmarkRate: 9.61 },
  { date: '1980-09-16', label: 'September 16, 1980', benchmarkRate: 10.87 },
  { date: '1980-11-18', label: 'November 18, 1980', benchmarkRate: 15.85 },
  { date: '1980-12-18', label: 'December 18, 1980', benchmarkRate: 18.90 },
  { date: '1981-02-02', label: 'February 2, 1981', benchmarkRate: 15.93 },
  { date: '1981-03-31', label: 'March 31, 1981', benchmarkRate: 14.70 },
  { date: '1981-05-18', label: 'May 18, 1981', benchmarkRate: 18.52 },
  { date: '1981-07-06', label: 'July 6, 1981', benchmarkRate: 19.04 },
  { date: '1981-08-18', label: 'August 18, 1981', benchmarkRate: 17.82 },
  { date: '1981-10-05', label: 'October 5, 1981', benchmarkRate: 15.08 },
  { date: '1981-11-17', label: 'November 17, 1981', benchmarkRate: 13.31 },
  { date: '1981-12-21', label: 'December 21, 1981', benchmarkRate: 12.37 },
  { date: '1982-02-01', label: 'February 1, 1982', benchmarkRate: 14.78 },
  { date: '1982-03-29', label: 'March 29, 1982', benchmarkRate: 14.68 },
  { date: '1982-05-18', label: 'May 18, 1982', benchmarkRate: 14.45 },
  { date: '1982-06-30', label: 'June 30, 1982', benchmarkRate: 14.15 },
  { date: '1982-08-24', label: 'August 24, 1982', benchmarkRate: 10.12 },
  { date: '1982-10-05', label: 'October 5, 1982', benchmarkRate: 9.71 },
  { date: '1982-11-16', label: 'November 16, 1982', benchmarkRate: 9.20 },
  { date: '1982-12-20', label: 'December 20, 1982', benchmarkRate: 8.95 },
  { date: '1983-02-08', label: 'February 8, 1983', benchmarkRate: 8.51 },
  { date: '1983-03-28', label: 'March 28, 1983', benchmarkRate: 8.77 },
  { date: '1983-05-24', label: 'May 24, 1983', benchmarkRate: 8.63 },
  { date: '1983-07-12', label: 'July 12, 1983', benchmarkRate: 9.37 },
  ],

  events: SCENARIO_EVENTS,
}
