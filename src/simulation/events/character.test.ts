// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Difficulty, Institution } from '../types/core.ts'
import type { EventContext, GameEvent, ShockCharacter } from '../types/events.ts'
import type { LatentState } from '../types/state.ts'
import { SHOCK_CHARACTERS } from '../types/events.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { DIFFICULTIES, getDifficulty } from '../config/difficulty.ts'
import { IS_CURVE } from '../config/model.ts'
import { createInitialState, createRunConfig } from '../engine/initialState.ts'
import { EVENT_CATALOG } from './catalog.ts'
import { buildEventContext, eligibleEvents } from './resolveEvent.ts'
import { inflationImpulse } from './inflationImpulse.ts'
import { openingCandidates } from './openingCrisis.ts'

/**
 * The declared shock character, checked against what each event delivers.
 *
 * `shockCharacter` is the axis the whole difficulty ladder now stands on: easy
 * suppresses supply shocks because they are the ones with no right answer,
 * medium opens them, hard piles them up. A hand-written declaration that drifts
 * from the effects underneath it would silently reroute an event into the wrong
 * mode — a cost-push shock declared `demand` would walk straight into the
 * tutorial, which is the exact failure this whole axis exists to fix.
 *
 * So the declaration is not taken on trust. Supply and demand are separated
 * here by the textbook property that separates them in the model: a demand
 * shock moves prices and activity the *same* way, so leaning against it
 * addresses both at once; a supply shock moves them *opposite* ways, so every
 * move buys one half of the mandate by selling the other. Financial and
 * institutional events are checked against the variables they are allowed to be
 * about, since neither is primarily a statement about the price level.
 */

/**
 * Percentage points of output gap per unit of each latent variable, at the peak
 * of its effect.
 *
 * The mirror of `inflationImpulse`'s `INFLATION_WEIGHTS`, derived the same way
 * from the model's own coefficients: a disturbance of one unit settles the gap
 * at `1 / meanReversion`. Deliberately kept in the test rather than shipped —
 * nothing in the engine needs it, and only the sign is load-bearing here.
 */
const GAP_PER_UNIT = 1 / IS_CURVE.meanReversion

const OUTPUT_WEIGHTS: Partial<Record<keyof LatentState, number>> = {
  outputGap: 1,
  demandShock: GAP_PER_UNIT,
  confidenceShock: IS_CURVE.confidence * GAP_PER_UNIT,
  fiscalImpulse: IS_CURVE.fiscal * GAP_PER_UNIT,
  creditGrowth: IS_CURVE.credit * GAP_PER_UNIT,
  // The contractionary side of a cost-push shock: a terms-of-trade loss cuts
  // real income and output, which is what makes it stagflationary.
  supplyShock: -IS_CURVE.supply * GAP_PER_UNIT,
  // Capacity, not demand: more potential lowers the gap at unchanged output.
  productivityShock: -GAP_PER_UNIT,
  potentialGrowth: -GAP_PER_UNIT,
}

function outputImpulse(event: GameEvent, ctx: EventContext): number {
  let total = 0
  const accumulate = (variable: keyof LatentState, delta: number): void => {
    total += (OUTPUT_WEIGHTS[variable] ?? 0) * delta
  }
  for (const effect of event.immediate(ctx)) accumulate(effect.variable, effect.delta)
  for (const spec of event.delayed(ctx)) {
    for (const effect of spec.effects) accumulate(effect.variable, effect.delta)
  }
  return total
}

/**
 * The cost side of the supply block, as opposed to the capacity side.
 *
 * These are the two the model makes stagflationary: they raise prices by
 * raising costs, and `IS_CURVE.supply` cuts real income on the way, so the
 * trade-off is in the equations rather than in the label.
 *
 * `productivityShock` and `potentialGrowth` are supply-side too, but they move
 * capacity rather than costs and pose no dilemma at all. `importPriceInflation`
 * is deliberately *not* here either: it is a pass-through channel, not a shock
 * — a currency depreciation runs through it while being inflationary and
 * expansionary at once, which is the demand pattern, not the supply one.
 */
const COST_PUSH_VARIABLES: readonly (keyof LatentState)[] = [
  'supplyShock',
  'wageGrowth',
]

/** Variables a financial or institutional event is allowed to be about. */
const SIGNATURE: Readonly<Record<ShockCharacter, readonly (keyof LatentState)[]>> = {
  demand: ['outputGap', 'demandShock', 'fiscalImpulse', 'confidenceShock', 'creditGrowth'],
  supply: [
    'supplyShock',
    'importPriceInflation',
    'wageGrowth',
    'productivityShock',
    'potentialGrowth',
  ],
  financial: [
    'bankingStress',
    'creditSpread',
    'marketVolatility',
    'assetPricePressure',
    'creditGrowth',
    'reserves',
    'financialShock',
  ],
  institutional: [
    'credibility',
    'marketTrust',
    'politicalPressure',
    'potentialGrowth',
    'naturalUnemployment',
    'outputGap',
  ],
}

