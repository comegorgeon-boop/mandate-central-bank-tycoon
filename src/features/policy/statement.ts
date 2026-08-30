import type {
  CommunicationCommitment,
  CommunicationTone,
} from '../../simulation/index.ts'

/**
 * The committee's statement, assembled from deterministic templates.
 *
 * The player never picks jargon. They choose a plain-language answer to two
 * questions — where is this heading, and how firmly do we mean it — and the
 * basis points, the commitment level and the tone are derived. The numbers
 * appear as footnotes on the options, not as the options.
 *
 * All copy is generated locally. No model, no remote call.
 */

/** One selectable answer to "where is the rate heading from here?". */
export interface PathOption {
  /** Announced path relative to today's decision, in basis points. */
  readonly signal: number
  /** The sentence the player picks. */
  readonly label: string
}

/**
 * Five positions, not a slider. Easy mode trades granularity for a choice
 * that can be read at a glance; the engine accepts any multiple of 25.
 */
export const PATH_OPTIONS: readonly PathOption[] = [
  { signal: -100, label: 'We expect to reverse much of this' },
  { signal: -50, label: 'We expect to ease somewhat from here' },
  { signal: 0, label: 'This completes the adjustment for now' },
  { signal: 50, label: 'We expect to go somewhat further' },
  { signal: 100, label: 'We expect to go materially further' },
]

/** One selectable strength of engagement. */
export interface CommitmentOption {
  readonly commitment: CommunicationCommitment
  readonly label: string
  readonly detail: string
}

export const COMMITMENT_OPTIONS: readonly CommitmentOption[] = [
  {
    commitment: 'none',
    label: 'A remark, not a promise',
    detail:
      'Nothing is recorded. Markets hear the tone of the statement and no more.',
  },
  {
    commitment: 'weak_bias',
    label: 'A leaning',
    detail:
      'A stated direction markets partly believe. Costless to walk away from, ' +
      'and weaker for it.',
  },
  {
    commitment: 'conditional_path',
    label: 'A conditional commitment',
    detail:
      'A promise, judged in about a year. Deliver it and your word compounds; ' +
      'break it — by moving against it, or by quietly rewriting it — and every ' +
      'future statement is discounted.',
  },
]

/**
 * The tone markets read off the package. At easy it is derived, not chosen:
 * the announced path speaks first, and a package that announces nothing is
 * read off the decision itself. Saying one thing while doing another only
 * becomes possible at the difficulties that price it.
 */
export function deriveTone(
  moveBp: number,
  signalBp: number,
  commitment: CommunicationCommitment,
): CommunicationTone {
  const announced = commitment === 'none' ? 0 : signalBp
  if (announced > 0) return 'hawkish'
  if (announced < 0) return 'dovish'
  if (moveBp > 0) return 'hawkish'
  if (moveBp < 0) return 'dovish'
  return 'neutral'
}

function describeMove(moveBp: number): string {
  if (moveBp > 0) return `The Committee raised the policy rate by ${moveBp} bp.`
  if (moveBp < 0) return `The Committee lowered the policy rate by ${Math.abs(moveBp)} bp.`
  return 'The Committee left the policy rate unchanged.'
}

function describePath(signalBp: number): string {
  if (signalBp > 0) {
    return `It expects to take the rate about ${signalBp} bp higher over the coming year.`
  }
  if (signalBp < 0) {
    return `It expects to bring the rate about ${Math.abs(signalBp)} bp lower over the coming year.`
  }
  return 'It expects to hold the rate near this level over the coming year.'
}

/** The full statement, as the wire would carry it. */
export function buildStatement(
  moveBp: number,
  signalBp: number,
  commitment: CommunicationCommitment,
): string {
  const decision = describeMove(moveBp)
  if (commitment === 'none') {
    return `${decision} Beyond the decision, the Committee offered only general remarks.`
  }
  const path = describePath(signalBp)
  const firmness =
    commitment === 'weak_bias'
      ? 'This is a leaning, not a commitment.'
      : 'The Committee commits to this path, and will depart from it only if conditions change materially.'
  return `${decision} ${path} ${firmness}`
}
