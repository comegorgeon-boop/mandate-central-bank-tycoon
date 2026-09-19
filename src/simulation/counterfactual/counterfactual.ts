import type { ResolvedEventRecord } from '../types/events.ts'
import type { SeriesId } from '../types/observation.ts'
import type { InstrumentId, PolicyPackage } from '../types/policy.ts'
import type { SimulationState } from '../types/state.ts'
import { clampLatentState } from '../config/bounds.ts'
import { advanceTrueState, applyEffects } from '../engine/advanceTrueState.ts'
import { applyPolicyPackage } from '../engine/applyPolicyPackage.ts'
import { resolveEvent } from '../events/resolveEvent.ts'
import { getSeries } from '../observation/series.ts'

/**
 * The same world, without your policy in it.
 *
 * Not an estimate. The engine is deterministic given its inputs, so a
 * counterfactual is a second run of the real thing: the same opening state,
 * the same shocks landing on the same meetings at the same size, and a
 * different decision log. What the two paths differ by *is* what the decision
 * did, to the last decimal.
 *
 * ## Why the events have to be replayed and not redrawn
 *
 * The event draw depends on the state. Let the counterfactual arm draw its own
 * and the two runs meet different weather the moment they diverge, at which
 * point the difference between them stops being the policy and starts being
 * luck — which is exactly the mistake the first version of
 * `events/consequence.test.ts` made, and it reported every event in the catalog
 * as consequential including one that changed nothing.
 *
 * So the arms are handed the *recorded* effects of the events that actually
 * fired, verbatim and already scaled. `ResolvedEventRecord` carries both the
 * immediate deltas and the queued consequences with the step each lands on,
 * for this reason alone.
 *
 * ## Why the arms are advanced in lockstep rather than replayed from the start
 *
 * Replaying the whole run at every meeting is quadratic and would be felt by
 * the fifteenth. Each arm is a live state advanced one meeting at a time
 * beside the real one, so the whole apparatus costs a fixed multiple of one
 * meeting's work however long the mandate runs.
 */

/**
 * What a given arm holds still.
 *
 * Grouped by what the player recognises as one lever rather than by
 * `InstrumentId`, because "what did my balance sheet do" is a question and
 * "what did `balance_sheet_runoff` do, separately from `asset_purchases`" is
 * an interrogation.
 */
export type FrozenSet =
  | 'everything'
  | 'policy_rate'
  | 'balance_sheet'
  | 'facilities'
  | 'communication'

const GROUPS: Readonly<Record<Exclude<FrozenSet, 'everything'>, readonly InstrumentId[]>> =
  {
    policy_rate: ['policy_rate'],
    balance_sheet: ['asset_purchases', 'balance_sheet_runoff'],
    facilities: [
      'iorb_spread',
      'discount_window',
      'reverse_repo',
      'swap_lines',
      'deposit_facility_spread',
      'minimum_reserves',
      'targeted_refinancing',
      'transmission_protection',
    ],
    communication: ['forward_guidance'],
  }

export const FROZEN_LABEL: Readonly<Record<FrozenSet, string>> = {
  everything: 'everything you did',
  policy_rate: 'your rate decisions',
  balance_sheet: 'your balance sheet',
  facilities: 'your facilities',
  communication: 'what you announced',
}

/** Strips the instruments this arm holds still out of a package. */
export function withoutGroup(pkg: PolicyPackage, frozen: FrozenSet): PolicyPackage {
  if (frozen === 'everything') return { actions: [], communication: null }
  const held = new Set<InstrumentId>(GROUPS[frozen])
  return {
    actions: pkg.actions.filter((action) => !held.has(action.instrument)),
    // Holding the announcement still means saying nothing on the record, not
    // saying the opposite: a committee that publishes no path is the honest
    // "without your words" arm.
    communication:
      frozen === 'communication'
        ? pkg.communication === null
          ? null
          : { ...pkg.communication, commitment: 'none' }
        : pkg.communication,
  }
}

