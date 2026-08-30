// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { PolicyPackage } from '../types/policy.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { createRunConfig } from '../engine/initialState.ts'
import { startRun, submitMeeting } from './replayRun.ts'

/**
 * The same-day snapshot.
 *
 * The bug this pins was invisible and total: the observation layer reads
 * `history`, not `latent`, and `applyPolicyPackage` moves `latent` without
 * touching `history`. So an observation taken between the decision and the
 * passage of time reported every zero-lag series at its *pre-decision* value,
 * and the reaction screen showed a rate rise as "you held" — the exact
 * inertness it was built to cure.
 *
 * These tests assert the snapshot moves with the decision, and that restating
 * it changes nothing about the run itself.
 */

const config = createRunConfig({
  institution: 'fed',
  difficulty: 'easy',
  seed: 'on-the-day',
  simulationVersion: SIMULATION_VERSION,
})

const hike: PolicyPackage = {
  actions: [{ instrument: 'policy_rate', magnitude: 50 }],
  communication: null,
}

const hold: PolicyPackage = { actions: [], communication: null }

function advance(pkg: PolicyPackage) {
  const opening = startRun(config)
  const result = submitMeeting(opening, pkg)
  if (!result.ok) throw new Error('the package was rejected')
  return { opening, session: result.session }
}

describe('the observation taken the instant a decision is confirmed', () => {
  it('carries the new policy rate, not the one that was in force', () => {
    const { opening, session } = advance(hike)

    const before = opening.observation.indicators.policy_rate!.value!
    const onTheDay = session.onTheDay!.indicators.policy_rate!.value!

    expect(onTheDay - before).toBeCloseTo(0.5, 10)
  })

  it('registers the surprise in market volatility', () => {
    const { opening, session } = advance(hike)

    const before = opening.observation.indicators.market_volatility!.value!
    const onTheDay = session.onTheDay!.indicators.market_volatility!.value!

    expect(onTheDay).toBeGreaterThan(before)
  })

  it('leaves the lagged statistics exactly where they were', () => {
    // The point of the two-speed economy: no time has passed, so nothing that
    // takes time to respond may have moved.
    const { opening, session } = advance(hike)

    for (const seriesId of ['headline_inflation', 'unemployment', 'wage_growth'] as const) {
      expect(session.onTheDay!.indicators[seriesId]?.value).toBe(
        opening.observation.indicators[seriesId]?.value,
      )
    }
  })

  it('keeps the pre-decision observation intact for comparison', () => {
    const { opening, session } = advance(hike)
    expect(session.previousObservation).toEqual(opening.observation)
  })

  it('has nothing to show at the opening meeting', () => {
    const opening = startRun(config)
    expect(opening.onTheDay).toBeNull()
    expect(opening.previousObservation).toBeNull()
  })

  it('does not disturb the run it was taken from', () => {
    // Restating the snapshot must be inert: same decisions, same trajectory.
    const first = advance(hike).session
    const second = advance(hike).session
    expect(second.state.latent).toEqual(first.state.latent)
    expect(second.observation).toEqual(first.observation)
  })

  it('shows a hold moving the rate not at all', () => {
    const { opening, session } = advance(hold)
    expect(session.onTheDay!.indicators.policy_rate!.value).toBe(
      opening.observation.indicators.policy_rate!.value,
    )
  })
})
