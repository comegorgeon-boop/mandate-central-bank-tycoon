import type { Difficulty, Institution } from './core.ts'
import type { SeriesId } from './observation.ts'
import type { EventEffect, EventFamily } from './events.ts'
import type { ThresholdOverrides } from '../config/thresholds.ts'

/**
 * Historical scenarios.
 *
 * A scenario replaces two things and nothing else: the opening state, which
 * becomes a sourced table rather than a seeded draw, and the measurement
 * regime, which becomes *what was knowable in that year* rather than a
 * difficulty setting. Everything else — instrument ranges, the information
 * ladder, the scoring weights — is inherited from one of the ordinary
 * difficulty profiles, named by the scenario, so that adding a scenario is
 * never a second copy of the balance sheet of constants.
 *
 * ## Why there is no difficulty chooser
 *
 * Because difficulty *is* the year. A chairman in 1929 had no official
 * national income statistic and read bank conditions weeks late. A chairman in
 * 2021 had excellent data, released on schedule, and was wrong anyway. Those
 * are different games, and letting a player set "hard" on either of them would
 * be offering to make the past more uncertain than it was.
 *
 * ## The honesty rules, which are not negotiable
 *
 * - Opening states and dates are sourced, and the sources are in
 *   `docs/SCENARIOS.md`. Anything approximated says so there and here.
 * - No words are put in a real person's mouth. What they did is in the game.
 *   What they said is not, unless it carries its citation.
 * - The documented table is the authority: `volcker.test.ts` parses
 *   `docs/SCENARIOS.md` and fails if the code and the document disagree.
 */

export type ScenarioId =
  | 'great_contraction_1929'
  | 'volcker_1979'
  | 'lehman_2008'
  | 'euro_crisis_2010'
  | 'transitory_fed_2021'
  | 'transitory_ecb_2021'

/** How the funds rate is set, which was itself a decision in October 1979. */
export type OperatingProcedure = 'rate_target' | 'reserve_target'

/** One slot on the engine's uniform meeting grid, labelled with a real date. */
export interface ScenarioMeeting {
  /** ISO date of the actual meeting this slot is labelled with. */
  readonly date: string
  /** How the interface prints it, e.g. "August 14, 1979". */
  readonly label: string
  /** The rate that actually prevailed over this meeting's month, %. */
  readonly benchmarkRate: number
  /**
   * What the economy actually did, at the meeting this slot is labelled with.
   *
   * Year-on-year inflation and the unemployment rate, computed from the
   * published index levels by `tools/scenario-data.mjs` and transcribed into
   * the calendars it prints. Optional only because a period may not have the
   * series: 1929-33 has no core index and the two unemployment estimates that
   * exist for it disagree by three points.
   *
   * These are here for two reasons and the second is the better one. They let
   * the fit of the model be *measured* rather than asserted —
   * `dev/scenarioFit.ts` computes the RMSE against them. And they let the
   * standard at the end of a mandate compare the two economies rather than
   * only the two rate paths, which is the difference between "you were two
   * points above where the Federal Reserve was" and "you were two points above
   * them and inflation ended four points lower".
   */
  readonly actualInflation?: number
  readonly actualCore?: number
  readonly actualUnemployment?: number
}

/**
 * A dated historical event, fired at its meeting rather than drawn.
 *
 * Scripted because these happened on dates, and a 1980 with no credit
 * controls in it is not 1980. Procedural events still draw beside them at
 * reduced probability, which is where a different seed gets a different
 * mandate out of the same history.
 */
export interface ScenarioEvent {
  readonly meetingIndex: number
  readonly id: string
  readonly date: string
  readonly family: EventFamily
  /** Major events get the dedicated banner rather than the newswire list. */
  readonly major: boolean
  readonly title: string
  /** What the press carried. Describes what happened; quotes no one. */
  readonly newswire: string
  readonly immediate: readonly EventEffect[]
  readonly delayed: readonly {
    readonly delaySteps: number
    readonly effects: readonly EventEffect[]
  }[]
}

