// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { LatentState, SimulationState } from '../types/state.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { createInitialState, createRunConfig } from '../engine/initialState.ts'
import { applyPolicyPackage } from '../engine/applyPolicyPackage.ts'
import { SCORE_WEIGHTS } from '../config/scoring.ts'
import { demandConsequences, politicalDemand } from './demands.ts'

/**
 * The dilemma, and the three properties that make it one.
 *
 * The design, restated as tests:
 *
 *  1. **Yielding buys survival and costs the rest.** Pressure falls a long
 *     way; credibility, the anchor and the priced path all pay for it.
 *  2. **Resisting is not free.** Pressure rises, which is the removal gauge
 *     rising, and the credit it earns back is smaller than what yielding
 *     costs — otherwise there is no decision, only a correct answer.
 *  3. **Silence is a refusal at a discount.** A demand that could be ignored
 *     for free would not be a demand.
 *
 * And the constraint the whole thing lives under: **political pressure moves
 * nothing in the economy directly.** Answering a demand changes the
 * institution's standing and what markets expect. It does not move inflation,
 * output or unemployment by a single basis point on the day.
 */

/** A state with the pressure and economy a demand needs, and nothing else. */
function pressed(overrides: Partial<LatentState> = {}): SimulationState {
  const base = createInitialState(
    createRunConfig({
      institution: 'fed',
      difficulty: 'medium',
      seed: 'DEMANDS',
      simulationVersion: SIMULATION_VERSION,
    }),
    { openingEvent: false, tutorialDamage: false },
  )
  return {
    ...base,
    latent: {
      ...base.latent,
      politicalPressure: 70,
      unemployment: base.latent.naturalUnemployment + 2,
      inflationHeadline: 2,
      policyRate: 5,
      ...overrides,
    },
  }
}

const hold = { actions: [], communication: null } as const

describe('a government that wants something asks for it', () => {
  it('says nothing while the pressure is ordinary', () => {
    expect(politicalDemand(pressed({ politicalPressure: 30 }))).toBeNull()
  })

  it('asks once the pressure is real and the economy gives it a reason', () => {
    const demand = politicalDemand(pressed())
    expect(demand).not.toBeNull()
    expect(demand?.from.length).toBeGreaterThan(0)
  })

  it('asks the same thing of the same economy, every time', () => {
    // Derived, not drawn. A player can learn that an economy with these
    // properties produces this pressure; they cannot learn to steer around a
    // coin flip.
    const a = politicalDemand(pressed())
    const b = politicalDemand(pressed())
    expect(a?.id).toBe(b?.id)
    expect(a?.force).toBe(b?.force)
  })

  it('presses harder the higher the pressure', () => {
    const mild = politicalDemand(pressed({ politicalPressure: 50 }))
    const severe = politicalDemand(pressed({ politicalPressure: 92 }))
    expect(severe!.force).toBeGreaterThan(mild!.force)
  })

  it('names an office and never a person', () => {
    // The project's rule, enforced where it is easiest to break: a demand is
    // the one place in the game where somebody is making a request, and a
    // request wants a name attached to it.
    for (const pressure of [50, 70, 95]) {
      for (const latent of [
        { politicalPressure: pressure },
        { politicalPressure: pressure, debtPressure: 80, debtService: 6 },
        { politicalPressure: pressure, publicTrust: 30 },
      ]) {
        const demand = politicalDemand(pressed(latent))
        if (demand === null) continue
        const prose = [demand.from, demand.title, demand.body, demand.yieldLabel, demand.resistLabel]
        for (const text of prose) {
          expect(text, text.slice(0, 50)).not.toMatch(/["“”]/)
          expect(text, text.slice(0, 50)).not.toMatch(
            /\b(said|says|told|declared|insisted|promised)\b/i,
          )
        }
      }
    }
  })
})

describe('the two answers, and the shape of the choice', () => {
  const demand = politicalDemand(pressed())!
  const yielded = demandConsequences(demand, 'yield')
  const resisted = demandConsequences(demand, 'resist')

  it('buys survival by yielding', () => {
    expect(yielded.politicalPressure).toBeLessThan(0)
    expect(resisted.politicalPressure).toBeGreaterThan(0)
  })

  it('charges for it in the things the job is for', () => {
    expect(yielded.credibility).toBeLessThan(0)
    expect(yielded.anchoring).toBeLessThan(0)
    // And markets price the easier policy before the rate has moved, which is
    // what makes yielding expensive on the day rather than later.
    expect(yielded.marketExpectedRate).toBeLessThan(0)
  })

  it('pays less for holding than it charges for giving in', () => {
    // The asymmetry is the decision. If resisting paid as much as yielding
    // cost, there would be a correct answer and no dilemma.
    expect(resisted.credibility).toBeLessThan(-yielded.credibility)
    expect(resisted.anchoring).toBeLessThan(-yielded.anchoring)
  })

  it('pleases the public by yielding and annoys them by holding', () => {
    expect(yielded.publicTrust).toBeGreaterThan(0)
    expect(resisted.publicTrust).toBeLessThan(0)
  })
})

describe('answering changes the institution and not the economy', () => {
  const state = pressed()

  const answer = (demandResponse: 'yield' | 'resist' | null) => {
    const applied = applyPolicyPackage(state, {
      ...hold,
      ...(demandResponse === null ? {} : { demandResponse }),
    })
    if (!applied.ok) throw new Error('the hold was rejected')
    return applied.state.latent
  }

  const unanswered = answer(null)
  const gaveIn = answer('yield')
  const heldOut = answer('resist')

  it('moves no real quantity on the day', () => {
    // The constraint the whole mechanic lives under. Political pressure is not
    // a tax on growth; it works through expectations, standing and the risk of
    // removal, and a version of it that moved output directly would be a
    // different and much worse idea.
    for (const field of [
      'inflationHeadline',
      'inflationCore',
      'outputGap',
      'unemployment',
      'potentialGrowth',
    ] as const) {
      expect(gaveIn[field], field).toBe(heldOut[field])
      expect(gaveIn[field], field).toBe(state.latent[field])
    }
  })

  it('collapses the pressure when the committee gives in', () => {
    expect(gaveIn.politicalPressure).toBeLessThan(state.latent.politicalPressure)
    expect(heldOut.politicalPressure).toBeGreaterThan(state.latent.politicalPressure)
  })

  it('spends the standing to buy it', () => {
    expect(gaveIn.credibility).toBeLessThan(heldOut.credibility)
    expect(gaveIn.anchoring).toBeLessThan(heldOut.anchoring)
    expect(gaveIn.marketExpectedRate).toBeLessThan(heldOut.marketExpectedRate)
  })

  it('treats silence as a refusal, at a discount', () => {
    // The pressure rises in full — the government did not get what it asked
    // for either way — and only the credit for holding is reduced, because
    // saying no out loud is the part that is worth something.
    expect(unanswered.politicalPressure).toBe(heldOut.politicalPressure)
    expect(unanswered.credibility).toBeLessThan(heldOut.credibility)
    expect(unanswered.credibility).toBeGreaterThan(gaveIn.credibility)
  })
})

describe('political pressure is not in the mandate either', () => {
  it('is scored on no component named for it', () => {
    const components = Object.keys(SCORE_WEIGHTS.fed)
    for (const forbidden of ['political', 'pressure', 'popularity']) {
      expect(components.filter((id) => id.includes(forbidden))).toHaveLength(0)
    }
  })
})
