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

export type ScenarioId = 'volcker_1979'

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
}

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
