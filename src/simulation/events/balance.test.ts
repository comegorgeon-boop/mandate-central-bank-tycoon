// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Difficulty, Institution } from '../types/core.ts'
import type { EventContext, GameEvent } from '../types/events.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { meetsDifficulty } from '../config/difficulty.ts'
import { createInitialState, createRunConfig } from '../engine/initialState.ts'
import { advanceTrueState } from '../engine/advanceTrueState.ts'
import { applyPolicyPackage } from '../engine/applyPolicyPackage.ts'
import { evaluateEndConditions } from '../scoring/endConditions.ts'
import { EVENT_CATALOG } from './catalog.ts'
import { buildEventContext, resolveEvent } from './resolveEvent.ts'
import {
  NEUTRAL_BAND,
  classifyEvent,
  inflationImpulse,
  type InflationDirection,
} from './inflationImpulse.ts'

/**
 * The guard-rail on the procedural catalog's inflation balance.
 *
 * A hand-written event catalog drifts one way, because a spectacular bad news
 * story is easier to invent than a convincing good one. The first measured
 * build of this catalog fired cost-push events 188 times against 6 relieving
 * ones on fed/easy, and that 31:1 ratio produced 0.97pp of the 1.02pp inflation
 * drift a passive player faced — while the shock processes, which are symmetric
 * by construction, produced 0.06pp.
 *
 * The engine's own randomness is therefore not where the bias lives, and no
 * amount of care in `config/shocks.ts` protects against it. This suite measures
 * the ratio the catalog *actually realises* over many seeded runs, which is the
 * only number that matters: eligibility gates and weight functions can turn a
 * catalog that looks balanced on paper into one that never fires its good news.
 *
 * It exists so the next batch of events cannot reintroduce the skew silently.
 */

/** Seeded passive runs per bucket. Enough that the counts are not a draw. */
const RUNS = 60

/**
 * The band the realised ratio must stay inside.
 *
 * Not 1.0. An economy where good and bad news are exactly balanced has no
 * inflation problem to solve, and the game needs one. But at 2.5 the catalog is
 * writing the outcome rather than posing a question, because no instrument in
 * the game touches the event stream.
 */
const MIN_RATIO = 0.7
const MAX_RATIO = 2.5

const INSTITUTIONS: readonly Institution[] = ['fed', 'ecb']
const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard']

/** Plays a whole mandate holding the rate, and returns the events that fired. */
function firedEvents(
  institution: Institution,
  difficulty: Difficulty,
  seed: string,
): readonly string[] {
  const config = createRunConfig({
    institution,
    difficulty,
    seed,
    simulationVersion: SIMULATION_VERSION,
  })
  let state = createInitialState(config)
  let outcome = evaluateEndConditions(state)

  while (outcome.status === 'active') {
    const applied = applyPolicyPackage(state, { actions: [], communication: null })
    if (!applied.ok) throw new Error('hold was rejected')
    const resolution = resolveEvent(applied.state)
    state = advanceTrueState(resolution.state)
    outcome = evaluateEndConditions(state, outcome.breachCounters)
  }

  return state.eventLog.map((record) => record.eventId)
}

/** A representative mid-run context for classifying a definition. */
function referenceContext(
  institution: Institution,
  difficulty: Difficulty,
): EventContext {
  const config = createRunConfig({
    institution,
    difficulty,
    seed: 'catalog-reference',
    simulationVersion: SIMULATION_VERSION,
  })
  const state = createInitialState(config)
  return {
    ...buildEventContext(state),
    // Classify a relief event in the state it is designed to fire in: after
    // prices have already risen. Judged at a calm reference it would look
    // inert, which is precisely the bug this suite exists to catch.
    latent: { ...state.latent, supplyShock: 1.5 },
    meetingIndex: Math.floor(config.meetingCount / 2),
  }
}

function eligibleFor(institution: Institution, difficulty: Difficulty): GameEvent[] {
  return EVENT_CATALOG.filter(
    (event) =>
      event.institutions.includes(institution) &&
      meetsDifficulty(difficulty, event.minDifficulty),
  )
}