/** What could be measured that year, and how wrong it was. */
export interface ScenarioMeasurement {
  readonly observationNoiseScale: number
  readonly revisionScale: number
  readonly missingObservationProbability: number
  readonly publicationLagRelief: number
  readonly forecastUncertaintyScale: number
  /**
   * A constant, one-directional error in a published series, in its units.
   *
   * Not noise. Noise averages out and a player can learn to discount it; a
   * bias does neither, and the whole Orphanides argument is that the 1970s
   * were ruined by one. See `docs/SCENARIOS.md`.
   */
  readonly seriesBias: Readonly<Partial<Record<SeriesId, number>>>
  /**
   * Extra measured headline inflation per point of year-on-year rise in the
   * policy rate — the CPI's mortgage-interest component, which made tightening
   * raise the index the Fed was judged on.
   */
  readonly ratePassThrough: number
  /** Meeting at which that ends, because the methodology changed. */
  readonly ratePassThroughEndsAt: number
}

/** The opening economy, from the sourced table. */
export interface ScenarioOpening {
  readonly policyRate: number
  readonly inflationHeadline: number
  readonly inflationCore: number
  readonly unemployment: number
  readonly naturalUnemployment: number
  readonly outputGap: number
  readonly longRate: number
  readonly wageGrowth: number
  readonly expectedInflationShort: number
  /** The one approximation in the table — see `docs/SCENARIOS.md`. */
  readonly expectedInflationLong: number
  /**
   * Derived, not observed: the cost-push pressure that accounts for the gap
   * between the sourced headline and core prints. See `docs/SCENARIOS.md`.
   */
  readonly supplyShock: number
  readonly importPriceInflation: number
  readonly credibility: number
  readonly anchoring: number
  /**
   * The financial side of the opening, where the period has one worth sourcing.
   *
   * Optional, and the optionality is the honest part. Volcker's August 1979
   * opens with every one of these at the engine's neutral value, because 1979
   * has no banking-stress statistic and inventing one to look authoritative is
   * the opposite of the point. September 2008 is the other extreme: the TED
   * spread stood at 2.04 points on the day of the meeting, which is a price,
   * published, and the single most important number on the table. A scenario
   * sets what its sources support and leaves the rest alone.
   */
  readonly bankingStress?: number
  readonly creditSpread?: number
  readonly marketVolatility?: number
  readonly creditGrowth?: number
  readonly assetPricePressure?: number
  readonly geopoliticalRisk?: number
  readonly neutralRealRate?: number
  readonly debtPressure?: number
  readonly fragmentation?: number
  readonly balanceSheet?: number
  readonly exchangeRate?: number
}

/**
 * A metallic standard, as a constraint on the rate rather than as a narration.
 *
 * The one mechanic the 1929-33 scenario cannot do without. The Federal Reserve
 * of 1931 was not free to set the rate its own economy needed: below some rate
 * gold left the country, and the lower the rate the faster it left. On
 * 21 September 1931 Britain left the gold standard, the drain on New York
 * became acute, and on 9 and 16 October the Federal Reserve raised its discount
 * rate from 1.5 % to 3.5 % — into the third year of a depression, with prices
 * falling at 10 % a year.
 *
 * That is the moment the scenario exists for, and a scenario that only let the
 * player cut could not teach why they raised.
 *
 * **The floor is a schedule, not a constant**, which is the whole design. The
 * October 1931 decision was not a mistake about the economy; it was a floor
 * that moved. Britain's devaluation raised the rate New York had to pay to keep
 * gold, and the scripted event that reports the devaluation is the same event
 * that steps this schedule up. The player watches the floor rise *on the rate
 * slider* and has to decide whether to follow it.
 *
 * Deliberately implemented with no new latent variable and no new published
 * series. The cost of standing below the floor is paid in quantities the game
 * already has and the player already reads — bank stress, credit, the spread,
 * the currency — because a gold-cover gauge nobody knows how to read would
 * teach less than watching the banking system fail for a reason.
 */
export interface GoldStandard {
  /**
   * The lowest nominal policy rate that holds the gold stock, by meeting.
   *
   * Read as a step function: the entry with the highest `fromMeeting` at or
   * below the current meeting is in force. Sourced where the sources support a
   * date and calibrated otherwise, with `docs/SCENARIOS.md` saying which.
   */
  readonly floor: readonly { readonly fromMeeting: number; readonly rate: number }[]
  /**
   * How hard the drain bites, per point of rate below the floor, per meeting.
   *
   * One number scaling the whole response, so the document has one coefficient
   * to argue rather than five.
   */
  readonly drainPerPoint: number
  /** What the slider calls the marker, in the player's words. */
  readonly label: string
}

