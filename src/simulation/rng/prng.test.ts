// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createPrng, hashGaussian, hashSeed, hashUnit, restorePrng } from './prng.ts'

describe('createPrng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createPrng('seed-alpha')
    const b = createPrng('seed-alpha')
    const first = Array.from({ length: 100 }, () => a.next())
    const second = Array.from({ length: 100 }, () => b.next())
    expect(first).toEqual(second)
  })

  it('produces different sequences for different seeds', () => {
    const alpha = createPrng('seed-alpha')
    const beta = createPrng('seed-beta')
    const alphaValues = Array.from({ length: 50 }, () => alpha.next())
    const betaValues = Array.from({ length: 50 }, () => beta.next())
    expect(alphaValues).not.toEqual(betaValues)
  })

  it('keeps every draw inside [0, 1)', () => {
    const prng = createPrng('range-check')
    for (let i = 0; i < 20000; i += 1) {
      const value = prng.next()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('is close to uniform over 100k draws', () => {
    const prng = createPrng('uniformity')
    const buckets = new Array<number>(10).fill(0)
    let total = 0
    const draws = 100000

    for (let i = 0; i < draws; i += 1) {
      const value = prng.next()
      total += value
      buckets[Math.floor(value * 10)] += 1
    }

    expect(total / draws).toBeCloseTo(0.5, 2)
    // Each decile should hold roughly a tenth of the draws.
    for (const count of buckets) {
      expect(count).toBeGreaterThan(draws / 10 - draws / 200)
      expect(count).toBeLessThan(draws / 10 + draws / 200)
    }
  })

  it('draws normals with the requested mean and standard deviation', () => {
    const prng = createPrng('gaussian')
    const draws = 50000
    const values = Array.from({ length: draws }, () => prng.gaussian(2, 3))

    const mean = values.reduce((sum, value) => sum + value, 0) / draws
    const variance =
      values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / draws

    expect(mean).toBeCloseTo(2, 1)
    expect(Math.sqrt(variance)).toBeCloseTo(3, 1)
  })

  it('draws weighted indices in proportion to their weights', () => {
    const prng = createPrng('weighted')
    const weights = [1, 3, 0, 6]
    const counts = [0, 0, 0, 0]

    for (let i = 0; i < 40000; i += 1) counts[prng.weightedIndex(weights)] += 1

    expect(counts[2]).toBe(0)
    expect(counts[0] / 40000).toBeCloseTo(0.1, 1)
    expect(counts[1] / 40000).toBeCloseTo(0.3, 1)
    expect(counts[3] / 40000).toBeCloseTo(0.6, 1)
  })

  it('returns -1 when no weight is positive', () => {
    const prng = createPrng('empty-weights')
    expect(prng.weightedIndex([])).toBe(-1)
    expect(prng.weightedIndex([0, 0, -3])).toBe(-1)
  })

  it('keeps nextInt inside its bound and handles degenerate input', () => {
    const prng = createPrng('ints')
    for (let i = 0; i < 5000; i += 1) {
      const value = prng.nextInt(7)
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(7)
    }
    expect(prng.nextInt(0)).toBe(0)
    expect(prng.nextInt(-4)).toBe(0)
    expect(prng.nextInt(Number.NaN)).toBe(0)
  })

  it('returns undefined when picking from an empty array', () => {
    expect(createPrng('pick').pick([])).toBeUndefined()
  })
})

describe('state serialisation', () => {
  it('resumes exactly where a snapshot was taken', () => {
    const prng = createPrng('replay')
    for (let i = 0; i < 10; i += 1) prng.next()

    const snapshot = prng.getState()
    const continued = Array.from({ length: 20 }, () => prng.next())
    const resumed = restorePrng(snapshot)
    const replayed = Array.from({ length: 20 }, () => resumed.next())

    expect(replayed).toEqual(continued)
  })

  it('survives a JSON round trip', () => {
    const prng = createPrng('json')
    prng.next()
    const snapshot = prng.getState()

    const revived = restorePrng(JSON.parse(JSON.stringify(snapshot)))
    expect(revived.next()).toBe(restorePrng(snapshot).next())
  })

  it('exposes a state of four unsigned 32-bit words', () => {
    const state = createPrng('words').getState()
    for (const word of [state.a, state.b, state.c, state.d]) {
      expect(Number.isInteger(word)).toBe(true)
      expect(word).toBeGreaterThanOrEqual(0)
      expect(word).toBeLessThanOrEqual(0xffffffff)
    }
  })
})

describe('substreams', () => {
  it('gives independent sequences for different labels', () => {
    const parent = createPrng('parent')
    const shocks = parent.fork('shocks')
    const events = parent.fork('events')

    const shockValues = Array.from({ length: 20 }, () => shocks.next())
    const eventValues = Array.from({ length: 20 }, () => events.next())
    expect(shockValues).not.toEqual(eventValues)
  })

  it('is reproducible and does not consume the parent', () => {
    const parent = createPrng('parent')
    const first = Array.from({ length: 10 }, () => parent.fork('shocks').next())
    // Forking twice from the same position must give the same substream.
    expect(new Set(first).size).toBe(1)

    const other = createPrng('parent')
    expect(other.next()).toBe(createPrng('parent').next())
  })
})

describe('stateless hash draws', () => {
  it('returns the same value for the same arguments', () => {
    expect(hashUnit('seed', 'series', 4, 0)).toBe(hashUnit('seed', 'series', 4, 0))
    expect(hashGaussian(0, 1, 'seed', 'x', 2)).toBe(hashGaussian(0, 1, 'seed', 'x', 2))
  })

  it('separates arguments so regrouping changes the stream', () => {
    // Without a separator, ('ab', 1) and ('a', 'b1') would collide.
    expect(hashUnit('ab', 1)).not.toBe(hashUnit('a', 'b1'))
  })

  it('varies with every argument', () => {
    const base = hashUnit('seed', 'headline_inflation', 3, 0)
    expect(hashUnit('seed', 'headline_inflation', 3, 1)).not.toBe(base)
    expect(hashUnit('seed', 'core_inflation', 3, 0)).not.toBe(base)
    expect(hashUnit('other', 'headline_inflation', 3, 0)).not.toBe(base)
  })

  it('stays inside [0, 1) and respects the requested spread', () => {
    const values: number[] = []
    for (let i = 0; i < 20000; i += 1) {
      const unit = hashUnit('seed', i)
      expect(unit).toBeGreaterThanOrEqual(0)
      expect(unit).toBeLessThan(1)
      values.push(hashGaussian(0, 2, 'seed', i))
    }
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length
    const sd = Math.sqrt(
      values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length,
    )
    expect(mean).toBeCloseTo(0, 1)
    expect(sd).toBeCloseTo(2, 1)
  })
})

describe('hashSeed', () => {
  it('is deterministic and sensitive to its arguments', () => {
    expect(hashSeed('a', 'b')).toEqual(hashSeed('a', 'b'))
    expect(hashSeed('a', 'b')).not.toEqual(hashSeed('a', 'c'))
  })
})
