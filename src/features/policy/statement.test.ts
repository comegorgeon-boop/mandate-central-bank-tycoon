import { describe, expect, it } from 'vitest'
import {
  COMMITMENT_OPTIONS,
  PATH_OPTIONS,
  buildStatement,
  deriveTone,
} from './statement.ts'

/**
 * The register rule for the easy-mode desk: the player chooses sentences, not
 * parameters. The number is a footnote on the option, never the option
 * itself — and the tone is derived from what the package does, not chosen.
 */

describe('the options speak plain language', () => {
  it('keeps numbers and jargon out of the labels the player picks', () => {
    for (const option of [...PATH_OPTIONS, ...COMMITMENT_OPTIONS]) {
      expect(option.label, option.label).not.toMatch(/\d/)
      expect(option.label, option.label).not.toMatch(/\bbp\b|basis|guidance|hawkish|dovish/i)
    }
  })

  it('offers both directions and a genuine stop', () => {
    const signals = PATH_OPTIONS.map((option) => option.signal)
    expect(Math.min(...signals)).toBeLessThan(0)
    expect(Math.max(...signals)).toBeGreaterThan(0)
    expect(signals).toContain(0)
  })
})

describe('the tone is derived from the package, not chosen', () => {
  it('reads the announced path first', () => {
    expect(deriveTone(25, 100, 'conditional_path')).toBe('hawkish')
    expect(deriveTone(25, -50, 'conditional_path')).toBe('dovish')
    expect(deriveTone(-25, 50, 'weak_bias')).toBe('hawkish')
  })

  it('falls back to the decision when nothing is announced', () => {
    expect(deriveTone(50, 0, 'conditional_path')).toBe('hawkish')
    expect(deriveTone(-50, 0, 'weak_bias')).toBe('dovish')
    expect(deriveTone(0, 0, 'conditional_path')).toBe('neutral')
  })

  it('ignores a path that a mere remark never records', () => {
    expect(deriveTone(-25, 100, 'none')).toBe('dovish')
    expect(deriveTone(0, 100, 'none')).toBe('neutral')
  })
})

describe('the statement says what the package does', () => {
  it('announces the raise, the path and the commitment', () => {
    const statement = buildStatement(25, 75, 'conditional_path')
    expect(statement).toContain('raised the policy rate by 25 bp')
    expect(statement).toContain('about 75 bp higher over the coming year')
    expect(statement).toContain('commits to this path')
  })

  it('makes stopping a sentence of its own', () => {
    const going = buildStatement(25, 75, 'conditional_path')
    const stopping = buildStatement(25, 0, 'conditional_path')
    expect(stopping).toContain('hold the rate near this level')
    expect(stopping).not.toBe(going)
  })

  it('marks a leaning as revisable and a remark as unrecorded', () => {
    expect(buildStatement(0, 50, 'weak_bias')).toContain('a leaning, not a commitment')
    expect(buildStatement(0, 50, 'none')).toContain('general remarks')
    expect(buildStatement(0, 50, 'none')).not.toContain('coming year')
  })
})
