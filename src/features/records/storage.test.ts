// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  SIMULATION_VERSION,
  createRunConfig,
  replayRun,
  startRun,
  submitMeeting,
  type DecisionLog,
  type PolicyPackage,
} from '../../simulation/index.ts'
import {
  bestByBucket,
  clearRecords,
  clearSave,
  loadSave,
  readRecords,
  recordResult,
  saveRun,
} from './storage.ts'

/**
 * Saves, and the one property that makes them worth having.
 *
 * A save here is the **decision log** and nothing else — the configuration and
 * the ordered packages confirmed in the mandate — because the engine is
 * deterministic and replaying a log reproduces the run exactly. That is a
 * strong claim and it is the whole design, so it is the thing this file
 * checks: a mandate played forward and the same mandate replayed from its
 * saved log must be the *same world*, not merely the same meeting number.
 *
 * The rest is about refusing rather than guessing. A save written by another
 * engine version is discarded instead of resumed into a model that has
 * changed under the first half of the run, and every read is allowed to fail
 * because a private window, a blocked storage setting and a full quota all
 * throw rather than returning null.
 */

const PACKAGE: PolicyPackage = {
  actions: [{ instrument: 'policy_rate', magnitude: 25 }],
  communication: null,
}

function play(meetings: number): { log: DecisionLog; inflation: number; rate: number } {
  const config = createRunConfig({
    institution: 'fed',
    difficulty: 'medium',
    seed: 'SAVE-ROUNDTRIP',
    simulationVersion: SIMULATION_VERSION,
  })
  let session = startRun(config)
  for (let index = 0; index < meetings; index += 1) {
    const result = submitMeeting(session, PACKAGE)
    if (!result.ok) break
    session = result.session
  }
  return {
    log: {
      simulationVersion: SIMULATION_VERSION,
      institution: config.institution,
      difficulty: config.difficulty,
      mode: config.mode,
      scenario: config.scenario,
      seed: config.seed,
      decisions: session.decisions,
    },
    inflation: session.state.latent.inflationHeadline,
    rate: session.state.latent.policyRate,
  }
}

describe('a saved mandate resumes into the same world', () => {
  beforeEach(() => {
    clearSave()
    clearRecords()
  })

  it('round-trips through storage', () => {
    const { log } = play(4)
    saveRun(log)
    const loaded = loadSave()
    expect(loaded, 'the save did not come back').not.toBeNull()
    expect(loaded?.log.decisions).toHaveLength(4)
    expect(loaded?.log.seed).toBe('SAVE-ROUNDTRIP')
    expect(loaded?.save.meetingsServed).toBe(4)
  })

  it('reproduces the economy exactly, not just the meeting number', () => {
    // The claim the whole format rests on. A save that got the meeting index
    // right and the latent state wrong would resume a player into a mandate
    // whose own history had not happened.
    const played = play(6)
    saveRun(played.log)
    const loaded = loadSave()
    const replayed = replayRun(loaded!.log)
    expect(replayed.session.state.meetingIndex).toBe(6)
    expect(replayed.session.state.latent.inflationHeadline).toBe(played.inflation)
    expect(replayed.session.state.latent.policyRate).toBe(played.rate)
  })

  it('refuses a save from another engine version rather than reinterpreting it', () => {
    const { log } = play(2)
    saveRun({ ...log, simulationVersion: '0.0.0-not-this-one' })
    expect(loadSave()).toBeNull()
    // And it clears it, so the offer to resume does not come back every visit.
    expect(loadSave()).toBeNull()
  })

  it('survives a storage that refuses to read', () => {
    const original = globalThis.localStorage.getItem
    try {
      globalThis.localStorage.getItem = () => {
        throw new Error('blocked')
      }
      expect(loadSave()).toBeNull()
      expect(readRecords()).toEqual([])
    } finally {
      globalThis.localStorage.getItem = original
    }
  })
})

describe('records are grouped, never ranked across groups', () => {
  beforeEach(() => {
    clearRecords()
  })

  const entry = (
    score: number,
    overrides: Partial<Parameters<typeof recordResult>[0]> = {},
  ): Parameters<typeof recordResult>[0] => ({
    score,
    outcome: 'mandate_completed',
    outcomeLabel: 'Mandate completed',
    meetingsServed: 16,
    meetingCount: 16,
    seed: `seed-${score}`,
    institution: 'fed',
    difficulty: 'medium',
    scenario: null,
    ...overrides,
  })

  it('keeps a mandate and reads it back', () => {
    recordResult(entry(4200))
    const records = readRecords()
    expect(records).toHaveLength(1)
    expect(records[0].score).toBe(4200)
    expect(records[0].bucket).toContain('fed')
  })

  it('puts different mandates in different buckets', () => {
    // An easy Fed tutorial and 1929-33 are not two attempts at one problem,
    // and a single ranked list would say they were.
    recordResult(entry(4200))
    recordResult(entry(9000, { difficulty: 'easy' }))
    recordResult(entry(1500, { scenario: 'great_contraction_1929', difficulty: 'hard' }))
    const buckets = new Set(readRecords().map((row) => row.bucket))
    expect(buckets.size).toBe(3)
    // And the best-per-bucket view keeps all three rather than the top score.
    expect(bestByBucket().size).toBe(3)
  })

  it('keeps only the best few of a bucket', () => {
    for (let index = 0; index < 9; index += 1) recordResult(entry(1000 + index * 100))
    const kept = readRecords()
    expect(kept.length).toBeLessThanOrEqual(5)
    // The best survives; the worst does not.
    expect(Math.max(...kept.map((row) => row.score))).toBe(1800)
    expect(kept.some((row) => row.score === 1000)).toBe(false)
  })

  it('reports the best of each bucket', () => {
    recordResult(entry(2000))
    recordResult(entry(6500))
    recordResult(entry(3000, { difficulty: 'hard' }))
    const best = bestByBucket()
    expect([...best.values()].map((row) => row.score).sort((a, b) => a - b)).toEqual([
      3000, 6500,
    ])
  })
})
