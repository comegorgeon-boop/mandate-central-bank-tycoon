/**
 * Deterministic seeded pseudo-random number generation.
 *
 * The whole game is reproducible from (simulation version, seed, institution,
 * difficulty, ordered decisions), which requires every random draw to come
 * from here and nowhere else. `Math.random` must never appear in the engine.
 *
 * Two facilities are provided:
 *
 *   - `createPrng` / `restorePrng`: a sequential generator (sfc32) whose state
 *     is four 32-bit integers, so it round-trips through JSON and can live
 *     inside the serialisable simulation state.
 *
 *   - `hashUnit` / `hashGaussian`: stateless draws derived by hashing their
 *     arguments. The observation layer uses these so that measurement noise
 *     and revisions are a pure function of (seed, series, period, vintage)
 *     and stay consistent no matter when or how often they are recomputed.
 */

/** Serialisable generator state: four 32-bit unsigned integers. */
export interface PrngState {
  readonly a: number
  readonly b: number
  readonly c: number
  readonly d: number
}

export interface Prng {
  /** Uniform in [0, 1). */
  next(): number
  /** Uniform integer in [0, maxExclusive). Returns 0 when maxExclusive <= 0. */
  nextInt(maxExclusive: number): number
  /** Uniform in [min, max). */
  range(min: number, max: number): number
  /** Normal draw. Consumes exactly two uniforms. */
  gaussian(mean?: number, sd?: number): number
  /** True with probability p. */
  bernoulli(p: number): boolean
  /** Index drawn proportionally to `weights`. Returns -1 if all are <= 0. */
  weightedIndex(weights: readonly number[]): number
  /** Uniformly picks one element. Returns undefined for an empty array. */
  pick<T>(items: readonly T[]): T | undefined
  /** Snapshot of the current state; feed it to `restorePrng` to resume. */
  getState(): PrngState
  /**
   * Derives an independent substream from the current state and a label.
   * Does not consume a draw from the parent, so forking the same label from
   * the same position always yields the same substream.
   */
  fork(label: string): Prng
}

const UINT32 = 4294967296

/** Number of draws discarded after seeding, to wash out seed structure. */
const WARMUP_DRAWS = 12

/**
 * cyrb128: string -> four well-mixed 32-bit seeds.
 * Public domain, widely used as an sfc32 seeder.
 */
function cyrb128(input: string): PrngState {
  let h1 = 1779033703
  let h2 = 3144134277
  let h3 = 1013904242
  let h4 = 2773480762
  for (let i = 0; i < input.length; i += 1) {
    const k = input.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)
  return {
    a: (h1 ^ h2 ^ h3 ^ h4) >>> 0,
    b: (h2 ^ h1) >>> 0,
    c: (h3 ^ h1) >>> 0,
    d: (h4 ^ h1) >>> 0,
  }
}

/** Joins seed parts with a separator that cannot appear in normal input. */
function joinParts(parts: readonly (string | number)[]): string {
  return parts.join('\u001F')
}

/** Derives a generator state from arbitrary parts. */
export function hashSeed(...parts: readonly (string | number)[]): PrngState {
  return cyrb128(joinParts(parts))
}

function makePrng(initial: PrngState, warmup: number): Prng {
  let a = initial.a | 0
  let b = initial.b | 0
  let c = initial.c | 0
  let d = initial.d | 0

  // sfc32, by Chris Doty-Humphrey. Fast, passes PractRand, 128-bit state.
  const next = (): number => {
    const t = (((a + b) | 0) + d) | 0
    d = (d + 1) | 0
    a = b ^ (b >>> 9)
    b = (c + (c << 3)) | 0
    c = (c << 21) | (c >>> 11)
    c = (c + t) | 0
    return (t >>> 0) / UINT32
  }

  for (let i = 0; i < warmup; i += 1) next()

  const prng: Prng = {
    next,
    nextInt(maxExclusive) {
      if (!Number.isFinite(maxExclusive) || maxExclusive <= 0) return 0
      return Math.floor(next() * maxExclusive)
    },
    range(min, max) {
      return min + next() * (max - min)
    },
    gaussian(mean = 0, sd = 1) {
      // Box-Muller. The second normal is discarded rather than cached so the
      // generator holds no hidden state beyond the four sfc32 words.
      let u1 = next()
      const u2 = next()
      if (u1 <= Number.MIN_VALUE) u1 = Number.MIN_VALUE
      const magnitude = Math.sqrt(-2 * Math.log(u1))
      return mean + sd * magnitude * Math.cos(2 * Math.PI * u2)
    },
    bernoulli(p) {
      return next() < p
    },
    weightedIndex(weights) {
      let total = 0
      for (const w of weights) {
        if (Number.isFinite(w) && w > 0) total += w
      }
      if (total <= 0) return -1
      let threshold = next() * total
      for (let i = 0; i < weights.length; i += 1) {
        const w = weights[i]
        if (!Number.isFinite(w) || w <= 0) continue
        threshold -= w
        if (threshold <= 0) return i
      }
      // Only reachable through floating-point accumulation error.
      for (let i = weights.length - 1; i >= 0; i -= 1) {
        if (Number.isFinite(weights[i]) && weights[i] > 0) return i
      }
      return -1
    },
    pick(items) {
      if (items.length === 0) return undefined
      return items[Math.floor(next() * items.length)]
    },
    getState() {
      return { a: a >>> 0, b: b >>> 0, c: c >>> 0, d: d >>> 0 }
    },
    fork(label) {
      return createPrng(`${a >>> 0}-${b >>> 0}-${c >>> 0}-${d >>> 0}-${label}`)
    },
  }

  return prng
}

/** Creates a generator from a seed string. Warms up before first use. */
export function createPrng(seed: string): Prng {
  return makePrng(cyrb128(seed), WARMUP_DRAWS)
}

/**
 * Resumes a generator from a snapshot.
 *
 * Deliberately performs no warmup: the snapshot is already past it, and
 * re-warming would break replay.
 */
export function restorePrng(state: PrngState): Prng {
  return makePrng(state, 0)
}

/**
 * Stateless uniform draw in [0, 1) derived purely from its arguments.
 *
 * Same arguments always give the same number, in any order, at any time.
 */
export function hashUnit(...parts: readonly (string | number)[]): number {
  return makePrng(cyrb128(joinParts(parts)), WARMUP_DRAWS).next()
}

/** Stateless normal draw derived purely from its arguments. */
export function hashGaussian(
  mean: number,
  sd: number,
  ...parts: readonly (string | number)[]
): number {
  return makePrng(cyrb128(joinParts(parts)), WARMUP_DRAWS).gaussian(mean, sd)
}
