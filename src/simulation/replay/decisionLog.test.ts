// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { DecisionLog } from './decisionLog.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { MEETING_COUNT } from '../config/time.ts'
import {
  configFromLog,
  decodeDecisionLog,
  encodeChallenge,
  encodeDecisionLog,
} from './decisionLog.ts'
import { testConfig } from '../testing/harness.ts'

/**
 * The decision log is untrusted input.
 *
 * It may have been hand-edited, truncated, produced by another engine
 * version, or simply corrupted. Every field is validated before use, and a
 * bad log is rejected with a readable reason rather than throwing or, worse,
 * being partially trusted.
 */

const SAMPLE: DecisionLog = {
  simulationVersion: SIMULATION_VERSION,
  institution: 'ecb',
  difficulty: 'medium',
  mode: 'fictional',
  seed: 'sample-seed',
  decisions: [
    {
      meetingIndex: 0,
      package: {
        actions: [{ instrument: 'policy_rate', magnitude: 25 }],
        communication: {
          tone: 'hawkish',
          emphasis: 'inflation',
          commitment: 'conditional_path',
          channel: 'press_conference',
        },
      },
    },
    {
      meetingIndex: 1,
      package: { actions: [], communication: null },
    },
    {
      meetingIndex: 3,
      package: {
        actions: [
          { instrument: 'asset_purchases', magnitude: 2.5 },
          { instrument: 'targeted_refinancing', magnitude: 1.5 },
        ],
        communication: null,
      },
    },
  ],
}

describe('round trip', () => {
  it('decodes back to exactly what was encoded', () => {
    const decoded = decodeDecisionLog(encodeDecisionLog(SAMPLE))
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) return
    expect(decoded.log).toEqual(SAMPLE)
  })

  it('preserves a skipped meeting rather than shifting the ones after it', () => {
    const decoded = decodeDecisionLog(encodeDecisionLog(SAMPLE))
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) return
    expect(decoded.log.decisions.map((d) => d.meetingIndex)).toEqual([0, 1, 3])
  })

  it('survives a seed containing separator characters', () => {
    const awkward: DecisionLog = { ...SAMPLE, seed: 'a~b|c;d!e.f %20' }
    const decoded = decodeDecisionLog(encodeDecisionLog(awkward))
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) return
    expect(decoded.log.seed).toBe('a~b|c;d!e.f %20')
  })

  it('stays compact', () => {
    expect(encodeDecisionLog(SAMPLE).length).toBeLessThan(160)
  })

  it('rebuilds the run configuration, including the mandate length', () => {
    const config = configFromLog(SAMPLE)
    expect(config.institution).toBe('ecb')
    expect(config.difficulty).toBe('medium')
    expect(config.seed).toBe('sample-seed')
    expect(config.meetingCount).toBe(MEETING_COUNT.medium)
  })
})

describe('malformed input is rejected safely', () => {
  const cases: readonly [string, unknown][] = [
    ['a number', 42],
    ['null', null],
    ['undefined', undefined],
    ['an object', { simulationVersion: '1.0.0' }],
    ['an empty string', ''],
    ['random text', 'not a decision log at all'],
    ['too few fields', 'MCBT1~1.0.0~fed~easy'],
    ['an unknown format tag', 'MCBT9~1.0.0~fed~easy~fictional~seed~'],
    ['an unknown institution', 'MCBT1~1.0.0~bundesbank~easy~fictional~seed~'],
    ['an unknown difficulty', 'MCBT1~1.0.0~fed~impossible~fictional~seed~'],
    ['an unknown mode', 'MCBT1~1.0.0~fed~easy~time_travel~seed~'],
    ['an empty seed', 'MCBT1~1.0.0~fed~easy~fictional~~'],
    ['a missing version', 'MCBT1~~fed~easy~fictional~seed~'],
    ['an unknown instrument code', 'MCBT1~1.0.0~fed~easy~fictional~seed~zz=5'],
    ['a non-numeric magnitude', 'MCBT1~1.0.0~fed~easy~fictional~seed~pr=abc'],
    ['an infinite magnitude', 'MCBT1~1.0.0~fed~easy~fictional~seed~pr=Infinity'],
    ['a malformed action', 'MCBT1~1.0.0~fed~easy~fictional~seed~pr'],
    ['a malformed communication block', 'MCBT1~1.0.0~fed~easy~fictional~seed~!1.2'],
    ['an out-of-range communication index', 'MCBT1~1.0.0~fed~easy~fictional~seed~!9.0.0.0'],
  ]

  for (const [label, input] of cases) {
    it(`rejects ${label}`, () => {
      const result = decodeDecisionLog(input)
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.length).toBeGreaterThan(0)
    })
  }

  it('rejects a seed that is not valid percent-encoded text', () => {
    const result = decodeDecisionLog('MCBT1~1.0.0~fed~easy~fictional~%E0%A4%A~')
    expect(result.ok).toBe(false)
  })

  it('rejects a log with more meetings than the mandate allows', () => {
    const slots = new Array(MEETING_COUNT.easy + 4).fill('').join('|')
    const result = decodeDecisionLog(`MCBT1~1.0.0~fed~easy~fictional~seed~${slots}`)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('more than')
  })

  it('rejects an implausibly large payload without parsing it', () => {
    const result = decodeDecisionLog(`MCBT1~1.0.0~fed~easy~fictional~seed~${'x'.repeat(30000)}`)
    expect(result.ok).toBe(false)
  })

  it('never throws, whatever it is handed', () => {
    for (const [, input] of cases) {
      expect(() => decodeDecisionLog(input)).not.toThrow()
    }
  })
})

describe('challenge codes', () => {
  const config = testConfig('fed', 'hard', 'challenge-seed')
  const code = encodeChallenge(config)

  it('carries the run setup and decodes cleanly', () => {
    const decoded = decodeDecisionLog(code)
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) return
    expect(decoded.log.institution).toBe('fed')
    expect(decoded.log.difficulty).toBe('hard')
    expect(decoded.log.seed).toBe('challenge-seed')
    expect(decoded.log.simulationVersion).toBe(SIMULATION_VERSION)
  })

  it('carries no decisions', () => {
    const decoded = decodeDecisionLog(code)
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) return
    expect(decoded.log.decisions).toEqual([])
  })

  it('carries nothing personal: no nickname, no score, no dates', () => {
    // The whole code is short enough to assert on directly.
    expect(code).toBe(`MCBT1~${SIMULATION_VERSION}~fed~hard~fictional~challenge-seed~`)
  })
})
