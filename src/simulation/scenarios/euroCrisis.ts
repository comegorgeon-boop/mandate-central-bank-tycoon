import type { Scenario, ScenarioEvent } from '../types/scenario.ts'

/** Sub-steps in one inter-meeting interval. */
const ONE_MEETING = 4
const TWO_MEETINGS = 8
const THREE_MEETINGS = 12

/**
 * The dated events of 2010-12.
 *
 * More of these than any other scenario has, because this crisis *was* a
 * sequence of dated events in a way the others were not: each programme, each
 * downgrade, each summit moved the spreads by a known amount on a known day,
 * and the spreads are the whole mechanism here.
 *
 * Two things this file is careful about, both of which are rules of the
 * project rather than choices made here. **Nobody is quoted.** The most famous
 * sentence in the history of this institution was said inside this window, in
 * London, on 26 July 2012, and it does not appear — the event that covers that
 * date reports a change in policy and the market's response to it, which is
 * what a newswire would carry. And **no living politician is named**: what
 * governments did is in the game, under the name of the government.
 */
const SCENARIO_EVENTS: readonly ScenarioEvent[] = [
  {
    meetingIndex: 3,
    id: 'greek_programme_smp',
    family: 'exchange_rate',
    major: true,
    date: '2010-06-10',
    title: 'A programme, and a bond desk',
    newswire:
      'Greece took a hundred and ten billion euro in May and the area set up ' +
      'a facility for whoever comes next. This institution began buying ' +
      'government bonds in the secondary market the same week and has taken ' +
      'about forty billion onto its books, sterilising the lot. The stated ' +
      'reason is that the transmission of its own policy had stopped ' +
      'working in part of the area. Several of its own council have made ' +
      'their votes against it public.',
    immediate: [
      { variable: 'fragmentation', delta: 90 },
      { variable: 'marketVolatility', delta: 13 },
      { variable: 'creditSpread', delta: 0.35 },
      { variable: 'credibility', delta: -4 },
    ],
    delayed: [
      { delaySteps: TWO_MEETINGS, effects: [{ variable: 'fragmentation', delta: 50 }] },
    ],
  },
  {
    meetingIndex: 6,
    id: 'ireland_programme',
    family: 'banking_failure',
    major: true,
    date: '2010-10-07',
    title: 'A banking system larger than its state',
    newswire:
      'Ireland’s bank guarantee has become the sovereign’s problem: the ' +
      'deficit will print above thirty per cent of output once the ' +
      'recapitalisations are counted. Irish ten-year yields are through ' +
      'seven per cent and the banks are funding almost entirely from this ' +
      'institution’s own operations. A programme is being negotiated.',
    immediate: [
      { variable: 'fragmentation', delta: 120 },
      { variable: 'bankingStress', delta: 16 },
      { variable: 'creditSpread', delta: 0.5 },
      { variable: 'financialShock', delta: 1.0 },
    ],
    delayed: [
      {
        delaySteps: ONE_MEETING,
        effects: [
          { variable: 'creditGrowth', delta: -2.5 },
          { variable: 'demandShock', delta: -0.8 },
        ],
      },
    ],
  },
  {
    meetingIndex: 10,
    id: 'oil_and_fukushima',
    family: 'energy_commodity',
    major: false,
    date: '2011-04-07',
    title: 'Oil at a hundred and twenty',
    newswire:
      'Libyan production is off the market and the rest of the region is ' +
      'unsettled; Brent has gone through a hundred and twenty dollars. The ' +
      'earthquake in Japan has taken a fifth of that country’s generation ' +
      'offline and the liquefied gas it is buying instead is bidding up ' +
      'European contracts. Headline inflation is at 2.8 % and the second ' +
      'round has not happened.',
    immediate: [
      { variable: 'supplyShock', delta: 0.85 },
      { variable: 'importPriceInflation', delta: 4.5 },
      { variable: 'geopoliticalRisk', delta: 16 },
    ],
    delayed: [
      {
        delaySteps: ONE_MEETING,
        effects: [{ variable: 'supplyShock', delta: 0.35 }],
      },
      {
        delaySteps: THREE_MEETINGS,
        effects: [
          { variable: 'supplyShock', delta: -0.6 },
          { variable: 'importPriceInflation', delta: -3.0 },
        ],
      },
    ],
  },
  {
    meetingIndex: 13,
    id: 'italy_in_the_firing_line',
    family: 'exchange_rate',
    major: true,
    date: '2011-09-08',
    title: 'The third largest borrower in the world',
    newswire:
      'Italian ten-year yields went through six per cent in August and the ' +
      'bond desk reopened to buy them and Spain’s. Italy carries about one ' +
      'and nine tenths trillion euro of debt, which is more than any ' +
      'facility the area has built. The Bundesbank’s president resigned from ' +
      'this institution’s executive board on the ninth. The spread to ' +
      'Germany has gone from under two points to nearly four in a year.',
    immediate: [
      { variable: 'fragmentation', delta: 170 },
      { variable: 'marketVolatility', delta: 18 },
      { variable: 'bankingStress', delta: 14 },
      { variable: 'credibility', delta: -5 },
      { variable: 'financialShock', delta: 1.1 },
    ],
    delayed: [
      {
        delaySteps: ONE_MEETING,
        effects: [
          { variable: 'creditGrowth', delta: -3.0 },
          { variable: 'demandShock', delta: -1.2 },
        ],
      },
      {
        delaySteps: TWO_MEETINGS,
        effects: [
          { variable: 'outputGap', delta: -1.6 },
          { variable: 'unemployment', delta: 0.5 },
        ],
      },
    ],
  },
  {
    meetingIndex: 15,
    id: 'ltro_december_2011',
    family: 'banking_failure',
    major: true,
    date: '2011-12-08',
    title: 'Three-year money, as much as they want',
    newswire:
      'Two refinancing operations at three years, fixed rate, full ' +
      'allotment, against a widened collateral list. Five hundred billion ' +
      'went out in December and five hundred more will go in February. The ' +
      'funding cliff the banks were facing in the first half of next year ' +
      'is gone. What they do with it is their own affair, and a good deal of ' +
      'it is going into their own government’s paper.',
    immediate: [
      { variable: 'bankingStress', delta: -22 },
      { variable: 'fragmentation', delta: -90 },
      { variable: 'creditSpread', delta: -0.6 },
      { variable: 'marketVolatility', delta: -11 },
    ],
    delayed: [
      {
        delaySteps: TWO_MEETINGS,
        effects: [
          { variable: 'bankingStress', delta: -9 },
          { variable: 'creditGrowth', delta: 1.8 },
        ],
      },
      // And it wears off. The rally that followed the operations had
      // completely reversed by April, which is the lesson of this one: a
      // liquidity answer to a solvency question buys months.
      {
        delaySteps: THREE_MEETINGS,
        effects: [{ variable: 'fragmentation', delta: 70 }],
      },
    ],
  },
  {
    meetingIndex: 18,
    id: 'spain_banks_2012',
    family: 'banking_failure',
    major: false,
    date: '2012-04-04',
    title: 'The Spanish banks need a programme of their own',
    newswire:
      'The savings banks’ property losses have been restated upward twice ' +
      'and the largest of the merged groups is being taken into public ' +
      'hands. Spanish ten-year yields are back near six per cent and the ' +
      'spread to Germany is wider than it was before the refinancing ' +
      'operations. The question being asked is whether the sovereign can ' +
      'carry its banks, which is the question Ireland answered badly.',
    immediate: [
      { variable: 'fragmentation', delta: 140 },
      { variable: 'bankingStress', delta: 15 },
      { variable: 'creditSpread', delta: 0.45 },
    ],
    delayed: [
      {
        delaySteps: ONE_MEETING,
        effects: [
          { variable: 'creditGrowth', delta: -2.2 },
          { variable: 'demandShock', delta: -0.9 },
        ],
      },
    ],
  },
  {
    meetingIndex: 20,
    id: 'convertibility_risk',
    family: 'exchange_rate',
    major: true,
    date: '2012-07-05',
    title: 'The market is pricing exits',
    newswire:
      'Spanish ten-year yields are through seven per cent and Italy’s ' +
      'through six. What is being priced is no longer only the chance of a ' +
      'default: it is the chance that a bond is repaid in a currency that ' +
      'does not exist yet. Deposits are leaving the periphery for the core ' +
      'at a rate the balance of payments inside the union can be read off ' +
      'directly. A single policy rate does not reach an area whose halves ' +
      'borrow four points apart.',
    immediate: [
      { variable: 'fragmentation', delta: 210 },
      { variable: 'marketVolatility', delta: 20 },
      { variable: 'bankingStress', delta: 18 },
      { variable: 'confidenceShock', delta: -1.1 },
    ],
    delayed: [
      {
        delaySteps: ONE_MEETING,
        effects: [
          { variable: 'creditGrowth', delta: -3.5 },
          { variable: 'outputGap', delta: -1.4 },
        ],
      },
    ],
  },
  {
    meetingIndex: 21,
    id: 'omt_2012',
    family: 'communication',
    major: true,
    date: '2012-09-06',
    title: 'An unlimited promise, on conditions',
    newswire:
      'Outright monetary transactions: purchases of short-dated government ' +
      'bonds in the secondary market, with no ex ante limit, for any country ' +
      'that has applied for a programme and is meeting it. No money has been ' +
      'spent. Spanish and Italian yields have fallen a point and a half ' +
      'since the announcement was trailed in July. One member of the council ' +
      'voted against, publicly.',
    immediate: [
      { variable: 'fragmentation', delta: -260 },
      { variable: 'marketVolatility', delta: -17 },
      { variable: 'bankingStress', delta: -14 },
      { variable: 'credibility', delta: 7 },
    ],
    delayed: [
      {
        delaySteps: TWO_MEETINGS,
        effects: [
          { variable: 'fragmentation', delta: -70 },
          { variable: 'creditGrowth', delta: 1.4 },
          { variable: 'confidenceShock', delta: 0.9 },
        ],
      },
    ],
  },
]

