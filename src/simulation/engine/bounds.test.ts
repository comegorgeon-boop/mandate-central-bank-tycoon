// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { DiagnosticEvent, Institution } from '../types/core.ts'
import type { PolicyAction, PolicyPackage } from '../types/policy.ts'
import type { Prng } from '../rng/prng.ts'
import { createPrng } from '../rng/prng.ts'
import {
  LATENT_BOUNDS,
  clampLatentState,
  isWithinBounds,
} from '../config/bounds.ts'
import {
  POLICY_RATE_FLOOR,
  availableInstruments,
  getInstrumentRange,
} from '../config/instruments.ts'
import { createInitialState } from '../engine/initialState.ts'
import { startRun, submitMeeting } from '../replay/replayRun.ts'
import { testConfig } from '../testing/harness.ts'

/**
 * Computational safety.
 *
 * Every latent variable has documented bounds far outside any plausible
 * economy. They exist to stop the integrator producing NaN, not to shape
 * gameplay. When one bites it must be recorded, never silently absorbed.
 */

/** A random but always-valid policy package, to stress the engine hard. */
function randomPackage(
  prng: Prng,
  institution: Institution,
  difficulty: 'easy' | 'medium' | 'hard',
  currentTargetRate: number,
): PolicyPackage {
  const actions: PolicyAction[] = []

  for (const instrument of availableInstruments(institution, difficulty)) {
    if (!prng.bernoulli(0.45)) continue

    const range = getInstrumentRange(instrument, difficulty)
    const steps = Math.floor((range.max - range.min) / range.increment)
    let magnitude = range.min + prng.nextInt(steps + 1) * range.increment
    // Round away accumulated floating-point drift on fractional increments.
    magnitude = Math.round(magnitude / range.increment) * range.increment

    if (instrument.id === 'policy_rate') {
      const floor = POLICY_RATE_FLOOR[institution]
      const lowest = Math.ceil(((floor - currentTargetRate) * 100) / 25) * 25
      if (magnitude < lowest) magnitude = Math.max(range.min, lowest)
      if (currentTargetRate + magnitude / 100 < floor) continue
    }

    actions.push({ instrument: instrument.id, magnitude })
  }

  return { actions, communication: null }
}

describe('latent variables stay inside their documented bounds', () => {
  const institutions: Institution[] = ['fed', 'ecb']

  for (const institution of institutions) {
    it(`holds across many seeded ${institution} runs under random policy`, () => {
      let meetingsChecked = 0

      for (let seedIndex = 0; seedIndex < 12; seedIndex += 1) {
        const config = testConfig(institution, 'hard', `stress-${seedIndex}`)
        const prng = createPrng(`policy-${institution}-${seedIndex}`)
        let session = startRun(config)

        while (session.outcome.status === 'active') {
          const pkg = randomPackage(
            prng,
            institution,
            'hard',
            session.state.stance.targetRate,
          )
          const result = submitMeeting(session, pkg)
          expect(result.ok).toBe(true)
          if (!result.ok) return
          session = result.session
        }

        for (const snapshot of session.state.history) {
          for (const [key, value] of Object.entries(snapshot.latent)) {
            expect(Number.isFinite(value)).toBe(true)
            const [min, max] = LATENT_BOUNDS[key as keyof typeof LATENT_BOUNDS]
            expect(value).toBeGreaterThanOrEqual(min)
            expect(value).toBeLessThanOrEqual(max)
          }
          meetingsChecked += 1
        }
      }

      expect(meetingsChecked).toBeGreaterThan(100)
    })
  }

  it('holds when the economy is left completely unattended', () => {
    for (let seedIndex = 0; seedIndex < 12; seedIndex += 1) {
      const config = testConfig('ecb', 'hard', `neglect-${seedIndex}`)
      let session = startRun(config)
      while (session.outcome.status === 'active') {
        const result = submitMeeting(session, { actions: [], communication: null })
        expect(result.ok).toBe(true)
        if (!result.ok) return
        session = result.session
      }
      for (const snapshot of session.state.history) {
        expect(isWithinBounds(snapshot.latent)).toBe(true)
      }
    }
  })
})

describe('clamping records instability instead of hiding it', () => {
  const state = createInitialState(testConfig('fed', 'medium', 'clamp'))

  it('records a diagnostic when a value is pushed past a bound', () => {
    const diagnostics: DiagnosticEvent[] = []
    const clamped = clampLatentState(
      { ...state.latent, inflationHeadline: 9999 },
      42,
      diagnostics,
    )

    expect(clamped.inflationHeadline).toBe(LATENT_BOUNDS.inflationHeadline[1])
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0]).toMatchObject({
      step: 42,
      variable: 'inflationHeadline',
      rawValue: 9999,
      kind: 'max',
    })
  })

  it('records non-finite values distinctly', () => {
    const diagnostics: DiagnosticEvent[] = []
    const clamped = clampLatentState(
      { ...state.latent, outputGap: Number.NaN, unemployment: Number.POSITIVE_INFINITY },
      7,
      diagnostics,
    )

    expect(Number.isFinite(clamped.outputGap)).toBe(true)
    expect(Number.isFinite(clamped.unemployment)).toBe(true)
    expect(diagnostics.map((entry) => entry.kind)).toEqual([
      'non_finite',
      'non_finite',
    ])
  })

  it('leaves a healthy state untouched and allocates nothing', () => {
    const diagnostics: DiagnosticEvent[] = []
    const result = clampLatentState(state.latent, 0, diagnostics)
    expect(result).toBe(state.latent)
    expect(diagnostics).toHaveLength(0)
  })

  it('covers every latent field with a bound', () => {
    for (const key of Object.keys(state.latent)) {
      expect(LATENT_BOUNDS).toHaveProperty(key)
    }
    for (const [key, [min, max]] of Object.entries(LATENT_BOUNDS)) {
      expect(min).toBeLessThan(max)
      expect(state.latent).toHaveProperty(key)
    }
  })
})
