import type { SeriesId } from '../types/observation.ts'
import type { Institution } from '../types/core.ts'
import type { IntervalStep } from '../engine/advanceTrueState.ts'
import { EVENTS_BY_ID } from '../events/catalog.ts'
import { SUBSTEPS_PER_MEETING, YEARS_PER_MEETING } from '../config/time.ts'
import { SERIES } from './series.ts'

/**
 * The interval between two meetings, as something the player may watch.
 *
 * The engine integrates the gap between meetings in several internal sub-steps
 * (`advanceTrueStateTraced`), and this turns that trace into frames the
 * interface can play. Two rules make it honest rather than decorative:
 *
 * **Nothing is interpolated.** Every frame is a state the integrator actually
 * passed through. Tweening between two meetings would animate numbers the
 * model never computed, which is exactly the "no decorative animation" line.
 *
 * **Only exactly-observed prices appear.** A frame carries the market series
 * and nothing else, because those are the only ones a player could genuinely
 * see moving in real time: published with no lag, no measurement noise and no
 * revisions. Inflation and unemployment describe a reference period and arrive
 * late — showing them ticking upward through the quarter would teach the
 * player that statistics are live, which is the opposite of what this game is
 * about. What the player watches during the interval is markets moving; the
 * statistics are waiting for them at the meeting. That gap is the lesson.
 */

/**
 * The series an interval frame may carry.
 *
 * Derived from the series definitions rather than listed, so a new market
 * price is animated automatically and a new *statistic* can never be added to
 * this by accident: it has to be a market price, published on the day,
 * measured without error and never revised.
 */
export const LIVE_SERIES: readonly SeriesId[] = SERIES.filter(
  (series) =>
    series.category === 'market_data' &&
    series.publicationLagMeetings === 0 &&
    series.revisionLagMeetings === 0 &&
    series.baseNoiseSd === 0,
).map((series) => series.id)

/** A dispatch that arrived part-way through the interval. */
export interface IntervalDispatch {
  readonly eventId: string
  readonly title: string
  readonly newswire: string
}

export interface IntervalFrame {
  /** How far through the interval this frame sits, 0 exclusive to 1 inclusive. */
  readonly progress: number
  /** Simulated years elapsed since the mandate opened, at this frame. */
  readonly timeYears: number
  /** Exactly-observed market readings. See `LIVE_SERIES`. */
  readonly markets: Readonly<Partial<Record<SeriesId, number>>>
  /** Consequences that landed at this frame, if any. */
  readonly dispatches: readonly IntervalDispatch[]
}

const SERIES_BY_ID = new Map(SERIES.map((series) => [series.id, series]))

/**
 * Builds the watchable frames for one interval.
 *
 * `startTimeYears` is the clock at the meeting just left, so the frames carry
 * a real date rather than a fraction.
 */
export function buildIntervalFrames(
  steps: readonly IntervalStep[],
  startTimeYears: number,
  institution: Institution,
): readonly IntervalFrame[] {
  const perStep = YEARS_PER_MEETING / SUBSTEPS_PER_MEETING

  return steps.map((step, index) => {
    const markets: Partial<Record<SeriesId, number>> = {}
    for (const id of LIVE_SERIES) {
      const series = SERIES_BY_ID.get(id)
      if (series === undefined) continue
      if (!series.institutions.includes(institution)) continue
      markets[id] = series.read(step.latent)
    }

    const dispatches: IntervalDispatch[] = []
    for (const eventId of step.landedEventIds) {
      const definition = EVENTS_BY_ID.get(eventId)
      if (definition === undefined) continue
      dispatches.push({
        eventId,
        title: definition.title,
        newswire: definition.newswire,
      })
    }

    return {
      progress: (index + 1) / steps.length,
      timeYears: startTimeYears + perStep * (index + 1),
      markets,
      dispatches,
    }
  })
}

/**
 * The mandate's fictional calendar.
 *
 * A run has no real-world date and must not appear to: this is a fictional
 * simulation and pinning it to a year would invite the player to read it as a
 * forecast of one. What it does have is eight meetings a year, so the clock
 * reads as a month and a year counted from the mandate's own start.
 */
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

export function calendarLabel(timeYears: number): string {
  const totalMonths = Math.floor(timeYears * 12)
  const year = Math.floor(totalMonths / 12) + 1
  return `${MONTHS[((totalMonths % 12) + 12) % 12]}, year ${year}`
}
