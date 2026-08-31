// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { SIMULATION_VERSION } from '../version.ts'
import { createInitialState, createRunConfig } from '../engine/initialState.ts'
import { advanceTrueState } from '../engine/advanceTrueState.ts'
import { applyPolicyPackage } from '../engine/applyPolicyPackage.ts'
import { EVENTS_BY_ID } from './catalog.ts'
import { resolveEvent } from './resolveEvent.ts'

/**
 * The easy-mode opener: a major event guaranteed at meeting 1.
 *
 * The healthy baseline it is applied on top of is covered separately in
 * `engine/initialState.test.ts`.
 */

function easyConfig(seed: string, institution: 'fed' | 'ecb' = 'fed') {
  return createRunConfig({
    institution,
    difficulty: 'easy',
    seed,
    simulationVersion: SIMULATION_VERSION,
  })
}

describe('the easy-mode opener', () => {
  it('fires exactly once, recorded at meeting 0, from the major tier', () => {
    const state = createInitialState(easyConfig('opener-basic'))
    expect(state.eventLog).toHaveLength(1)
    const record = state.eventLog[0]
    expect(record.meetingIndex).toBe(0)
    expect(record.title.length).toBeGreaterThan(0)
    expect(record.newswire.length).toBeGreaterThan(0)
    expect(EVENTS_BY_ID.get(record.eventId)?.tier).toBe('major')
  })

  it('does not fire on medium or hard', () => {
    for (const difficulty of ['medium', 'hard'] as const) {
      const config = createRunConfig({
        institution: 'fed',
        difficulty,
        seed: 'opener-scope',
        simulationVersion: SIMULATION_VERSION,
      })
      expect(createInitialState(config).eventLog).toHaveLength(0)
    }
  })

  it('is skipped when openingEvent: false is requested', () => {
    const state = createInitialState(easyConfig('opener-optout'), { openingEvent: false })
    expect(state.eventLog).toHaveLength(0)
  })

  it('restates the meeting-0 history snapshot to the post-crisis economy', () => {
    const withCrisis = createInitialState(easyConfig('opener-history'))
    const without = createInitialState(easyConfig('opener-history'), { openingEvent: false })
    expect(withCrisis.history).toHaveLength(1)
    expect(withCrisis.history[0].latent).toEqual(withCrisis.latent)
    expect(withCrisis.history[0].latent).not.toEqual(without.history[0].latent)
  })

  it('is deterministic: the same seed always draws the same event with the same effects', () => {
    const a = createInitialState(easyConfig('opener-determinism'))
    const b = createInitialState(easyConfig('opener-determinism'))
    expect(a.eventLog).toEqual(b.eventLog)
    expect(a.latent).toEqual(b.latent)
    expect(a.pendingEffects).toEqual(b.pendingEffects)
  })

  it('does not consume from the run RNG stream: later draws are unaffected by whether it fired', () => {
    const withCrisis = createInitialState(easyConfig('opener-rng'))
    const without = createInitialState(easyConfig('opener-rng'), { openingEvent: false })
    expect(withCrisis.rng).toEqual(without.rng)
  })

  it('varies which major fires across seeds', () => {
    const ids = new Set<string>()
    for (let index = 0; index < 30; index += 1) {
      const state = createInitialState(easyConfig(`opener-variety-${index}`))
      ids.add(state.eventLog[0]?.eventId ?? '')
    }
    expect(ids.size).toBeGreaterThan(1)
  })

  it('cannot fire again later in the same mandate (maxOccurrences respected)', () => {
    let state = createInitialState(easyConfig('opener-no-repeat'))
    const openerId = state.eventLog[0]?.eventId
    expect(openerId).toBeDefined()

    for (let meeting = 0; meeting < state.config.meetingCount; meeting += 1) {
      const applied = applyPolicyPackage(state, { actions: [], communication: null })
      if (!applied.ok) throw new Error('hold was rejected')
      const resolution = resolveEvent(applied.state)
      state = advanceTrueState(resolution.state)
    }

    const occurrences = state.eventLog.filter((record) => record.eventId === openerId)
    expect(occurrences).toHaveLength(1)
  })
})
