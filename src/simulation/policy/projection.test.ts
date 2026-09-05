// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { PolicyPackage } from '../types/policy.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { createInitialState, createRunConfig } from '../engine/initialState.ts'
import { PROJECTION_HORIZON, projectPackage } from './projection.ts'

/**
 * The projection the learning mandate shows before a decision is confirmed.
 *
 * Its whole value is that it is the *model's* answer rather than a plausible
 * sentence, so what these tests protect is that property: it must move the
 * right way, it must be worth nothing when the package does nothing, and above
 * all it must never touch the run it is projecting.
 */

function fixture() {
  const config = createRunConfig({
    institution: 'fed',
    difficulty: 'easy',
    seed: 'projection',
    simulationVersion: SIMULATION_VERSION,
  })
  return createInitialState(config, { openingEvent: false })
}

const HOLD: PolicyPackage = { actions: [], communication: null }
const HIKE: PolicyPackage = {
  actions: [{ instrument: 'policy_rate', magnitude: 100 }],
  communication: null,
}
const CUT: PolicyPackage = {
  actions: [{ instrument: 'policy_rate', magnitude: -100 }],
  communication: null,
}

describe('the package projection', () => {
  it('leaves the run it projects completely untouched', () => {
    // The load-bearing property. The projection advances the engine, which
    // consumes randomness; if any of that reached the live state, looking at
    // the confirmation screen would change the game.
    const state = fixture()
    const before = structuredClone(state)
    projectPackage(state, HIKE)
    expect(state).toEqual(before)
  })

  it('is worth nothing when the package does nothing', () => {
    const projection = projectPackage(fixture(), HOLD)
    expect(projection).not.toBeNull()
    expect(projection?.unchanged).toBe(true)
    for (const entry of projection?.series ?? []) {
      expect(entry.withPackage, entry.seriesId).toBeCloseTo(entry.holding, 8)
    }
  })

  it('puts a hike below the hold on inflation and above it on unemployment', () => {
    const projection = projectPackage(fixture(), HIKE)
    expect(projection?.unchanged).toBe(false)

    const inflation = projection?.series.find((s) => s.seriesId === 'headline_inflation')
    const unemployment = projection?.series.find((s) => s.seriesId === 'unemployment')
    expect(inflation).toBeDefined()
    expect(unemployment).toBeDefined()
    // The trade-off, in the only place the player is shown it before deciding.
    expect(inflation!.withPackage).toBeLessThan(inflation!.holding)
    expect(unemployment!.withPackage).toBeGreaterThan(unemployment!.holding)
  })

  it('mirrors itself for a cut', () => {
    const hike = projectPackage(fixture(), HIKE)
    const cut = projectPackage(fixture(), CUT)
    const of = (p: typeof hike, id: string) =>
      p?.series.find((s) => s.seriesId === id)

    const hikeInflation = of(hike, 'headline_inflation')!
    const cutInflation = of(cut, 'headline_inflation')!
    expect(hikeInflation.withPackage).toBeLessThan(hikeInflation.holding)
    expect(cutInflation.withPackage).toBeGreaterThan(cutInflation.holding)
  })

  it('shows the fast channel moving further than the slow ones', () => {
    // The lesson the projection exists to teach: the priced path reprices
    // immediately while inflation has barely begun to move. If this ever
    // inverts, the transmission calibration has broken.
    const projection = projectPackage(fixture(), HIKE)!
    const priced = projection.series.find((s) => s.seriesId === 'market_expected_rate')!
    const inflation = projection.series.find((s) => s.seriesId === 'headline_inflation')!
    expect(Math.abs(priced.withPackage - priced.holding)).toBeGreaterThan(
      Math.abs(inflation.withPackage - inflation.holding),
    )
  })

  it('projects the horizon it says it does', () => {
    expect(projectPackage(fixture(), HIKE)?.horizonMeetings).toBe(PROJECTION_HORIZON)
  })

  it('returns nothing rather than a partial answer for a package the engine rejects', () => {
    const config = createRunConfig({
      institution: 'fed',
      difficulty: 'easy',
      seed: 'projection-floor',
      simulationVersion: SIMULATION_VERSION,
    })
    const state = createInitialState(config, { openingEvent: false })
    const belowTheFloor: PolicyPackage = {
      actions: [{ instrument: 'policy_rate', magnitude: -10_000 }],
      communication: null,
    }
    expect(projectPackage(state, belowTheFloor)).toBeNull()
  })

  it('is deterministic', () => {
    const a = projectPackage(fixture(), HIKE)
    const b = projectPackage(fixture(), HIKE)
    expect(a).toEqual(b)
  })
})