/**
 * How much unemployment an output gap produces, where the period differs.
 *
 * The engine's 0.42 is a modern coefficient and the two deepest scenarios both
 * miss on it in the same direction. Volcker's own fit table records the miss:
 * replaying the historical rate path gives worst unemployment of 8.3 % against
 * the 10.8 % of November 1982. The 1929-33 economy is further still — real GNP
 * fell 26.5 % and unemployment rose by about 21.7 points, which no coefficient
 * near 0.42 can produce.
 *
 * So it is a scenario parameter, like the Phillips slope and the transmission
 * multiplier, and like them it is calibrated against the fit table rather than
 * estimated.
 */

export interface Scenario {
  readonly id: ScenarioId
  readonly title: string
  readonly subtitle: string
  /** One paragraph: the situation, not the ending. */
  readonly briefing: string
  readonly institution: Institution
  /** Whose non-measurement rules apply: ranges, ladder, scoring weights. */
  readonly rules: Difficulty
  readonly meetingCount: number
  readonly calendar: readonly ScenarioMeeting[]
  readonly opening: ScenarioOpening
  readonly measurement: ScenarioMeasurement
  readonly events: readonly ScenarioEvent[]
  /** Instruments withheld because they did not exist yet. */
  readonly withheldInstruments: readonly string[]
  /**
   * Per-meeting move limits this period needs of its own.
   *
   * The desk's ±200 bp describes a modern committee. The effective funds rate
   * moved more than that between consecutive labelled meetings ten times in
   * 1979-83 and by 621 bp once, so a player held to ±200 could not reach the
   * path they are being compared with. Argued in `docs/SCENARIOS.md`.
   */
  readonly instrumentRanges: Readonly<
    Partial<Record<string, { readonly min: number; readonly max: number; readonly increment: number }>>
  >
  /**
   * How violently this economy transmitted a rate change.
   *
   * A multiplier on the IS curve's response to the real rate gap, and the
   * one structural fact about 1979-83 that the modern calibration cannot
   * carry: under Regulation Q, deposit rate ceilings meant that when market
   * rates rose past them, thrifts and banks simply lost their deposits, and
   * mortgage credit stopped being *available* rather than merely repricing.
   * Housing starts roughly halved. The 1980 credit controls did the same
   * thing to consumer credit in a single quarter. A 1 here would be modelling
   * 1980 as though the mortgage market of 2019 were on the other end of the
   * lever.
   */
  readonly rateTransmission: number
  /**
   * The slope of this period's Phillips curve on the output gap.
   *
   * The engine's 0.45 is above the modern empirical range on purpose — its own
   * comment says so — because a twelve-meeting mandate needs an instrument
   * stronger than the problem. A four-year historical mandate does not, and
   * running 1979-83 on a curve that steep produces a disinflation the
   * recession pays for several times over: measured, an output gap of -7.7
   * drives core inflation to below zero by 1983, against the 4.5 % it actually
   * printed. The sacrifice ratio is the thing this scenario exists to teach,
   * and a steep curve is a cheap one.
   */
  readonly phillipsGapSlope: number
  /**
   * How fast this economy closes its own output gap.
   *
   * The 1983 recovery was violent — real GDP grew 4.6 % — while the real funds
   * rate was still around 6 %. An economy that only recovers when policy lets
   * it go cannot produce that, and instead sits in the trough for two years
   * and deflates. A more cyclical, less service-weighted economy rebounds
   * faster, and this is that.
   */
  readonly gapMeanReversion: number
  /** See the note on `GoldStandard`. Null in every period without one. */
  readonly goldStandard: GoldStandard | null
  /**
   * The objective this year was actually run to, where it was not 2 %.
   *
   * Undefined in five of the six scenarios. 1929-33 sets it to zero, because
   * the Federal Reserve of 1929 had no inflation target and the commitment it
   * did have — a dollar convertible into a fixed weight of gold — is a
   * commitment to a stable price level. See `inflationTargetFor`.
   */
  readonly inflationTarget?: number
  /**
   * What this period's institution called the rate it set.
   *
   * Undefined where the modern name is right. 1929-33 announced a *discount
   * rate* and had no funds target of any kind; 2010-12 and 2021-23 at the ECB
   * set a main refinancing rate, which the engine's ECB label already says.
   */
  readonly rateLabel?: string
  /** See the note above `Scenario`. Undefined keeps the engine's 0.42. */
  readonly okun?: number
  /**
   * A multiplier on the ambient stochastic disturbances, for a period whose
   * weather the modern calibration gets wrong.
   *
   * The engine's shock processes are tuned on a modern economy and inherited
   * through the difficulty a scenario names, which is usually right: hard's
   * ambient variance is a reasonable description of the 1980s or the 2010s.
   * It is not a reasonable description of 1929-33, where the *supply* side was
   * quiet and the collapse was entirely one of demand and credit. Measured,
   * hard's supply process wandered to +2.65 inside the 1930 slump, which at
   * the headline amplifier of 2.4 put six points of imported inflation into
   * the middle of the Great Deflation and took the modelled peak to 5.3 %
   * against a historical maximum of 1.17 %.
   *
   * Undefined everywhere else: a scenario that quietly turned the weather down
   * would be making its own history easier, and the only defence against that
   * is that this is visible, argued in `docs/SCENARIOS.md`, and that the fit
   * table shows what it bought.
   */
  readonly shockScale?: number
  /**
   * The event dials this period needs, where the difficulty's are wrong for it.
   *
   * These exist because of a coupling that was found the hard way. Hard's
   * `eventProbability` and `eventSeverityScale` were raised from 0.7 and 1.35
   * to 0.8 and 1.55 to compensate for its term being cut from 32 scheduled
   * meetings to 24 — a longer mandate is more chances to meet a catastrophe,
   * so length and severity are two settings of one dial. **A scenario sets its
   * own length**, so it must not inherit the compensation for somebody else's.
   * Measured: the Volcker scenario, untouched, went from six full terms in
   * twelve replays of the historical path to two, and its modelled inflation
   * peak from 13.9 % to 19.6 %, purely from inheriting a dial that was turned
   * for a mandate eight meetings shorter than its own.
   *
   * So every scenario that names `hard` states these explicitly at the values
   * hard carried when its own calibration was done.
   */
  readonly eventProbability?: number
  readonly eventSeverityScale?: number
  /**
   * Cumulative rate movement per year allowed before the steadiness charge.
   *
   * Set from the path that actually prevailed. See `docs/SCENARIOS.md`.
   */
  readonly churnAllowancePerYear: number
  /** Meeting at which the operating procedure is chosen, or null. */
  readonly procedureChoiceAt: number | null
  /**
   * How much of the ordinary procedural event stream still runs beside the
   * dated ones.
   *
   * Not zero. The scripted events make the history recognisable; the drawn
   * ones are where a different seed gets a different mandate out of it, and a
   * scenario with no variation at all would be a film rather than a game.
   */
  readonly proceduralEventScale: number
  /**
   * Event families the draw may not touch, because the scenario scripts them.
   *
   * The rule: a scenario scripts the history it knows and the draw supplies
   * what it does not. Without it the two double-count, and the double count
   * is not cosmetic — measured on this build, drawn energy-relief events
   * landing on top of the scripted oil shocks pushed the supply disturbance to
   * -3.7 through 1982-83, which at the headline amplifier of 2.4 is nine
   * points of imported deflation and took the mandate's final inflation to
   * -4 % against the +2.4 % that actually printed.
   */
  readonly suppressedFamilies: readonly EventFamily[]
  /**
   * Failure thresholds this year needs of its own.
   *
   * Only where the fictional calibration would describe the actual situation
   * as already lost. August 1979 opens at 11.84 % inflation against a spiral
   * threshold of 12, and five points of expectations miss against a
   * loss-of-control threshold of four: unchanged, the scenario would end
   * before the first decision. Every override is argued in
   * `docs/SCENARIOS.md`, and none of them makes a catastrophe unreachable.
   */
  readonly thresholds: ThresholdOverrides
  /** What the benchmark path is, said plainly on the screen that shows it. */
  readonly benchmarkNote: string
}
