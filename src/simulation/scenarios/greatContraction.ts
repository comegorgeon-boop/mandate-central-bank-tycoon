import type { Scenario, ScenarioEvent } from '../types/scenario.ts'

/** Sub-steps in one inter-meeting interval. */
const ONE_MEETING = 4
const TWO_MEETINGS = 8
const THREE_MEETINGS = 12

/**
 * The dated events of 1929-33.
 *
 * Scripted because they happened on dates, and because the three banking
 * panics are not weather: they are the subject. The procedural catalogue still
 * draws beside them at reduced probability, which is where a different seed
 * gets a different mandate out of the same history.
 *
 * Each newswire reports what happened and quotes nobody. Three of these are
 * events the player is expected to *answer* rather than absorb — the crash,
 * Britain leaving gold, and the Bank of United States — and the answer is
 * different in each case, which is most of what this scenario is.
 */
const SCENARIO_EVENTS: readonly ScenarioEvent[] = [
  {
    meetingIndex: 1,
    id: 'crash_1929',
    family: 'market_cycle',
    major: true,
    date: '1929-10-24',
    title: 'The market breaks',
    newswire:
      'Thirteen million shares changed hands on Thursday and sixteen million ' +
      'on Tuesday, against a normal day of four. The industrial average has ' +
      'lost nearly a quarter of its value in a week and about a third since ' +
      'September. Brokers are calling margin and the call money market has ' +
      'seized. The New York Reserve Bank has been buying government ' +
      'securities on its own account to keep the dealers funded.',
    immediate: [
      { variable: 'assetPricePressure', delta: -22 },
      { variable: 'marketVolatility', delta: 34 },
      { variable: 'confidenceShock', delta: -1.8 },
      { variable: 'bankingStress', delta: 14 },
      { variable: 'creditSpread', delta: 0.7 },
    ],
    delayed: [
      {
        delaySteps: ONE_MEETING,
        effects: [
          { variable: 'demandShock', delta: -1.3 },
          { variable: 'creditGrowth', delta: -3.5 },
        ],
      },
      {
        delaySteps: TWO_MEETINGS,
        effects: [
          { variable: 'outputGap', delta: -2.0 },
          { variable: 'assetPricePressure', delta: -6 },
        ],
      },
    ],
  },
  {
    meetingIndex: 6,
    id: 'smoot_hawley',
    family: 'fiscal',
    major: false,
    date: '1930-06-17',
    title: 'The tariff is signed',
    newswire:
      'The tariff act becomes law, raising duties on more than twenty ' +
      'thousand imported goods. More than a thousand economists had petitioned ' +
      'against it. Trading partners are already preparing their own schedules, ' +
      'and the export trades expect to lose their markets rather than gain ' +
      'the protected ones.',
    immediate: [
      { variable: 'importPriceInflation', delta: 1.6 },
      { variable: 'demandShock', delta: -0.7 },
      { variable: 'confidenceShock', delta: -0.5 },
    ],
    delayed: [
      {
        delaySteps: TWO_MEETINGS,
        effects: [
          { variable: 'demandShock', delta: -0.8 },
          { variable: 'outputGap', delta: -1.1 },
        ],
      },
    ],
  },
  {
    meetingIndex: 10,
    id: 'bank_of_united_states',
    family: 'banking_failure',
    major: true,
    date: '1930-12-11',
    title: 'A large bank closes its doors',
    newswire:
      'The Bank of United States has been taken over by the state ' +
      'superintendent. It held some four hundred thousand depositors, more ' +
      'than any other bank in the country, and the name alone persuaded many ' +
      'of them it was an arm of the government. Negotiations to merge it ' +
      'failed over the weekend. Queues formed at other institutions this ' +
      'morning in the same neighbourhoods.',
    immediate: [
      { variable: 'bankingStress', delta: 22 },
      { variable: 'creditSpread', delta: 1.1 },
      { variable: 'creditGrowth', delta: -4.5 },
      { variable: 'financialShock', delta: 1.4 },
      { variable: 'confidenceShock', delta: -1.2 },
    ],
    delayed: [
      {
        delaySteps: ONE_MEETING,
        effects: [
          { variable: 'bankingStress', delta: 8 },
          { variable: 'demandShock', delta: -1.0 },
        ],
      },
      {
        delaySteps: THREE_MEETINGS,
        effects: [{ variable: 'bankingStress', delta: -10 }],
      },
    ],
  },
  {
    meetingIndex: 14,
    id: 'creditanstalt',
    family: 'banking_failure',
    major: false,
    date: '1931-05-11',
    title: 'A Vienna bank fails',
    newswire:
      'The largest bank in Austria has announced losses exceeding its ' +
      'capital. Its correspondents across central Europe are being called on ' +
      'for funds they do not have, and short-term credits to German and ' +
      'Hungarian banks are not being renewed. The failure is not large in ' +
      'itself; what is large is the chain it sits in.',
    immediate: [
      { variable: 'bankingStress', delta: 11 },
      { variable: 'creditSpread', delta: 0.5 },
      { variable: 'geopoliticalRisk', delta: 14 },
      { variable: 'marketVolatility', delta: 7 },
    ],
    delayed: [
      {
        delaySteps: ONE_MEETING,
        effects: [
          { variable: 'bankingStress', delta: 9 },
          { variable: 'financialShock', delta: 0.9 },
        ],
      },
    ],
  },
  {
    // The pivot of the whole scenario. The floor under the rate steps up here;
    // see `goldStandard.floor` below and `scenarios/goldStandard.ts`.
    meetingIndex: 16,
    id: 'britain_leaves_gold',
    family: 'exchange_rate',
    major: true,
    date: '1931-09-21',
    title: 'Britain leaves gold',
    newswire:
      'The Bank of England has been relieved by statute of its obligation to ' +
      'sell gold. Sterling fell about a quarter against the dollar within the ' +
      'week and the Scandinavian countries have followed it off the standard. ' +
      'Foreign central banks are converting their dollar balances into gold ' +
      'and shipping it, and the exchanges are now paying more to hold funds ' +
      'anywhere but New York. What the dollar must offer to keep its gold has ' +
      'gone up.',
    immediate: [
      { variable: 'bankingStress', delta: 15 },
      { variable: 'marketVolatility', delta: 12 },
      { variable: 'creditSpread', delta: 0.6 },
      { variable: 'geopoliticalRisk', delta: 18 },
    ],
    delayed: [
      {
        delaySteps: ONE_MEETING,
        effects: [
          { variable: 'bankingStress', delta: 10 },
          { variable: 'creditGrowth', delta: -3.0 },
        ],
      },
    ],
  },
  {
    meetingIndex: 20,
    id: 'rfc_and_glass_steagall_1932',
    family: 'fiscal',
    major: false,
    date: '1932-02-27',
    title: 'The Reserve Banks are allowed to lend against governments',
    newswire:
      'Two measures in a month. A reconstruction finance corporation is ' +
      'lending to banks and railroads on the government’s account, and ' +
      'an amendment now lets the Reserve Banks issue notes against government ' +
      'securities as well as gold and eligible paper. The free gold that was ' +
      'supposed to bind the system no longer binds it to the same degree.',
    immediate: [
      { variable: 'bankingStress', delta: -7 },
      { variable: 'creditSpread', delta: -0.3 },
      { variable: 'fiscalImpulse', delta: 0.6 },
    ],
    delayed: [
      { delaySteps: TWO_MEETINGS, effects: [{ variable: 'bankingStress', delta: -4 }] },
    ],
  },
  {
    meetingIndex: 23,
    id: 'open_market_purchases_1932',
    family: 'communication',
    major: false,
    date: '1932-07-14',
    title: 'The purchase programme stops',
    newswire:
      'The buying programme that ran from spring is over. About a billion ' +
      'dollars of government securities were taken onto the books between ' +
      'April and the end of June; member banks used most of it to pay off ' +
      'what they owed the Reserve Banks rather than to lend, and the several ' +
      'Reserve Banks were not of one mind about continuing. Excess reserves ' +
      'are accumulating and are not moving.',
    immediate: [
      { variable: 'creditGrowth', delta: -1.5 },
      { variable: 'credibility', delta: -3 },
    ],
    delayed: [
      { delaySteps: TWO_MEETINGS, effects: [{ variable: 'demandShock', delta: -0.6 }] },
    ],
  },
  {
    meetingIndex: 28,
    id: 'michigan_bank_holiday',
    family: 'banking_failure',
    major: true,
    date: '1933-02-14',
    title: 'A state closes its banks',
    newswire:
      'Michigan has proclaimed an eight-day holiday for every bank in the ' +
      'state after the largest Detroit group could not be recapitalised. ' +
      'Other states are preparing their own proclamations. Currency is being ' +
      'withdrawn and hoarded at a rate the system has not seen, and gold is ' +
      'being demanded in it.',
    immediate: [
      { variable: 'bankingStress', delta: 26 },
      { variable: 'creditGrowth', delta: -6.0 },
      { variable: 'creditSpread', delta: 1.3 },
      { variable: 'financialShock', delta: 1.8 },
      { variable: 'confidenceShock', delta: -1.5 },
    ],
    delayed: [
      {
        delaySteps: ONE_MEETING,
        effects: [
          { variable: 'bankingStress', delta: 12 },
          { variable: 'outputGap', delta: -1.8 },
        ],
      },
    ],
  },
  {
    meetingIndex: 28,
    id: 'bank_holiday_and_gold',
    family: 'exchange_rate',
    major: true,
    date: '1933-03-06',
    title: 'Every bank in the country is shut, and then the gold goes',
    newswire:
      'A national holiday closed every bank for four days from the sixth of ' +
      'March. Those that reopened did so under licence, and about a thousand ' +
      'never did. Gold exports and the hoarding of gold have been prohibited, ' +
      'private holdings are being called in, and the dollar is no longer ' +
      'convertible on demand. The constraint this office spent four years ' +
      'defending has been removed by someone else.',
    immediate: [
      { variable: 'bankingStress', delta: -18 },
      { variable: 'creditSpread', delta: -0.8 },
      { variable: 'confidenceShock', delta: 1.4 },
      { variable: 'exchangeRate', delta: -8 },
      { variable: 'importPriceInflation', delta: 3.0 },
    ],
    delayed: [
      {
        delaySteps: ONE_MEETING,
        effects: [
          { variable: 'demandShock', delta: 1.6 },
          { variable: 'creditGrowth', delta: 3.0 },
          { variable: 'supplyShock', delta: 0.4 },
        ],
      },
    ],
  },
]