/** Every variable an event touches, immediate and delayed. */
function touchedVariables(event: GameEvent, ctx: EventContext): Set<keyof LatentState> {
  const touched = new Set<keyof LatentState>()
  for (const effect of event.immediate(ctx)) touched.add(effect.variable)
  for (const spec of event.delayed(ctx)) {
    for (const effect of spec.effects) touched.add(effect.variable)
  }
  return touched
}

/**
 * A reference context per bucket. Events are state-dependent, so a declaration
 * is checked in a real economy rather than against a hand-built latent state.
 */
function referenceContext(
  institution: Institution,
  difficulty: Difficulty,
): EventContext {
  const config = createRunConfig({
    institution,
    difficulty,
    seed: 'character-reference',
    simulationVersion: SIMULATION_VERSION,
  })
  return buildEventContext(createInitialState(config, { openingEvent: false }))
}

/**
 * The band inside which an impulse is too small to carry a sign.
 *
 * A political shock that nudges confidence by a tenth of a point is not making
 * a claim about the price level, and forcing it to pick a side would make the
 * co-movement test meaningless.
 */
const SIGN_BAND = 0.15

describe('the declared shock character', () => {
  it('is declared exactly once per event, from the known set', () => {
    for (const event of EVENT_CATALOG) {
      expect(
        SHOCK_CHARACTERS,
        `${event.id} declares an unknown character`,
      ).toContain(event.shockCharacter)
    }
  })

  it('matches the co-movement of prices and output the model actually produces', () => {
    const ctx = referenceContext('fed', 'medium')

    for (const event of EVENT_CATALOG) {
      const inflation = inflationImpulse(event, ctx)
      const output = outputImpulse(event, ctx)
      const bothCarrySign =
        Math.abs(inflation) > SIGN_BAND && Math.abs(output) > SIGN_BAND
      if (!bothCarrySign) continue

      if (event.shockCharacter === 'demand') {
        // Prices and activity together: one instrument addresses both.
        expect(
          Math.sign(inflation),
          `${event.id} declares demand but moves inflation ${inflation.toFixed(2)} ` +
            `against output ${output.toFixed(2)}`,
        ).toBe(Math.sign(output))
      }

      // Only the *cost* half of the supply side carries the trade-off. A
      // capacity shock — a productivity surge, say — raises potential faster
      // than output, so it is disinflationary *and* opens a negative gap: both
      // impulses point the same way and there is no dilemma in it, which is
      // correct model behaviour rather than a mis-declaration. Asserting the
      // opposition on those too was this test's first, wrong formulation.
      const touched = touchedVariables(event, ctx)
      const isCostPush = COST_PUSH_VARIABLES.some((variable) => touched.has(variable))

      if (event.shockCharacter === 'supply' && isCostPush) {
        // Prices and activity opposed: the trade-off with no right answer,
        // and the reason easy rations these and hard is made of them.
        expect(
          Math.sign(inflation),
          `${event.id} declares supply but moves inflation ${inflation.toFixed(2)} ` +
            `with output ${output.toFixed(2)}`,
        ).toBe(-Math.sign(output))
      }
    }
  })

  it('routes every cost-push event through the supply character, and nothing else', () => {
    const ctx = referenceContext('fed', 'medium')

    // The one direction that actually matters for the ladder: a cost-push
    // shock declared anything but `supply` would be exempt from both the easy
    // mix and the cost-push ceiling, and would walk straight into the tutorial.
    for (const event of EVENT_CATALOG) {
      const touched = touchedVariables(event, ctx)
      if (!COST_PUSH_VARIABLES.some((variable) => touched.has(variable))) continue
      expect(
        event.shockCharacter,
        `${event.id} moves a cost-push variable but is not declared supply`,
      ).toBe('supply')
    }
  })

  it('touches at least one variable its character is actually about', () => {
    const ctx = referenceContext('ecb', 'medium')

    for (const event of EVENT_CATALOG) {
      const touched = touchedVariables(event, ctx)
      const signature = SIGNATURE[event.shockCharacter]
      expect(
        signature.some((variable) => touched.has(variable)),
        `${event.id} declares ${event.shockCharacter} but touches none of ` +
          `${signature.join(', ')}`,
      ).toBe(true)
    }
  })
})