/**
 * The euro area, 2010-12.
 *
 * Twenty-four meetings, 14 January 2010 to 6 December 2012: from the month
 * after Greece's deficit was restated, to the meeting three months after the
 * announcement that ended the crisis without spending anything.
 *
 * **The aggregate is nearly beside the point.** Area inflation spends the
 * whole mandate between 0.9 % and 3.1 % — a central bank's ordinary problem —
 * while the spread between German and Italian ten-year yields goes from 0.82
 * to 4.88 and back. A player who reads the area's average and sets a rate for
 * it will do a competent job of the wrong task. What the scenario is about is
 * the second instrument: the spread, and what reaches the half of the area
 * that is not borrowing at the policy rate.
 *
 * The two rate rises of 2011 are the trap, and they are in the benchmark path
 * so the comparison at the end is unavoidable: April and July 2011, 25 bp
 * each, into an oil shock, reversed in November and December of the same year.
 *
 * **Every figure is sourced in `docs/SCENARIOS.md`, and `euroCrisis.test.ts`
 * parses that document and fails if the two disagree.**
 */
export const EURO_CRISIS_2010: Scenario = {
  id: 'euro_crisis_2010',
  title: 'One rate, several economies',
  subtitle: 'The European Central Bank, January 2010 to December 2012',
  briefing:
    'The area is out of recession and inflation is below one per cent. The ' +
    'main refinancing rate has been at 1.00 % for eight months. A new ' +
    'government in Athens has restated last year’s deficit at more than ' +
    'twice the reported figure, and Greek ten-year yields now sit nearly ' +
    'three points above German ones. Portugal is a point above, Ireland a ' +
    'point and a half. You set one rate for sixteen economies, and four of ' +
    'them are no longer borrowing at it. You have three years.',
  institution: 'ecb',
  rules: 'hard',
  meetingCount: 24,

  opening: {
    // FRED ECBMRRFR as of 14 January 2010: the main refinancing rate, which is
    // the rate this institution announces and the one the game's dial is.
    policyRate: 1.0,
    // Computed from FRED CP0000EZ19M086NEST, year-over-year, December 2009 —
    // the last print available at the January meeting.
    inflationHeadline: 0.92,
    // **Derived.** The euro area's core HICP is published, but not as a single
    // FRED series on the same vintage as the headline index this table uses.
    // Set 0.3 points below headline, which is where core sat through 2009-10
    // while energy pulled the headline around. Marked as a derivation in both
    // places.
    inflationCore: 0.62,
    // FRED LRHUTTTTEZM156S, December 2009.
    unemployment: 10.2,
    // **A judgement.** No euro-area equivalent of CBO's NROU is published.
    // The engine's own ECB sustainable rate is 6.6 %; this period's area was
    // structurally worse than that and the estimates of the time ran 8.5 to
    // 9.5. Set to 9.0, and the gap between it and the 10.2 printed is the
    // slack this mandate opens with.
    naturalUnemployment: 9.0,
    // **Derived** from the unemployment gap through this scenario's own Okun
    // coefficient: (9.0 - 10.2) / 0.55 = -2.2.
    outputGap: -2.2,
    // FRED IRLTLT01DEM156N, January 2010: the German ten-year, which is the
    // area's risk-free rate and the one the spreads are measured against.
    longRate: 3.26,
    // **A judgement.** Negotiated euro-area wage growth ran near 2 % through
    // 2009-10.
    wageGrowth: 2.0,
    // **Judgements.** No monthly survey on the Michigan model exists for the
    // area; the ECB's Survey of Professional Forecasters is quarterly and its
    // one- and five-year points sat at about 1.3 and 1.9 at this date.
    expectedInflationShort: 1.3,
    expectedInflationLong: 1.9,
    supplyShock: 0,
    importPriceInflation: 1.0,
    // **Judgements.** A young institution eleven years old, which had been
    // widely praised for its handling of 2008 and had not yet been asked the
    // question this mandate asks.
    credibility: 70,
    anchoring: 0.82,
    // The financial side. Fragmentation is the number this whole scenario
    // turns on, and it is the one with the best source: the Italy-Germany
    // ten-year spread stood at 0.82 points in January 2010 (FRED
    // IRLTLT01ITM156N against IRLTLT01DEM156N). The engine's fragmentation
    // index is in basis points, so 82.
    fragmentation: 82,
    bankingStress: 36,
    creditSpread: 1.1,
    marketVolatility: 26,
    creditGrowth: 0.5,
    // Debt in the area averaged about 80 % of output and was rising fast; the
    // engine's index is 0-100 and this is high but not at the rail.
    debtPressure: 58,
    neutralRealRate: 1.0,
  },

  measurement: {
    // Modern statistics, and good ones — but an area of sixteen national
    // statistical offices publishing on their own schedules into a common
    // aggregate, with revisions that occasionally restated a member's deficit
    // by a factor of two. The noise is about hard's own; the revisions are
    // worse, and that is not a metaphor for this period, it is what started it.
    observationNoiseScale: 1.0,
    revisionScale: 1.6,
    missingObservationProbability: 0.03,
    publicationLagRelief: 0,
    forecastUncertaintyScale: 1.5,

    // **The bias of this period, and it is the mirror of 2008's.** Potential
    // output in the periphery had been overstated for a decade by a
    // construction boom that was counted as capacity, so the published gap
    // read the area as having more slack than it had — but the *area*
    // aggregate also averaged a Germany running hot with a Spain in freefall,
    // and the average was a number describing nowhere. One point, which is
    // the smallest bias in the file: this is not a scenario about mismeasuring
    // the gap, it is a scenario about the gap being the wrong question.
    seriesBias: { output_gap_estimate: -1.0 },

    ratePassThrough: 0,
    ratePassThroughEndsAt: 0,
  },

  // The Fed-only instruments, and the two the ECB genuinely did not have in
  // this window. Outright purchases of government debt existed from May 2010 —
  // the Securities Markets Programme — and the transmission protection
  // instrument is this scenario's stand-in for it and for what followed, which
  // is the one piece of modelling licence taken here and is marked as such in
  // the document. Binding forward guidance came in July 2013, after this
  // mandate ends.
  withheldInstruments: [
    'iorb_spread',
    'reverse_repo',
    'discount_window',
    'forward_guidance',
    'balance_sheet_runoff',
  ],

  // The Governing Council moved in 25 bp steps throughout, four times. Fifty
  // is the limit: enough to let a player do in one meeting what took two, and
  // not enough to pretend this was a period of violent rate changes.
  instrumentRanges: {
    policy_rate: { min: -50, max: 50, increment: 25 },
  },

  // Set from the path that prevailed: 1.0 point of cumulative movement a year
  // over three years with one direction reversal — up 50 in 2011, down 75
  // across 2011-12. Tight, deliberately, because the reversal is the thing the
  // scenario is asking about and a generous allowance would stop the score
  // noticing it.
  churnAllowancePerYear: 1.5,

  // Below 1, like 2008 and for a related reason: the rate did not reach the
  // half of the area that most needed it. A cut in Frankfurt in 2011 arrived
  // in Germany and did not arrive in Spain, where the banks funding at six
  // per cent were not repricing their lending to the policy rate.
  rateTransmission: 0.7,
  // Flat. Area core inflation stayed between 1 % and 2 % through a recession
  // that took unemployment to 12 %.
  phillipsGapSlope: 0.2,
  // Very low. This economy did not recover on its own at all: the area had a
  // second recession in 2012-13 and unemployment went on rising to 2013.
  gapMeanReversion: 0.3,
  // Area unemployment rose from 10.2 % to 12.0 % across the mandate on a gap
  // that worsened about 3 points.
  okun: 0.55,
  // Below hard's 1.45. The area's 2010-12 inflation moved on two things — the
  // 2011 oil spike and the 2012 recession — and both are scripted. Hard's
  // ambient processes added a third that nobody experienced: measured, the
  // modelled peak was 6.5 % against the 3.05 % that printed.
  shockScale: 0.6,
  // Hard's event dials as they stood when this scenario was calibrated. Stated
  // rather than inherited, because hard's own were later raised to compensate
  // for its term being cut to 24 meetings and a scenario sets its own length.
  // See `Scenario.eventSeverityScale`.
  eventProbability: 0.7,
  eventSeverityScale: 1.35,

  goldStandard: null,
  procedureChoiceAt: null,

  // Low. This scenario has more scripted events than any other and the drawn
  // stream on top of them would be noise.
  proceduralEventScale: 0.4,

  // The sovereign and banking story is scripted above, eight times, on the
  // dates it happened. Drawing more of either beside them is the same crisis
  // counted twice — and this scenario's whole arithmetic runs through
  // fragmentation and bank stress.
  suppressedFamilies: ['banking_failure', 'sovereign'],

  thresholds: {
    fragmentationCrisis: {
      // The one scenario where this condition is the live one. The area
      // reached an Italy-Germany spread of 4.88 points and a Greece-Germany
      // spread of 19.21 without the currency ending, so the bar sits above
      // what happened — but the watch tier sits low, because a player not
      // being warned about fragmentation in this mandate is not being told
      // what the mandate is.
      failSpread: 600,
      watchSpread: 180,
      meetingsToFail: 4,
    },
    bankingCrisis: {
      failStress: 90,
      watchStress: 48,
      meetingsToFail: 3,
    },
    deflationSpiral: {
      // Not the risk in this window — it became one in 2014 — and the opening
      // print of 0.92 % would light the engine's watch tier from the first
      // screen for a thing that was not yet happening.
      failInflation: -1.5,
      watchInflation: -0.2,
    },
    inflationSpiral: {
      // Headline peaked at 3.05 % in October 2011. The engine's watch tier of
      // 6 is not in play and does not need moving, but the expectations bar
      // does: area long-run expectations open 0.1 point *below* the objective.
      failExpectations: 5,
    },
    capitulation: {
      // No anchor being rebuilt here: expectations open below target, not
      // above it. Pushed out of reach rather than left to misfire.
      meetingsToFail: 99,
    },
  },

  benchmarkNote:
    'The main refinancing rate the Governing Council actually voted, meeting ' +
    'by meeting. Unlike the Federal Reserve scenarios, this column is a ' +
    'decision rather than an outcome: the ECB announces this rate and it is ' +
    'the rate. What it does *not* show is the rest of what this institution ' +
    'did in those three years — the bond purchases, the three-year ' +
    'refinancing, the collateral rules, the announcement of September 2012 — ' +
    'and that absence is the comparison worth drawing. Two of the four moves ' +
    'in this column were reversed inside eight months.',

  calendar: [
    { date: '2010-01-14', label: 'January 14, 2010', benchmarkRate: 1, actualInflation: 0.92, actualUnemployment: 10.2 },
    { date: '2010-03-04', label: 'March 4, 2010', benchmarkRate: 1, actualInflation: 1.56, actualUnemployment: 10.3 },
    { date: '2010-04-08', label: 'April 8, 2010', benchmarkRate: 1, actualInflation: 1.61, actualUnemployment: 10.3 },
    { date: '2010-06-10', label: 'June 10, 2010', benchmarkRate: 1, actualInflation: 1.48, actualUnemployment: 10.3 },
    { date: '2010-07-08', label: 'July 8, 2010', benchmarkRate: 1, actualInflation: 1.72, actualUnemployment: 10.2 },
    { date: '2010-09-02', label: 'September 2, 2010', benchmarkRate: 1, actualInflation: 1.88, actualUnemployment: 10.2 },
    { date: '2010-10-07', label: 'October 7, 2010', benchmarkRate: 1, actualInflation: 1.95, actualUnemployment: 10.3 },
    { date: '2010-12-02', label: 'December 2, 2010', benchmarkRate: 1, actualInflation: 2.22, actualUnemployment: 10.2 },
    { date: '2011-01-13', label: 'January 13, 2011', benchmarkRate: 1, actualInflation: 2.32, actualUnemployment: 10.2 },
    { date: '2011-03-03', label: 'March 3, 2011', benchmarkRate: 1, actualInflation: 2.67, actualUnemployment: 10.1 },
    { date: '2011-04-07', label: 'April 7, 2011', benchmarkRate: 1.25, actualInflation: 2.84, actualUnemployment: 10 },
    { date: '2011-06-09', label: 'June 9, 2011', benchmarkRate: 1.25, actualInflation: 2.72, actualUnemployment: 10.1 },
    { date: '2011-07-07', label: 'July 7, 2011', benchmarkRate: 1.5, actualInflation: 2.58, actualUnemployment: 10.2 },
    { date: '2011-09-08', label: 'September 8, 2011', benchmarkRate: 1.5, actualInflation: 2.99, actualUnemployment: 10.5 },
    { date: '2011-10-06', label: 'October 6, 2011', benchmarkRate: 1.5, actualInflation: 3.05, actualUnemployment: 10.6 },
    { date: '2011-12-08', label: 'December 8, 2011', benchmarkRate: 1, actualInflation: 2.76, actualUnemployment: 10.8 },
    { date: '2012-01-12', label: 'January 12, 2012', benchmarkRate: 1, actualInflation: 2.66, actualUnemployment: 10.9 },
    { date: '2012-03-08', label: 'March 8, 2012', benchmarkRate: 1, actualInflation: 2.69, actualUnemployment: 11.2 },
    { date: '2012-04-04', label: 'April 4, 2012', benchmarkRate: 1, actualInflation: 2.58, actualUnemployment: 11.3 },
    { date: '2012-06-06', label: 'June 6, 2012', benchmarkRate: 1, actualInflation: 2.36, actualUnemployment: 11.5 },
    { date: '2012-07-05', label: 'July 5, 2012', benchmarkRate: 0.75, actualInflation: 2.4, actualUnemployment: 11.5 },
    { date: '2012-09-06', label: 'September 6, 2012', benchmarkRate: 0.75, actualInflation: 2.61, actualUnemployment: 11.7 },
    { date: '2012-10-04', label: 'October 4, 2012', benchmarkRate: 0.75, actualInflation: 2.49, actualUnemployment: 11.9 },
    { date: '2012-12-06', label: 'December 6, 2012', benchmarkRate: 0.75, actualInflation: 2.23, actualUnemployment: 12 },
  ],

  events: SCENARIO_EVENTS,
}