/**
 * The Great Contraction, 1929-33.
 *
 * Thirty meetings, August 1929 to April 1933: from the month the Board raised
 * the discount rate to 6 % against stock speculation, to the month after the
 * national bank holiday, with gold convertibility suspended and the question
 * this office spent four years on taken out of its hands.
 *
 * **It is not winnable in the sense the other scenarios are**, and the design
 * says so rather than hiding it. What the player has is a rate, a discount
 * window, and a floor under the rate that they did not choose; what they are
 * asked for is not two per cent inflation but a banking system that is still
 * standing. The three things this scenario exists to make playable:
 *
 *  1. **Deflation at the floor.** The nominal rate reaches its bottom while
 *     prices fall 10 % a year, so the *real* rate goes on climbing with the
 *     dial at rest. Doing nothing becomes a tightening, which is the single
 *     hardest idea in monetary policy to feel rather than recite.
 *  2. **The gold standard as a constraint, not a lecture.** There is a visible
 *     floor on the rate slider and crossing it costs reserves, credit and the
 *     currency. See `scenarios/goldStandard.ts`.
 *  3. **October 1931.** The floor *steps up* when Britain leaves gold, and the
 *     player has to decide whether to raise into the third year of a
 *     depression. The Federal Reserve did: 1.5 % to 3.5 % in two weeks.
 *
 * **Every figure is sourced in `docs/SCENARIOS.md`, and
 * `greatContraction.test.ts` parses that document and fails if the two
 * disagree.** Everything derived or approximated is marked in both places, and
 * this period needs more of those than any other: there was no national income
 * statistic, no official monthly unemployment rate, and no agreement at the
 * time about what either would have said.
 */