describe('the shock mix', () => {
  it('declares a weight for every character at every difficulty', () => {
    for (const difficulty of Object.values(DIFFICULTIES)) {
      for (const character of SHOCK_CHARACTERS) {
        const weight = difficulty.shockMix[character]
        expect(Number.isFinite(weight), `${difficulty.id}/${character}`).toBe(true)
        expect(weight, `${difficulty.id}/${character}`).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('feeds easy demand shocks and holds supply back, and reverses that by hard', () => {
    const easy = getDifficulty('easy').shockMix
    const hard = getDifficulty('hard').shockMix

    // Easy is the mode where the instrument is shown to work, so it must serve
    // far more of the problem that has a right answer than of the one that
    // does not.
    expect(easy.demand / easy.supply).toBeGreaterThan(4)
    // Hard is the real job: supply weighted at least as heavily as demand.
    expect(hard.supply).toBeGreaterThanOrEqual(hard.demand)
    // And the ladder must run one way — supply exposure never falls with
    // difficulty, or the modes are not ordered by the thing they claim.
    const medium = getDifficulty('medium').shockMix
    expect(medium.supply).toBeGreaterThan(easy.supply)
    expect(hard.supply).toBeGreaterThanOrEqual(medium.supply)
  })

  it('raises the ceiling on simultaneous cost-push shocks with difficulty', () => {
    expect(getDifficulty('easy').costPushCeiling).toBeLessThan(
      getDifficulty('medium').costPushCeiling,
    )
    expect(getDifficulty('medium').costPushCeiling).toBeLessThan(
      getDifficulty('hard').costPushCeiling,
    )
  })
})

describe('the cost-push ceiling', () => {
  /** A state carrying a large outstanding cost-push shock. */
  function stressedContext(difficulty: Difficulty): EventContext {
    const config = createRunConfig({
      institution: 'fed',
      difficulty,
      seed: 'ceiling-reference',
      simulationVersion: SIMULATION_VERSION,
    })
    const state = createInitialState(config, { openingEvent: false })
    return buildEventContext({
      ...state,
      latent: { ...state.latent, supplyShock: 4.0 },
    })
  }

  it('stops a second adverse cost-push shock landing on the first, at easy', () => {
    const eligible = eligibleEvents(stressedContext('easy'))
    const ids = eligible.map((event) => event.id)

    expect(ids).not.toContain('energy_price_spike')
    expect(ids).not.toContain('supply_chain_disruption')
    expect(ids).not.toContain('geopolitical_escalation')
    expect(ids).not.toContain('supply_rupture')
  })

  it('never blocks the relief that ends the episode', () => {
    const ids = eligibleEvents(stressedContext('easy')).map((event) => event.id)

    // Good news that needs permission to happen is not good news the player
    // will ever meet — and gating relief on the shock outstanding would mean
    // the worse the shock the less able the economy is to recover from it.
    expect(ids).toContain('energy_price_relief')
    expect(ids).toContain('supply_chain_normalisation')
  })

  it('leaves demand and financial shocks entirely alone', () => {
    const ids = eligibleEvents(stressedContext('easy')).map((event) => event.id)

    expect(ids).toContain('fiscal_expansion')
    expect(ids).toContain('investment_boom')
  })

  it('does not fire at hard, where shocks piling up is the subject', () => {
    const ids = eligibleEvents(stressedContext('hard')).map((event) => event.id)

    expect(ids).toContain('energy_price_spike')
    expect(ids).toContain('supply_chain_disruption')
  })
})

describe('the opening crisis', () => {
  it('offers easy only crises a decision can address', () => {
    for (const institution of ['fed', 'ecb'] as const) {
      const config = createRunConfig({
        institution,
        difficulty: 'easy',
        seed: 'opening-characters',
        simulationVersion: SIMULATION_VERSION,
      })
      const candidates = openingCandidates(
        createInitialState(config, { openingEvent: false }),
      )

      expect(candidates.length).toBeGreaterThan(0)
      for (const candidate of candidates) {
        // The one shock the player did not choose to face and could not have
        // seen coming must be one against which a move exists. Drawn over
        // every major, a third of easy mandates opened on pure cost-push.
        expect(
          candidate.shockCharacter,
          `${candidate.id} may open an easy mandate`,
        ).not.toBe('supply')
      }
    }
  })

  it('is not handed to medium or hard at all', () => {
    for (const difficulty of ['medium', 'hard'] as const) {
      const config = createRunConfig({
        institution: 'fed',
        difficulty,
        seed: 'opening-characters',
        simulationVersion: SIMULATION_VERSION,
      })
      expect(
        openingCandidates(createInitialState(config, { openingEvent: false })),
      ).toHaveLength(0)
      // And a real opening, with the opener switched on, records nothing at
      // meeting zero.
      const opened = createInitialState(config)
      expect(opened.eventLog).toHaveLength(0)
    }
  })
})