/**
 * Advances one arm through one meeting.
 *
 * `events` are the records that fired in the *real* run at this meeting, and
 * they are applied here exactly as they were there. The draw is still
 * consumed — see below — so the arm stays in step with the run it is being
 * differenced against, and cannot diverge from it for any reason other than
 * the package.
 */
export function advanceArm(
  state: SimulationState,
  pkg: PolicyPackage,
  events: readonly ResolvedEventRecord[],
): SimulationState {
  const applied = applyPolicyPackage(state, pkg)
  // A package the real run accepted can still be rejected here — a rate the
  // frozen arm never raised may leave a cut below the floor. Holding instead
  // is the honest fallback: the arm did nothing that meeting.
  const base = applied.ok ? applied.state : state

  // The draw has to be consumed even though the outcome is discarded.
  //
  // `resolveEvent` always draws, whether or not an event fires, so that
  // *whether* one fires cannot shift the sequence the rest of the run depends
  // on. An arm that skipped it would sit one position off and every
  // substep's noise would differ — measured, that alone put the replay 0.006
  // pp away from the run it was supposed to be reproducing, which is small
  // enough to look like rounding and large enough to make the word "exact" a
  // lie. Calling the real resolver and keeping only its generator is what
  // guarantees the two stay in step if its draw sequence ever changes.
  const drawn = resolveEvent(base).state.rng

  const immediate = events.flatMap((record) => record.immediate)
  const pending = events.flatMap((record) =>
    record.delayed.map((entry) => ({
      eventId: record.eventId,
      fireAtStep: entry.fireAtStep,
      effects: entry.effects,
    })),
  )

  return advanceTrueState({
    ...base,
    rng: drawn,
    latent:
      immediate.length === 0
        ? base.latent
        : clampLatentState(applyEffects(base.latent, immediate), base.stepIndex, []),
    pendingEffects: [...base.pendingEffects, ...pending],
    eventLog: events.length === 0 ? base.eventLog : [...base.eventLog, ...events],
  })
}

/** One series, as it actually went and as it would have gone. */
export interface SeriesAttribution {
  readonly seriesId: SeriesId
  readonly label: string
  readonly unit: string
  readonly decimals: number
  /** Where it actually is. */
  readonly actual: number
  /** Where it would be with everything the player did held still. */
  readonly counterfactual: number
  /** actual − counterfactual: the whole policy's contribution. */
  readonly total: number
  /**
   * Each lever's own contribution, by leaving it out.
   *
   * These do not sum to `total`, and saying so matters: policy instruments
   * interact, so a decomposition that added up exactly would be arithmetic
   * rather than measurement. Each is the honest answer to "what would have
   * happened if I had not done *this* one".
   */
  readonly byLever: Readonly<Partial<Record<FrozenSet, number>>>
}

/** Reads one series off a latent state through its own published definition. */
function read(state: SimulationState, seriesId: SeriesId): number | null {
  const series = getSeries(seriesId)
  if (series === undefined) return null
  if (!series.institutions.includes(state.config.institution)) return null
  return series.read(state.latent)
}

export function attribute(
  actual: SimulationState,
  arms: Readonly<Partial<Record<FrozenSet, SimulationState>>>,
  seriesIds: readonly SeriesId[],
): readonly SeriesAttribution[] {
  const out: SeriesAttribution[] = []
  const frozenAll = arms.everything

  for (const seriesId of seriesIds) {
    const series = getSeries(seriesId)
    const now = read(actual, seriesId)
    if (series === undefined || now === null || frozenAll === undefined) continue
    const without = read(frozenAll, seriesId)
    if (without === null) continue

    const byLever: Partial<Record<FrozenSet, number>> = {}
    for (const [lever, arm] of Object.entries(arms) as [FrozenSet, SimulationState][]) {
      if (lever === 'everything') continue
      const value = read(arm, seriesId)
      if (value !== null) byLever[lever] = now - value
    }

    out.push({
      seriesId,
      label: series.label,
      unit: series.unit,
      decimals: series.decimals,
      actual: now,
      counterfactual: without,
      total: now - without,
      byLever,
    })
  }

  return out
}
