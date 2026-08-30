import type { Difficulty } from '../types/core.ts'
import type { LagBuffers } from '../types/state.ts'
import {
  LAG_KERNEL,
  LAG_KERNEL_LENGTH,
  MEETINGS_PER_YEAR,
  SUBSTEPS_PER_MEETING,
} from '../config/time.ts'

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

/** Sub-steps spanned by one year of policy history. */
const SUBSTEPS_PER_YEAR = MEETINGS_PER_YEAR * SUBSTEPS_PER_MEETING

const normaliserCache = new Map<readonly number[], number>()

/**
 * The largest reading a completed 1pp tightening cycle can produce.
 *
 * Differencing the transmitted stance over a one-year window only ever sees
 * the kernel mass that fits inside that window. On easy the kernel is narrow
 * and nearly all of it fits, so the raw reading already peaks near 1. On hard
 * the kernel is wider than a year, so a full 1pp cycle would peak at about 0.5
 * — which would quietly halve the banking-stress channel exactly where the
 * design wants the dilemma at its most brutal.
 *
 * Dividing by this restores it. The rule the fix has to obey is that only the
 * *timing* of the cost moves, never its size.
 */
function tighteningNormaliser(kernel: readonly number[]): number {
  const cached = normaliserCache.get(kernel)
  if (cached !== undefined) return cached

  // The reading for a step made `age` sub-steps ago is the kernel mass in
  // [age - SUBSTEPS_PER_YEAR, age). The peak is the heaviest such window.
  let peak = 0
  let window = 0
  for (let age = 1; age <= kernel.length; age += 1) {
    window += kernel[age - 1]
    if (age > SUBSTEPS_PER_YEAR) window -= kernel[age - SUBSTEPS_PER_YEAR - 1]
    if (window > peak) peak = window
  }

  const normaliser = peak > 0 ? peak : 1
  normaliserCache.set(kernel, normaliser)
  return normaliser
}

/**
 * How far the *transmitted* real rate gap has travelled over the past year.
 *
 * Used for the duration-loss channel: what damages bank balance sheets is the
 * speed of tightening, not its level.
 *
 * The convolution is the whole point, and it is what this function used to be
 * missing. Read raw — `buffer[0] - buffer[32]` — the cost of tightening lands
 * the instant the rate moves, while its benefit crosses the same kernel *and*
 * the Phillips curve's own partial adjustment before reaching inflation. The
 * two sides of the central banker's dilemma then run on different clocks, and
 * a mandate short enough shows the player only the cost. On fed/easy that made
 * the dilemma unresolvable rather than hard: stress was up 1.8 points after one
 * meeting while inflation had moved 0.008. See docs/BALANCE.md.
 *
 * Passing the one-year change through the same kernel that governs the demand
 * channel puts them back on one clock. Note what this deliberately does *not*
 * do: the magnitude is untouched, because `tighteningNormaliser` rescales the
 * reading so a completed 1pp tightening cycle still registers as 1pp at every
 * difficulty. Only the timing moves. The dilemma keeps its full force —
 * `BANKING.tighteningSpeed` is unchanged — and becomes a choice between a
 * delayed cost and a delayed benefit, which is the real problem, rather than an
 * immediate cost against an invisible one.
 *
 * Indices older than the buffer read its oldest entry, which is the opening
 * steady state `fillLag` seeded it with. So a run that has not moved its rate
 * reports exactly zero rather than a startup transient.
 */
export function tighteningSpeed(
  lags: LagBuffers,
  kernel: readonly number[],
): number {
  const buffer = lags.realRateGap
  if (buffer.length === 0) return 0

  const change = new Array<number>(buffer.length)
  for (let i = 0; i < buffer.length; i += 1) {
    const yearAgo = Math.min(i + SUBSTEPS_PER_YEAR, buffer.length - 1)
    change[i] = buffer[i] - buffer[yearAgo]
  }
  return convolve(change, kernel) / tighteningNormaliser(kernel)
}
