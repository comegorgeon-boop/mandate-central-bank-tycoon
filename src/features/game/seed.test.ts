import { describe, expect, it } from 'vitest'
import { MAX_SEED_LENGTH, makeRunId, randomSeed, sanitizeSeed } from './seed.ts'

describe('sanitizeSeed', () => {
  it('folds case so the same economy is reached either way', () => {
    expect(sanitizeSeed('abc')).toBe('ABC')
  })

  it('strips anything that is not a plain identifier character', () => {
    expect(sanitizeSeed('a<script>b')).toBe('ASCRIPTB')
    expect(sanitizeSeed('  spaced out  ')).toBe('SPACEDOUT')
    expect(sanitizeSeed('keep-dashes')).toBe('KEEP-DASHES')
  })

  it('caps the length', () => {
    expect(sanitizeSeed('X'.repeat(200))).toHaveLength(MAX_SEED_LENGTH)
  })

  it('can return an empty seed, which the setup screen rejects', () => {
    expect(sanitizeSeed('!!!')).toBe('')
  })
})

describe('randomSeed', () => {
  it('produces a seed that survives sanitising unchanged', () => {
    for (let i = 0; i < 50; i += 1) {
      const seed = randomSeed()
      expect(sanitizeSeed(seed)).toBe(seed)
    }
  })
})

describe('makeRunId', () => {
  it('carries the seed and stays URL-safe', () => {
    expect(makeRunId('TEST')).toMatch(/^TEST-[A-Z0-9]+$/)
  })

  it('falls back to a placeholder when the seed sanitises away', () => {
    expect(makeRunId('!!!')).toMatch(/^RUN-[A-Z0-9]+$/)
  })
})
