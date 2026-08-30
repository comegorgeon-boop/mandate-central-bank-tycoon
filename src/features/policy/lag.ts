import {
  SUBSTEPS_PER_MEETING,
  buildLagKernel,
  type Difficulty,
} from '../../simulation/index.ts'

/**
 * How long the rate takes to act, read off the engine's own kernel.
 *
 * The Policy Desk must not quote a generic lag range: the kernel is
 * difficulty-dependent, so the only honest figure is the one derived from the
 * kernel this run is actually using.
 */
export interface TransmissionLag {
  /** Meetings until the impulse response peaks. */
  readonly peakMeetings: number
  /** Meetings by which 90 % of the response has been delivered. */
  readonly spanMeetings: number
}

export function transmissionLag(difficulty: Difficulty): TransmissionLag {
  const kernel = buildLagKernel(difficulty)

  let peakIndex = 0
  for (let i = 1; i < kernel.length; i += 1) {
    if (kernel[i] > kernel[peakIndex]) peakIndex = i
  }

  let cumulative = 0
  let spanIndex = kernel.length - 1
  for (let i = 0; i < kernel.length; i += 1) {
    cumulative += kernel[i]
    if (cumulative >= 0.9) {
      spanIndex = i
      break
    }
  }

  return {
    peakMeetings: (peakIndex + 1) / SUBSTEPS_PER_MEETING,
    spanMeetings: (spanIndex + 1) / SUBSTEPS_PER_MEETING,
  }
}

/** Renders a meeting count that may be fractional, e.g. `1.5 meetings`. */
export function formatMeetings(meetings: number): string {
  const rounded = Math.round(meetings * 10) / 10
  return `${rounded} meeting${rounded === 1 ? '' : 's'}`
}