describe('the event catalog does not write the inflation outcome by itself', () => {
  for (const institution of INSTITUTIONS) {
    for (const difficulty of DIFFICULTIES) {
      it(`realises a balanced firing ratio on ${institution}/${difficulty}`, () => {
        const ctx = referenceContext(institution, difficulty)
        const direction = new Map<string, InflationDirection>()
        for (const event of eligibleFor(institution, difficulty)) {
          direction.set(event.id, classifyEvent(event, ctx))
        }

        const counts: Record<InflationDirection, number> = {
          inflationary: 0,
          disinflationary: 0,
          neutral: 0,
        }
        for (let run = 0; run < RUNS; run += 1) {
          for (const id of firedEvents(institution, difficulty, `balance-${run}`)) {
            const of = direction.get(id)
            if (of) counts[of] += 1
          }
        }

        // A catalog that never fires its good news is the failure mode, so an
        // absent denominator has to fail rather than divide by zero.
        expect(
          counts.disinflationary,
          `no disinflationary event fired at all in ${RUNS} runs of ` +
            `${institution}/${difficulty}; inflationary fired ${counts.inflationary} times`,
        ).toBeGreaterThan(0)

        const ratio = counts.inflationary / counts.disinflationary
        expect(
          ratio,
          `${institution}/${difficulty} fired ${counts.inflationary} inflationary ` +
            `and ${counts.disinflationary} disinflationary events over ${RUNS} runs ` +
            `(ratio ${ratio.toFixed(2)}, band ${MIN_RATIO}-${MAX_RATIO}). ` +
            `Neutral: ${counts.neutral}. See docs/BALANCE.md.`,
        ).toBeLessThanOrEqual(MAX_RATIO)
        expect(ratio).toBeGreaterThanOrEqual(MIN_RATIO)
      })
    }
  }
})

describe('the catalog offers both directions before any run is played', () => {
  /**
   * The paper check, which the realised ratio above cannot replace and which
   * cannot replace it either: a catalog can look balanced here and still never
   * fire its relief, because eligibility gates and weights decide what a player
   * actually meets.
   */
  for (const institution of INSTITUTIONS) {
    for (const difficulty of DIFFICULTIES) {
      it(`stocks disinflationary events on ${institution}/${difficulty}`, () => {
        const ctx = referenceContext(institution, difficulty)
        const events = eligibleFor(institution, difficulty)
        const disinflationary = events.filter(
          (event) => classifyEvent(event, ctx) === 'disinflationary',
        )
        const inflationary = events.filter(
          (event) => classifyEvent(event, ctx) === 'inflationary',
        )

        expect(disinflationary.length).toBeGreaterThan(0)
        expect(inflationary.length / disinflationary.length).toBeLessThanOrEqual(2)
      })
    }
  }

  it('classifies a clear cost-push event as inflationary', () => {
    const ctx = referenceContext('fed', 'easy')
    const spike = EVENT_CATALOG.find((event) => event.id === 'energy_price_spike')
    expect(spike).toBeDefined()
    expect(inflationImpulse(spike!, ctx)).toBeGreaterThan(NEUTRAL_BAND)
  })

  it('classifies its relieving counterpart as disinflationary', () => {
    const ctx = referenceContext('fed', 'easy')
    const relief = EVENT_CATALOG.find((event) => event.id === 'energy_price_relief')
    expect(relief).toBeDefined()
    expect(inflationImpulse(relief!, ctx)).toBeLessThan(-NEUTRAL_BAND)
  })

  it('counts delayed effects, so a spike that fully unwinds reads as balanced', () => {
    // An event authored as "+2 now, -2 in three meetings" is not an inflation
    // event, and must not be counted as one.
    const ctx = referenceContext('fed', 'easy')
    const balanced: GameEvent = {
      ...EVENT_CATALOG[0],
      immediate: () => [{ variable: 'supplyShock', delta: 2 }],
      delayed: () => [
        { delaySteps: 12, effects: [{ variable: 'supplyShock', delta: -2 }] },
      ],
    }
    expect(inflationImpulse(balanced, ctx)).toBeCloseTo(0, 10)
    expect(classifyEvent(balanced, ctx)).toBe('neutral')
  })
})