export const GREAT_CONTRACTION_1929: Scenario = {
  id: 'great_contraction_1929',
  title: 'The Great Contraction',
  subtitle: 'The Federal Reserve, August 1929 to April 1933',
  briefing:
    'The market has been rising for five years on borrowed money and the ' +
    'Board has just raised the discount rate to 6 % to stop it. Prices are ' +
    'flat, output is above anything on record, and nobody is asking you about ' +
    'inflation. You hold the discount rate and the open market account. You ' +
    'do not hold the dollar: it is convertible into gold on demand, and below ' +
    'a certain rate the gold leaves. There is no national income statistic ' +
    'and no monthly count of the unemployed. You have three and three quarter ' +
    'years.',
  institution: 'fed',
  // Hard supplies the non-measurement rules. What was knowable in 1929 is in
  // `measurement` and is this scenario's own, and it is the furthest from the
  // modern regime of any of the six.
  rules: 'hard',
  meetingCount: 30,

  opening: {
    // FRED M13009USM156NNBR, monthly average, Aug 1929. The rise to 6 % took
    // effect on 9 August, so the month's average sits below it.
    policyRate: 5.74,
    // Computed here from FRED CPIAUCNS, not seasonally adjusted — no adjusted
    // vintage exists for this period.
    inflationHeadline: 1.17,
    // **Derived, not observed.** There was no core index: the BLS published a
    // cost-of-living index and a wholesale price index and nothing that
    // stripped out food and fuel. Set equal to headline, which is defensible
    // only because the two were within a point of each other at this date —
    // and it is marked as a derivation in both places.
    inflationCore: 1.17,
    // **Transcribed, not fetched, and on the weakest footing of any number in
    // this file.** Lebergott's annual estimate for 1929 as reproduced in
    // Historical Statistics of the United States, series D 85-86. The monthly
    // series that can be fetched — the National Industrial Conference Board's,
    // via the NBER Macrohistory database — reads 0.04 % for this month, which
    // is three points lower and not comparable. Neither existed in 1929, and
    // that disagreement is the point rather than a problem to resolve.
    unemployment: 3.2,
    naturalUnemployment: 3.2,
    // **A judgement, and the document says so.** No potential output series
    // reaches back before 1929, so there is nothing to compute a gap against.
    // The evidence it is set from: industrial production stood 17 % above its
    // 1923-29 mean in August 1929, and real GNP went on to fall 26.5 % by
    // 1933. Two points above potential is the conservative reading of an
    // economy five years into a boom.
    outputGap: 2.0,
    // FRED M13002US35620M156NNBR: the New York commercial paper rate, which is
    // the nearest thing to a market yield curve this period publishes monthly.
    // There was no constant-maturity Treasury series.
    longRate: 6.08,
    // **A judgement.** No wage series of national coverage is published monthly
    // for 1929. Set just below the period's productivity growth, which is what
    // a labour market at full employment with flat prices produces.
    wageGrowth: 2.0,
    // **A judgement, and a load-bearing one.** No survey of inflation
    // expectations exists before 1946. Both are set to the inflation rate that
    // had actually prevailed over the preceding five years, which is the only
    // defensible assumption for a period with no survey and a gold anchor: the
    // price level was expected to be about stable, because it had been, and
    // because the standard was understood to make it so.
    expectedInflationShort: 0.8,
    expectedInflationLong: 0.5,
    // No cost-push shock in progress. The deflation of this period is a demand
    // and credit collapse, not a supply event, and the model should not be
    // handed one.
    supplyShock: 0,
    importPriceInflation: 0,
    // **Judgements, as in every scenario.** High, and deliberately: this
    // institution had presided over five years of stable prices under a
    // standard nobody questioned. The whole arc of the scenario is that the
    // credibility is real at the start and is spent on defending the wrong
    // thing.
    credibility: 72,
    anchoring: 0.8,
    // The financial side at the top of the boom. Valuations are the one number
    // here with a published series behind it: the industrial average stood at
    // 359 in August 1929 against 200 two years earlier (FRED
    // M1109BUSM293NNBR), and the pressure index is set from that ratio.
    assetPricePressure: 26,
    bankingStress: 18,
    creditGrowth: 6.5,
    marketVolatility: 18,
    // **A judgement.** The real rate of interest consistent with full
    // employment under a gold standard with stable prices, which is higher
    // than any modern figure and is most of why the real rate climbed so far
    // so fast once prices turned.
    neutralRealRate: 3.0,
  },

  measurement: {
    // The furthest regime from the modern one in the game, and every departure
    // is an understatement of how bad it was. There was no national income
    // statistic until Kuznets reported to the Senate in 1934; no monthly
    // unemployment count until 1940; no seasonally adjusted price index. What
    // the Federal Reserve of 1930 actually read weekly was bank debits, ' +
    // clearings, carloadings and its own member-bank balance sheet, and it
    // read them with the lags below.
    observationNoiseScale: 2.4,
    revisionScale: 2.6,
    // One release in five simply absent. Not an exaggeration: the figures this
    // period published were compiled by trade associations and state agencies
    // on their own schedules, and a month with no number in it was ordinary.
    missingObservationProbability: 0.2,
    publicationLagRelief: 0,
    forecastUncertaintyScale: 2.0,

    // **The bias of this period, and it points the other way from 1979's.**
    // With no potential-output estimate at all, contemporary judgement read
    // the economy against the 1929 peak rather than against a trend — so the
    // gap looked *better* than it was for as long as the peak was recent, and
    // the belief that the liquidation was nearly over was held, published and
    // acted on through 1930 and 1931. Set to +4.0: the published gap flatters
    // the economy by four points. This is a calibration against the fit table
    // and not a sourced coefficient; it is the one departure in this scenario
    // with no measured counterpart.
    seriesBias: { output_gap_estimate: 4.0 },

    // No mortgage-interest distortion: the CPI's asset-price treatment of
    // owner-occupied housing that mattered so much in 1979-83 cuts the other
    // way here only trivially, because the rate barely moved and because the
    // shelter weighting of the 1930s index was small.
    ratePassThrough: 0,
    ratePassThroughEndsAt: 0,
  },

  // Nothing this institution did not have. The list is long because almost
  // nothing in the modern toolkit existed: interest on reserves (2008), asset
  // purchase *programmes* as an announced instrument (2008), the reverse repo
  // facility (2013), swap lines in anything like their modern form, targeted
  // refinancing. Forward guidance is withheld for the reason it is in 1979 and
  // more so: the Federal Reserve of 1929 published no decisions at all.
  //
  // What is *not* withheld, and matters: the discount window, which is the one
  // instrument that could have answered the banking panics and was not used at
  // the scale they needed. The whole lesson of the scenario is reachable
  // because that lever is on the desk.
  withheldInstruments: [
    'iorb_spread',
    'balance_sheet_runoff',
    'reverse_repo',
    'forward_guidance',
    'swap_lines',
    'targeted_refinancing',
  ],

  // The discount rate moved in whole and half points and rarely more than a
  // point at a time; the largest single change in the period was the two-step
  // rise of October 1931, 100 bp then 100 bp a week apart. A 150 bp limit lets
  // a player reproduce that in one meeting on this calendar and no more.
  instrumentRanges: {
    policy_rate: { min: -150, max: 150, increment: 25 },
  },

  // Set from the path that prevailed: about 14 points of cumulative movement
  // over three and three quarter years, 3.7 a year, six direction reversals.
  // Close to the desk's modern 3.5, which is the honest reading — this was not
  // a period of violent rate changes, it was a period of a rate that would not
  // go low enough.
  churnAllowancePerYear: 4.0,

  // **Higher than 1979's 2.2, and for a related reason.** There was no deposit
  // insurance, no discount-window stigma management, and a unit banking system
  // of twenty-five thousand independent banks with no branch networks to
  // absorb a local loss. A rate that pushed a marginal bank under did not
  // reprice its lending, it ended it — and took its depositors' money with it.
  // Calibrated against the fit table below, not estimated.
  rateTransmission: 3.6,
  // **Steeper than every other scenario here, and steeper than the engine's
  // 0.45.** The first version of this file set it at 0.22 on a downward
  // nominal rigidity argument, and that argument is a modern one: wages in the
  // 1930s *did* fall, by about a fifth in manufacturing, and the price level
  // fell a quarter. The pre-war Phillips relation is the steep one and the
  // flat one is the post-war fact. Measured, 0.22 produced a mandate that
  // ended at +0.2 % inflation against the -9.35 % that printed; at 0.5 the
  // deflation is the right order and the Fisher spiral this scenario exists
  // for — falling prices raising the real rate, raising the real rate
  // deepening the fall — can actually run.
  phillipsGapSlope: 0.7,
  // **Very low, deliberately.** This economy did not mean-revert. It sat at
  // the bottom for three years, which is the fact an output gap that closes
  // itself cannot reproduce — and the fact that makes the scenario about
  // policy.
  gapMeanReversion: 0.18,
  // Real GNP fell 26.5 % between 1929 and 1933 (FRED GNPCA) while unemployment
  // rose by about 21.7 points on Lebergott's estimates. The engine's 0.42
  // cannot produce that at any plausible output gap; 0.75 can.
  okun: 0.75,
  // The supply side of this period was quiet: no oil shock, no war, no
  // commodity cycle worth the name, and a price collapse that came entirely
  // from demand and credit. Hard's ambient processes are a modern economy's
  // weather and they put a +2.65 supply shock into 1930 — six points of
  // imported inflation in the middle of the Great Deflation. See
  // `Scenario.shockScale`.
  shockScale: 0.45,
  // Hard's event dials as they stood when this scenario was calibrated. Stated
  // rather than inherited, because hard's own were later raised to compensate
  // for its term being cut to 24 meetings and a scenario sets its own length.
  // See `Scenario.eventSeverityScale`.
  eventProbability: 0.7,
  eventSeverityScale: 1.35,

  // **Zero, and this is the most consequential single number in the file.**
  // The Federal Reserve of 1929 had no inflation target. What it had was a
  // dollar convertible into a fixed weight of gold, which is a commitment to a
  // stable *price level* — and a price level that had been flat for five
  // years. Scoring this mandate against 2 % would be scoring it against a
  // concept invented sixty years later, and it would do more than mis-grade
  // it: every expectations block in this engine pulls inflation toward the
  // objective, so a 2 % objective pulls a 10 % deflation *upward* and the
  // scenario stops being a deflation at all. Measured before this existed, the
  // model ended the mandate at +2.7 % against the -9.35 % that printed.
  inflationTarget: 0,

  // There was no federal funds target range in 1929, and barely a funds
  // market. What this institution announced was the discount rate.
  rateLabel: 'Discount rate, New York',

  /**
   * The gold standard. See `scenarios/goldStandard.ts` for the mechanism.
   *
   * Three steps, and the middle one is the scenario:
   *
   *  - **1.5 % from the opening.** Calibrated, not sourced. It is roughly
   *    where the discount rate settled through 1931 before the drain, and it
   *    is the rate at which the gold stock was stable while the rest of the
   *    world was still on the standard.
   *  - **3.0 % from meeting 16, which is September 1931.** Britain left gold
   *    on the 21st and sterling fell about a quarter; foreign central banks
   *    converted dollar balances into gold and shipped it. The monetary gold
   *    stock fell from 4.69 to 4.16 billion dollars between August and
   *    November and the Reserve Banks' own gold reserves from 3.46 to 2.75
   *    (FRED M1476BUSM027NNBR, M14062USM027NNBR). The Federal Reserve raised
   *    its discount rate from 1.5 % to 2.5 % on 9 October and to 3.5 % on the
   *    16th. **Three per cent is the floor that makes that rise the cheaper of
   *    two bad options**, which is what it was.
   *  - **0 % from meeting 29, April 1933.** Convertibility is suspended and
   *    the constraint is simply gone — by someone else's decision, which is
   *    the ending this mandate has.
   */
  goldStandard: {
    floor: [
      { fromMeeting: 0, rate: 1.5 },
      { fromMeeting: 17, rate: 3.0 },
      { fromMeeting: 29, rate: 0 },
    ],
    // Calibrated against the fit table. At 1.0 a player sitting a full point
    // under the floor loses roughly as much banking stability per meeting as
    // the Bank of United States failure cost in one go, which is the right
    // order: the drain of late 1931 was comparable to a large bank failure and
    // it went on for months.
    drainPerPoint: 1.0,
    label: 'Gold leaves below',
  },

  // 6 October 1979 has no counterpart here: there is no procedure to choose.
  procedureChoiceAt: null,

  // Reduced, as in 1979, and for the same reason: the dated events make this
  // recognisable as 1929-33 and the drawn ones make two seeds of it different
  // mandates.
  proceduralEventScale: 0.3,

  // The banking story of 1929-33 is scripted above, four times, on the dates
  // it happened. Letting the catalogue draw its own bank failures beside them
  // is the same history counted twice — and this scenario's whole arithmetic
  // runs through banking stress, so a double count there is not cosmetic.
  // Energy is suppressed for the 1979 reason inverted: there was no energy
  // shock in this period and a drawn one would be fiction.
  suppressedFamilies: ['banking_failure', 'energy_commodity'],

  // The engine's catastrophe thresholds describe a 2 % world. This one spent
  // three years in a region every one of them calls lost, and did not stop
  // being a central bank. Each override below was set by replaying the
  // historical discount-rate path and requiring it to survive; nothing else
  // was moved.
  thresholds: {
    deflationSpiral: {
      // The engine's bar describes a 2 % economy sliding to -1. This one
      // printed -10.74 % in October 1932 and the Federal Reserve was still
      // there in 1933. Thirteen points below the objective is the bar at which
      // the price level is genuinely coming apart rather than falling.
      failInflation: -13,
      watchInflation: -3,
    },
    bankingCrisis: {
      // The hardest override in the game to set honestly, because the banking
      // system *did* fail: about a third of all banks suspended between 1930
      // and 1933 and every one of them closed for four days in March. A bar
      // the history breaches would end the mandate before the ending, so this
      // sits where the system was in the worst month the Federal Reserve
      // continued to operate through — and the watch tier sits low, because a
      // player who is *not* being warned about the banks in this scenario is
      // not being told the truth.
      failStress: 97,
      watchStress: 40,
      meetingsToFail: 4,
    },
    currencyDysfunction: {
      // Volatility, not the exchange rate. The dollar's parity held until the
      // last month of the mandate, so the exchange-rate limb of this condition
      // is not in play; the volatility limb is, and the engine's bar of 90
      // fired in six of twelve replays of the historical path. October 1929
      // alone puts 34 points on the index. A market in free fall is this
      // scenario's subject rather than its failure state, and the thing that
      // *does* end this mandate badly is the banking system.
      watchVolatility: 82,
      failVolatility: 99,
      failExchangeRateMove: 40,
      meetingsToFail: 4,
    },
    depression: {
      // **The hardest threshold in the game to set honestly.** This mandate is
      // a depression; ending it for being one would end it on the subject.
      // The engine's bar is an output gap of -8 held four meetings, which the
      // actual path breaches by the autumn of 1930 and never comes back from —
      // measured, ten of twelve replays of the historical discount-rate path
      // ended here. The Federal Reserve served the whole period.
      //
      // So the bar sits below the model's own floor on the output gap and is
      // effectively unreachable, and the watch tier sits where the slump
      // became undeniable, so the player is warned from early 1930 onward and
      // never stops being warned. What ends this mandate badly is the banking
      // system, which is both the right mechanic and what actually happened.
      watchOutputGap: -4,
      watchUnemploymentGap: 3,
      failOutputGap: -30,
      failUnemploymentGap: 30,
      meetingsToFail: 8,
    },
    lossOfMonetaryControl: {
      // Expectations open half a point from the objective and the risk here is
      // the opposite one. Left near the engine's bar, which the deflation
      // threshold above is doing the work for.
      failExpectationsMiss: 6,
    },
    dismissal: {
      // Reachable, unlike 1979. The Board of this period was appointed and
      // replaceable, its governor changed in 1930 in the middle of the
      // collapse, and the political question of 1932 was openly whether the
      // Federal Reserve had any business continuing. But the bar is lower than
      // the fictional one, because an institution with this much standing to
      // lose takes longer to lose it.
      failCredibility: 18,
      watchCredibility: 35,
    },
    capitulation: {
      // No capitulation condition in a deflation: there is no anchor to give
      // in on, and the real rate is high for the whole mandate whatever the
      // player does. Pushed out of reach rather than left to misfire.
      meetingsToFail: 99,
    },
  },

  benchmarkNote:
    'The discount rate at the Federal Reserve Bank of New York, month by ' +
    'month. It is the rate that was announced and the one the public argued ' +
    'about, and it is only part of what this institution did: the open market ' +
    'account, the eligibility rules at the window and the willingness of ' +
    'twelve separate Reserve Banks to lend all moved independently of it. ' +
    'There was also no Committee calendar to compare against — the Open ' +
    'Market Policy Conference met a few times a year and the discount rate ' +
    'changed whenever a Reserve Bank asked and the Board agreed.',

  calendar: [
    { date: '1929-08-01', label: 'August 1929', benchmarkRate: 5.74, actualInflation: 1.17, actualUnemployment: 3.2 },
    { date: '1929-10-01', label: 'October 1929', benchmarkRate: 6, actualInflation: 0.58, actualUnemployment: 3.2 },
    { date: '1929-11-01', label: 'November 1929', benchmarkRate: 4.73, actualInflation: 0.58, actualUnemployment: 3.2 },
    { date: '1930-01-01', label: 'January 1930', benchmarkRate: 4.5, actualInflation: 0, actualUnemployment: 8.7 },
    { date: '1930-02-01', label: 'February 1930', benchmarkRate: 4.11, actualInflation: -0.58, actualUnemployment: 8.7 },
    { date: '1930-04-01', label: 'April 1930', benchmarkRate: 3.5, actualInflation: 0.59, actualUnemployment: 8.7 },
    { date: '1930-05-01', label: 'May 1930', benchmarkRate: 3.02, actualInflation: -0.59, actualUnemployment: 8.7 },
    { date: '1930-07-01', label: 'July 1930', benchmarkRate: 2.5, actualInflation: -4.05, actualUnemployment: 8.7 },
    { date: '1930-08-01', label: 'August 1930', benchmarkRate: 2.5, actualInflation: -4.62, actualUnemployment: 8.7 },
    { date: '1930-10-01', label: 'October 1930', benchmarkRate: 2.5, actualInflation: -4.62, actualUnemployment: 8.7 },
    { date: '1930-11-01', label: 'November 1930', benchmarkRate: 2.5, actualInflation: -5.2, actualUnemployment: 8.7 },
    { date: '1931-01-01', label: 'January 1931', benchmarkRate: 2, actualInflation: -7.02, actualUnemployment: 15.9 },
    { date: '1931-02-01', label: 'February 1931', benchmarkRate: 2, actualInflation: -7.65, actualUnemployment: 15.9 },
    { date: '1931-04-01', label: 'April 1931', benchmarkRate: 2, actualInflation: -8.82, actualUnemployment: 15.9 },
    { date: '1931-05-01', label: 'May 1931', benchmarkRate: 1.61, actualInflation: -9.47, actualUnemployment: 15.9 },
    { date: '1931-07-01', label: 'July 1931', benchmarkRate: 1.5, actualInflation: -9.04, actualUnemployment: 15.9 },
    { date: '1931-08-01', label: 'August 1931', benchmarkRate: 1.5, actualInflation: -8.48, actualUnemployment: 15.9 },
    { date: '1931-10-01', label: 'October 1931', benchmarkRate: 2.76, actualInflation: -9.7, actualUnemployment: 15.9 },
    { date: '1931-11-01', label: 'November 1931', benchmarkRate: 3.5, actualInflation: -10.37, actualUnemployment: 15.9 },
    { date: '1932-01-01', label: 'January 1932', benchmarkRate: 3.5, actualInflation: -10.06, actualUnemployment: 23.6 },
    { date: '1932-02-01', label: 'February 1932', benchmarkRate: 3.43, actualInflation: -10.19, actualUnemployment: 23.6 },
    { date: '1932-04-01', label: 'April 1932', benchmarkRate: 3, actualInflation: -10.32, actualUnemployment: 23.6 },
    { date: '1932-05-01', label: 'May 1932', benchmarkRate: 3, actualInflation: -10.46, actualUnemployment: 23.6 },
    { date: '1932-07-01', label: 'July 1932', benchmarkRate: 2.5, actualInflation: -9.93, actualUnemployment: 23.6 },
    { date: '1932-08-01', label: 'August 1932', benchmarkRate: 2.5, actualInflation: -10.6, actualUnemployment: 23.6 },
    { date: '1932-10-01', label: 'October 1932', benchmarkRate: 2.5, actualInflation: -10.74, actualUnemployment: 23.6 },
    { date: '1932-11-01', label: 'November 1932', benchmarkRate: 2.5, actualInflation: -10.2, actualUnemployment: 23.6 },
    { date: '1933-01-01', label: 'January 1933', benchmarkRate: 2.5, actualInflation: -9.79, actualUnemployment: 24.9 },
    { date: '1933-02-01', label: 'February 1933', benchmarkRate: 2.5, actualInflation: -9.93, actualUnemployment: 24.9 },
    { date: '1933-04-01', label: 'April 1933', benchmarkRate: 3.1, actualInflation: -9.35, actualUnemployment: 24.9 },
  ],

  events: SCENARIO_EVENTS,
}
