import type { SeriesId } from '../types/observation.ts'
import type {
  InstrumentDefinition,
  InstrumentId,
  PolicyAction,
  TransmissionChannel,
} from '../types/policy.ts'
import type { SimulationState } from '../types/state.ts'
import { getInstrument } from '../config/instruments.ts'
import { getSeries } from '../observation/series.ts'
import { PROJECTION_HORIZON, projectSeries } from './projection.ts'

/**
 * What one instrument, on its own, is expected to do.
 *
 * `projectPackage` answers "what does this meeting's decision do", which is the
 * right question for a committee and the wrong one for a player who has just
 * moved a dial they have never used. A player raised targeted refinancing by a
 * point and reported, in as many words, having no idea what it had done. The
 * package projection could not have told them: the rate moved in the same
 * package, and the rate moves everything.
 *
 * So this runs the engine twice more per instrument — once with that single
 * action, once holding — and reports the difference. Same discipline as the
 * package projection and for the same reason: procedural events are off in
 * both arms, so the two share every random draw and the gap between them is
 * caused by the one dial and nothing else. Nothing is written back to the run.
 *
 * The series each instrument is reported on come from its own declared
 * transmission channels, not from a fixed list. A liquidity facility whose
 * effect was reported in headline inflation would read as inert, because over
 * four meetings it very nearly is; what it moves is bank stress and the credit
 * spread, and those are what its own `channels` say to look at.
 */

/** Where each transmission channel shows up, in the order worth reading. */
const CHANNEL_SERIES: Readonly<Record<TransmissionChannel, readonly SeriesId[]>> = {
  interest_rate: ['market_expected_rate', 'long_rate'],
  credit: ['credit_spread', 'real_growth'],
  asset_prices: ['equity_index', 'long_rate'],
  exchange_rate: ['exchange_rate'],
  expectations: ['inflation_expectations_1y', 'market_expected_rate'],
  bank_liquidity: ['bank_stress_proxy', 'credit_spread'],
  sovereign_spreads: ['fragmentation_spread', 'credit_spread'],
}

/**
 * Reported for every instrument, after its own channels.
 *
 * Both halves of the mandate, always — including where the four-meeting effect
 * rounds to nothing. "This does not move unemployment within a year" is a fact
 * about the instrument the player needs, and it is only legible if the row is
 * there to be read.
 */
const MANDATE_SERIES: readonly SeriesId[] = ['headline_inflation', 'unemployment']

/** How many channel series to report before the two mandate rows. */
const MAX_CHANNEL_SERIES = 3

/**
 * How far out to read each instrument, from its own declared lag.
 *
 * A fixed horizon flatters the fast instruments and libels the slow ones. Read
 * at four meetings, a 50 bp rise reports −0.03 pp on inflation and nothing at
 * all on unemployment — true, and a fair description of a rate rise four
 * meetings old, and a terrible answer to "what does the policy rate do", which
 * is the question the panel is there to answer. The rate declares a 3-8 meeting
 * lag; asked at eight, it says something a player can act on.
 */
function horizonFor(instrument: InstrumentDefinition): number {
  return Math.max(PROJECTION_HORIZON, instrument.lagMeetings[1])
}

/** One projected line: what this instrument alone does to one series. */
export interface InstrumentEffectLine {
  readonly seriesId: SeriesId
  readonly label: string
  readonly unit: string
  readonly decimals: number
  /** Where the series stands today. */
  readonly now: number
  /**
   * Change at the horizon caused by this instrument alone: the series under
   * the change, minus the series with the instrument left where it stands.
   */
  readonly delta: number
  /** True when `delta` is smaller than the series' own display precision. */
  readonly negligible: boolean
  /** True when this is one of the two mandate rows rather than a channel row. */
  readonly mandate: boolean
}

export interface InstrumentEffect {
  readonly instrument: InstrumentId
  readonly label: string
  readonly unit: InstrumentDefinition['unit']
  readonly from: number
  readonly to: number
  readonly horizonMeetings: number
  readonly lines: readonly InstrumentEffectLine[]
  /** True when nothing this instrument touches moves enough to print. */
  readonly negligible: boolean
}

/** The series worth reporting for one instrument, deduplicated and ordered. */
function seriesFor(instrument: InstrumentDefinition): readonly SeriesId[] {
  const seen = new Set<SeriesId>()
  const channels: SeriesId[] = []
  for (const channel of instrument.channels) {
    for (const seriesId of CHANNEL_SERIES[channel] ?? []) {
      if (seen.has(seriesId)) continue
      seen.add(seriesId)
      channels.push(seriesId)
    }
  }
  const ordered = channels.slice(0, MAX_CHANNEL_SERIES)
  return [...ordered, ...MANDATE_SERIES.filter((id) => !ordered.includes(id))]
}

/**
 * Runs the engine with this one action against holding, and differences them.
 *
 * Returns null when the action would be rejected — a bound the player is
 * already outside — since a partial projection is worse than none.
 */
export function projectInstrument(
  state: SimulationState,
  action: PolicyAction,
  from: number,
  horizon?: number,
): InstrumentEffect | null {
  const definition = getInstrument(action.instrument)
  if (definition === undefined) return null

  const horizonMeetings = horizon ?? horizonFor(definition)
  const projected = projectSeries(
    state,
    { actions: [action], communication: null },
    seriesFor(definition),
    horizonMeetings,
  )
  if (projected === null) return null

  const mandate = new Set<SeriesId>(MANDATE_SERIES)
  const lines: InstrumentEffectLine[] = []
  for (const entry of projected) {
    const definitionForSeries = getSeries(entry.seriesId)
    if (definitionForSeries === undefined) continue
    const delta = entry.withPackage - entry.holding
    lines.push({
      seriesId: entry.seriesId,
      label: entry.label,
      unit: entry.unit,
      decimals: entry.decimals,
      now: entry.now,
      delta,
      negligible: Math.abs(delta) < 10 ** -entry.decimals / 2,
      mandate: mandate.has(entry.seriesId),
    })
  }

  return {
    instrument: action.instrument,
    label: definition.label[state.config.institution],
    unit: definition.unit,
    from,
    to: action.magnitude,
    horizonMeetings,
    lines,
    negligible: lines.every((line) => line.negligible),
  }
}
