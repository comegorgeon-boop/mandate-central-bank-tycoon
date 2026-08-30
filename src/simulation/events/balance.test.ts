// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Difficulty, Institution } from '../types/core.ts'
import type { EventContext, GameEvent } from '../types/events.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { getDifficulty, meetsDifficulty } from '../config/difficulty.ts'
import { createInitialState, createRunConfig } from '../engine/initialState.ts'
import { advanceTrueState } from '../engine/advanceTrueState.ts'
import { applyPolicyPackage } from '../engine/applyPolicyPackage.ts'
import { evaluateEndConditions } from '../scoring/endConditions.ts'
import { EVENT_CATALOG, EVENTS_BY_ID } from './catalog.ts'
import { buildEventContext, resolveEvent } from './resolveEvent.ts'
import { NEUTRAL_BAND, classifyEvent, inflationImpulse } from './inflationImpulse.ts'

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
 * what the catalog *actually delivers* over many seeded runs, which is the
 * only number that matters: eligibility gates and weight functions can turn a
 * catalog that looks balanced on paper into one that never fires its good news.
 *
 * Delivered means delivered. The first version of this suite counted firings
 * by sign, and a 2:1 skew walked straight through it: the energy spike and the
 * energy relief were paired by *name*, firing about as often as each other,
 * while the spike delivered +1.7 of cost-push every time and the relief — whose
 * size depended on the shock outstanding in the calm state it actually fired
 * in — gave back about 0.7. So every firing is weighted here by
 * `inflationImpulse` evaluated in the state it fired in, scaled by the
 * difficulty's severity multiplier: quantity, not just sign.
 *
 * It exists so the next batch of events cannot reintroduce the skew silently.
 */

/**
 * Seeded passive runs per bucket.
 *
 * 150, not 60: the net-per-meeting statistic below carries roughly ±0.04 of
 * sampling variance at 60 runs, which is the same size as the band it is
 * checked against — the engine version bump reseeded every draw and moved the
 * 60-run readings by exactly that much. At 150 the sampling error is well
 * inside the margin.
 */
const RUNS = 150

/**
 * The band the realised ratio of delivered impulse must stay inside.
 *
 * Not 1.0. An economy where good and bad news are exactly balanced has no
 * inflation problem to solve, and the game needs one. But well before 2 the
 * catalog is writing the outcome rather than posing a question, because no
 * instrument in the game touches the event stream. The measured catalog sits
 * at 1.04-1.26 across the six buckets.
 */
const MIN_RATIO = 0.7
const MAX_RATIO = 1.5

/**
 * Cap on the net delivered impulse per meeting, in the same units.
 *
 * The ratio alone is not enough: at hard's event volume a ratio of 1.35 still
 * poured five units of net cost-push into every run, which is how the +0.70pp
 * drift documented in docs/BALANCE.md passed a ratio band. Net delivery is the
 * quantity that becomes drift, and it scales with meetings, so the cap is per
 * meeting. The measured catalog sits at +0.02 to +0.05; the drifting one read
 * +0.09 to +0.16. The band is asymmetric on purpose: what remains above zero
 * is dominated by the wage-round event, which is gated on an economy left to
 * run hot — pressure a player can act against, unlike the old energy skew.
 */
const MIN_NET_PER_MEETING = -0.08
const MAX_NET_PER_MEETING = 0.08

const INSTITUTIONS: readonly Institution[] = ['fed', 'ecb']
const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard']

/**
 * Plays a whole mandate holding the rate, and returns each firing's delivered
 * inflation impulse: `inflationImpulse` evaluated in the state the event
 * actually fired in, scaled by the difficulty's severity multiplier. Judging
 * every firing at one reference state is the blind spot that let a
 * state-dependent relief event read as its counterpart's equal while
 * delivering half of it.
 */
