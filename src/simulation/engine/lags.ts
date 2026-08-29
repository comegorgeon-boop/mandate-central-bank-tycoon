import type { Difficulty } from '../types/core.ts'
import type { LagBuffers } from '../types/state.ts'
import { LAG_KERNEL, LAG_KERNEL_LENGTH } from '../config/time.ts'

/**
 * The distributed-lag machinery.
 *
 * A policy change does not act on demand when it is made. It enters a rolling
 * history and its influence is spread across the following two years by a
 * hump-shaped kernel that peaks several quarters out. Inflation then responds
 * to the resulting output gap through the Phillips curve's own partial
 * adjustment, so the full policy-to-inflation response peaks later still.
 *
 * This two-stage structure is the reason a rate hike cannot be cashed in as
 * an instant turn bonus.
 */

const kernelCache = new Map<Difficulty, readonly number[]>()

/**
 * Builds the transmission kernel for a difficulty: a discretised gamma
 * density over sub-steps, normalised to sum to one.
 */
export function buildLagKernel(difficulty: Difficulty): readonly number[] {
  const cached = kernelCache.get(difficulty)
  if (cached) return cached

  const { peakSubsteps, scale } = LAG_KERNEL[difficulty]
  // Gamma density peaks at (shape - 1) * scale, so invert for the shape.
  const shape = peakSubsteps / scale + 1

  const weights = new Array<number>(LAG_KERNEL_LENGTH)
  let total = 0
  for (let k = 0; k < LAG_KERNEL_LENGTH; k += 1) {
    const x = (k + 1) / scale
    const w = Math.pow(x, shape - 1) * Math.exp(-x)
    weights[k] = w
    total += w
  }

  const normalised = total > 0 ? weights.map((w) => w / total) : weights
  kernelCache.set(difficulty, normalised)
  return normalised
}

/**
 * Weighted sum of a lag buffer against a kernel.
 *
 * Renormalises by the kernel mass actually used, so a buffer that has not yet
 * filled cannot silently weaken the impulse.
 */
export function convolve(
  buffer: readonly number[],
  kernel: readonly number[],
): number {
  const n = Math.min(buffer.length, kernel.length)
  let sum = 0
  let mass = 0
  for (let i = 0; i < n; i += 1) {
    sum += buffer[i] * kernel[i]
    mass += kernel[i]
  }
  return mass > 0 ? sum / mass : 0
}

/** Pushes a new observation onto the front of a lag buffer. */
export function pushLag(
  buffer: readonly number[],
  value: number,
): readonly number[] {
  const next = new Array<number>(Math.min(buffer.length + 1, LAG_KERNEL_LENGTH))
  next[0] = value
  for (let i = 1; i < next.length; i += 1) next[i] = buffer[i - 1]
  return next
}

/** A buffer pre-filled with a steady-state value, avoiding a startup transient. */
export function fillLag(value: number): readonly number[] {
  return new Array<number>(LAG_KERNEL_LENGTH).fill(value)
}

/**
 * How far the real rate gap has travelled over the past year.
 *
 * Used for the duration-loss channel: what damages bank balance sheets is the
 * speed of tightening, not its level.
 */
export function tighteningSpeed(lags: LagBuffers): number {
  const buffer = lags.realRateGap
  if (buffer.length === 0) return 0
  const yearAgoIndex = Math.min(buffer.length - 1, 32)
  return buffer[0] - buffer[yearAgoIndex]
}
