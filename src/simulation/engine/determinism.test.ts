// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { PolicyPackage } from '../types/policy.ts'
import type { RunConfig } from '../types/core.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { calculateScore } from '../scoring/calculateScore.ts'
import { decodeDecisionLog, encodeDecisionLog } from '../replay/decisionLog.ts'
import { replayRun, startRun, submitMeeting } from '../replay/replayRun.ts'
import type { RunSession } from '../replay/replayRun.ts'
import { testConfig } from '../testing/harness.ts'

/**
 * Reproducibility.
 *
 * A run is defined by its simulation version, seed, institution, difficulty
 * and ordered decisions, and by nothing else. These tests hold that line from
 * both directions: the same inputs must give a bit-identical run, and
 * different seeds must give genuinely different economies rather than the
 * same path with cosmetic noise on top.
 */

/** A fixed, slightly varied decision script. Events stay on throughout. */
function scriptedPackage(meeting: number): PolicyPackage {
  const moves = [0, 25, 25, 0, -25, 0, 50, 25, 0, -25, -25, 0]
  const move = moves[meeting % moves.length]
  return {
    actions: move === 0 ? [] : [{ instrument: 'policy_rate', magnitude: move }],
    communication: {
      tone: move > 0 ? 'hawkish' : move < 0 ? 'dovish' : 'neutral',
      emphasis: 'data_dependence',
      commitment: 'weak_bias',
      channel: 'statement',
    },
  }
}

function playScript(config: RunConfig): RunSession {
  let session = startRun(config)
  while (session.outcome.status === 'active') {
    const result = submitMeeting(session, scriptedPackage(session.state.meetingIndex))
    if (!result.ok) throw new Error('scripted package was rejected')
    session = result.session
  }
  return session
}

describe('identical inputs give an identical run', () => {
  const config = testConfig('fed', 'medium', 'determinism-seed')

  it('reproduces the whole simulation state', () => {
    expect(playScript(config).state).toEqual(playScript(config).state)
  })

  it('reproduces the score exactly', () => {
    const first = playScript(config)
    const second = playScript(config)
    expect(calculateScore(first.state, first.outcome)).toEqual(
      calculateScore(second.state, second.outcome),
    )
  })

  it('reproduces the events that fired, in order', () => {
    const first = playScript(config).state.eventLog.map((e) => e.eventId)
    const second = playScript(config).state.eventLog.map((e) => e.eventId)
    expect(first).toEqual(second)
    expect(first.length).toBeGreaterThan(0)
  })

  it('reproduces the published observations', () => {
    expect(playScript(config).observation).toEqual(playScript(config).observation)
  })

  it('holds for the ECB and for every difficulty', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const ecb = testConfig('ecb', difficulty, `ecb-${difficulty}`)
      expect(playScript(ecb).state.latent).toEqual(playScript(ecb).state.latent)
    }
  })
})

describe('replay from a decision log', () => {
  const config = testConfig('ecb', 'medium', 'replay-seed')

  it('reproduces the run exactly through an encode and decode round trip', () => {
    const original = playScript(config)

    const encoded = encodeDecisionLog({
      simulationVersion: config.simulationVersion,
      institution: config.institution,
      difficulty: config.difficulty,
      mode: config.mode,
      seed: config.seed,
      decisions: original.decisions,
    })

    const decoded = decodeDecisionLog(encoded)
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) return

    const replayed = replayRun(decoded.log)
    expect(replayed.ok).toBe(true)
    if (!replayed.ok) return

    expect(replayed.session.state).toEqual(original.state)
    expect(replayed.session.decisions).toEqual(original.decisions)
  })
})

describe('different seeds give different economies', () => {
  const seeds = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot']
  const runs = seeds.map((seed) => playScript(testConfig('fed', 'medium', seed)))

  it('produces different inflation paths', () => {
    for (let i = 0; i < runs.length; i += 1) {
      for (let j = i + 1; j < runs.length; j += 1) {
        const a = runs[i].state.history.map((s) => s.latent.inflationHeadline)
        const b = runs[j].state.history.map((s) => s.latent.inflationHeadline)
        const length = Math.min(a.length, b.length)

        let squared = 0
        for (let k = 0; k < length; k += 1) squared += (a[k] - b[k]) ** 2
        const rms = Math.sqrt(squared / length)

        // Not merely different in the last decimal: a different economy.
        expect(rms).toBeGreaterThan(0.25)
      }
    }
  })

  it('produces different scores', () => {
    const scores = runs.map((run) => calculateScore(run.state, run.outcome).score)
    expect(new Set(scores).size).toBe(scores.length)
  })

  it('produces different opening conditions, not just different shocks', () => {
    const openings = runs.map((run) => run.state.history[0].latent.outputGap)
    expect(new Set(openings).size).toBe(openings.length)
  })
})

describe('the run depends on the decisions', () => {
  const config = testConfig('fed', 'medium', 'decision-sensitivity')

  it('diverges when a single decision changes', () => {
    const baseline = playScript(config)

    let session = startRun(config)
    let meeting = 0
    while (session.outcome.status === 'active') {
      // One 25bp difference at the third meeting, everything else identical.
      const pkg =
        meeting === 2
          ? { ...scriptedPackage(meeting), actions: [] }
          : scriptedPackage(meeting)
      const result = submitMeeting(session, pkg)
      if (!result.ok) throw new Error('package rejected')
      session = result.session
      meeting += 1
    }

    expect(session.state.latent).not.toEqual(baseline.state.latent)
  })
})

describe('the simulation version is part of a run identity', () => {
  it('separates runs recorded under different engine versions', () => {
    const current = testConfig('fed', 'easy', 'version-seed')
    const older: RunConfig = { ...current, simulationVersion: '0.9.0' }

    const a = calculateScore(playScript(current).state, playScript(current).outcome)
    const b = calculateScore(playScript(older).state, playScript(older).outcome)

    expect(a.simulationVersion).toBe(SIMULATION_VERSION)
    expect(a.bucketKey).not.toBe(b.bucketKey)
  })
})