function deliveredImpulses(
  institution: Institution,
  difficulty: Difficulty,
  seed: string,
): readonly number[] {
  const config = createRunConfig({
    institution,
    difficulty,
    seed,
    simulationVersion: SIMULATION_VERSION,
  })
  const severity = getDifficulty(difficulty).eventSeverityScale
  let state = createInitialState(config)
  let outcome = evaluateEndConditions(state)
  const impulses: number[] = []

  while (outcome.status === 'active') {
    const applied = applyPolicyPackage(state, { actions: [], communication: null })
    if (!applied.ok) throw new Error('hold was rejected')
    const ctx = buildEventContext(applied.state)
    const alreadyFired = applied.state.eventLog.length
    const resolution = resolveEvent(applied.state)
    for (const record of resolution.state.eventLog.slice(alreadyFired)) {
      const definition = EVENTS_BY_ID.get(record.eventId)
      if (!definition) throw new Error(`fired event missing from catalog: ${record.eventId}`)
      impulses.push(inflationImpulse(definition, ctx) * severity)
    }
    state = advanceTrueState(resolution.state)
    outcome = evaluateEndConditions(state, outcome.breachCounters)
  }

  return impulses
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
      it(`realises a balanced delivered impulse on ${institution}/${difficulty}`, () => {
        let delivered = 0
        let relieved = 0
        let meetings = 0
        for (let run = 0; run < RUNS; run += 1) {
          const impulses = deliveredImpulses(institution, difficulty, `balance-${run}`)
          for (const impulse of impulses) {
            if (impulse > 0) delivered += impulse
            else relieved += -impulse
          }
          meetings += getDifficulty(difficulty).meetingCount
        }

        // A catalog that never fires its good news is the failure mode, so an
        // absent denominator has to fail rather than divide by zero.
        expect(
          relieved,
          `no disinflationary impulse was delivered at all in ${RUNS} runs of ` +
            `${institution}/${difficulty}; inflationary delivered ${delivered.toFixed(1)}`,
        ).toBeGreaterThan(0)

        const ratio = delivered / relieved
        expect(
          ratio,
          `${institution}/${difficulty} delivered +${delivered.toFixed(1)} inflationary ` +
            `against -${relieved.toFixed(1)} relieving impulse over ${RUNS} runs ` +
            `(ratio ${ratio.toFixed(2)}, band ${MIN_RATIO}-${MAX_RATIO}). ` +
            `See docs/BALANCE.md.`,
        ).toBeLessThanOrEqual(MAX_RATIO)
        expect(ratio).toBeGreaterThanOrEqual(MIN_RATIO)

        // The quantity that becomes inflation drift: what the ratio hides
        // whenever the gross volumes are large.
        const netPerMeeting = (delivered - relieved) / meetings
        expect(
          netPerMeeting,
          `${institution}/${difficulty} delivered a net ${netPerMeeting.toFixed(3)} ` +
            `of inflation impulse per meeting (band ${MIN_NET_PER_MEETING} to ` +
            `${MAX_NET_PER_MEETING}). The catalog is writing the inflation ` +
            `outcome by itself. See docs/BALANCE.md.`,
        ).toBeLessThanOrEqual(MAX_NET_PER_MEETING)
        expect(netPerMeeting).toBeGreaterThanOrEqual(MIN_NET_PER_MEETING)
      })
    }
  }
})

describe('shock/relief pairs are paired by magnitude, not by name', () => {
  /**
   * The specific defect the delivered measurement above was rebuilt to catch,
   * pinned directly on the definitions so it fails at authoring time rather
   * than after sixty runs: a pair must cancel in *both* the calm state its
   * relieving half usually fires in and the stressed state it is written for.
   * Firing counts are checked nowhere here on purpose — likelihood is allowed
   * to follow the story, magnitude is not.
   */
  const PAIRS: readonly [string, string][] = [
    ['energy_price_spike', 'energy_price_relief'],
    ['supply_chain_disruption', 'supply_chain_normalisation'],
    ['geopolitical_escalation', 'geopolitical_dealescalation'],
    ['fiscal_expansion', 'fiscal_consolidation'],
    ['currency_pressure', 'currency_appreciation'],
  ]

  /** How far from cancelling a pair may be, as a share of its larger half. */
  const PAIR_TOLERANCE = 1 / 3

  for (const [shockId, reliefId] of PAIRS) {
    for (const supplyShock of [0, 1.5]) {
      it(`${shockId} and ${reliefId} cancel at supplyShock ${supplyShock}`, () => {
        const base = referenceContext('fed', 'easy')
        const ctx: EventContext = {
          ...base,
          latent: { ...base.latent, supplyShock },
        }
        const shock = EVENT_CATALOG.find((event) => event.id === shockId)
        const relief = EVENT_CATALOG.find((event) => event.id === reliefId)
        expect(shock).toBeDefined()
        expect(relief).toBeDefined()

        const shockImpulse = inflationImpulse(shock!, ctx)
        const reliefImpulse = inflationImpulse(relief!, ctx)
        const larger = Math.max(Math.abs(shockImpulse), Math.abs(reliefImpulse))
        expect(
          Math.abs(shockImpulse + reliefImpulse),
          `${shockId} delivers ${shockImpulse.toFixed(2)} while ${reliefId} ` +
            `delivers ${reliefImpulse.toFixed(2)} at supplyShock ${supplyShock}: ` +
            `the pair is off by ${Math.abs(shockImpulse + reliefImpulse).toFixed(2)}, ` +
            `more than ${PAIR_TOLERANCE.toFixed(2)} of its larger half.`,
        ).toBeLessThanOrEqual(PAIR_TOLERANCE * larger)
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
