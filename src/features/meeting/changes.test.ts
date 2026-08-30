// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  SIMULATION_VERSION,
  createRunConfig,
  startRun,
  submitMeeting,
  type PolicyPackage,
  type RunSession,
} from '../../simulation/index.ts'
import { MIN_CHANGES, MAX_CHANGES, buildChanges } from './changes.ts'

/**
 * The no-dead-turn rule.
 *
 * A meeting where nothing visibly changed is a wasted turn, and two in a row
 * are enough to lose a player. These tests play real mandates and assert the
 * guarantee at every single meeting of every one of them, because the rule is
 * only worth anything if it holds on the quiet meetings — which are exactly
 * the ones that are hard to construct by hand.
 */

const HOLD: PolicyPackage = { actions: [], communication: null }
const HIKE: PolicyPackage = {
  actions: [{ instrument: 'policy_rate', magnitude: 25 }],
  communication: null,
}

function play(seed: string, choose: (session: RunSession) => PolicyPackage): RunSession[] {
  const config = createRunConfig({
    institution: 'fed',
    difficulty: 'easy',
    seed,
    simulationVersion: SIMULATION_VERSION,
  })

  let session = startRun(config)
  const visited: RunSession[] = [session]

  while (session.outcome.status === 'active') {
    const result = submitMeeting(session, choose(session))
    if (!result.ok) break
    session = result.session
    visited.push(session)
  }

  return visited
}

/** Holding every meeting is the hardest case: the least happens. */
const passiveRuns = ['quiet-1', 'quiet-2', 'quiet-3', 'quiet-4', 'quiet-5'].map((seed) =>
  play(seed, () => HOLD),
)

describe('no meeting is informationally empty', () => {
  it('always has at least three entries, even holding through a whole mandate', () => {
    for (const run of passiveRuns) {
      for (const session of run) {
        const changes = buildChanges(
          session.observation,
          session.previousObservation,
          'fed',
        )
        expect(changes.length).toBeGreaterThanOrEqual(MIN_CHANGES)
        expect(changes.length).toBeLessThanOrEqual(MAX_CHANGES)
      }
    }
  })

  it('always traces one entry back to the player’s own last decision', () => {
    for (const run of passiveRuns) {
      for (const session of run.slice(1)) {
        const changes = buildChanges(
          session.observation,
          session.previousObservation,
          'fed',
        )
        expect(changes.some((item) => item.source === 'decision')).toBe(true)
      }
    }
  })

  it('leads with the decision entry rather than burying it', () => {
    for (const run of passiveRuns) {
      for (const session of run.slice(1)) {
        const changes = buildChanges(
          session.observation,
          session.previousObservation,
          'fed',
        )
        expect(changes[0].source).toBe('decision')
      }
    }
  })

  it('holds the guarantee when the player is moving the rate every meeting', () => {
    for (const seed of ['busy-1', 'busy-2', 'busy-3']) {
      for (const session of play(seed, () => HIKE).slice(1)) {
        const changes = buildChanges(
          session.observation,
          session.previousObservation,
          'fed',
        )
        expect(changes.length).toBeGreaterThanOrEqual(MIN_CHANGES)
        expect(changes.some((item) => item.source === 'decision')).toBe(true)
      }
    }
  })

  it('describes the opening position at the first meeting, where nothing has moved', () => {
    const opening = buildChanges(passiveRuns[0][0].observation, null, 'fed')
    expect(opening.length).toBeGreaterThanOrEqual(MIN_CHANGES)
    expect(opening[0].headline).toBe('Your mandate opens here')
  })

  it('gives every entry a headline and a detail, never a bare label', () => {
    for (const run of passiveRuns) {
      for (const session of run) {
        for (const item of buildChanges(
          session.observation,
          session.previousObservation,
          'fed',
        )) {
          expect(item.headline.length).toBeGreaterThan(0)
          expect(item.detail.length).toBeGreaterThan(0)
        }
      }
    }
  })
})

describe('the decision entry reports what the decision actually did', () => {
  it('says a hold is not a neutral act', () => {
    const run = passiveRuns[0]
    const later = run[3]
    const changes = buildChanges(later.observation, later.previousObservation, 'fed')
    expect(changes[0].detail).toContain('A hold is not a neutral act')
  })

  it('is a pure function of the two observations it is given', () => {
    const session = passiveRuns[0][4]
    const once = buildChanges(session.observation, session.previousObservation, 'fed')
    const twice = buildChanges(session.observation, session.previousObservation, 'fed')
    expect(twice).toEqual(once)
  })
})
