import {
  COMMUNICATION,
  EXPECTATIONS,
  GUIDANCE_HORIZON_MEETINGS,
  MEETINGS_PER_YEAR,
  type CommunicationCommitment,
  type ObservationSet,
} from '../../simulation/index.ts'

/**
 * What the words are about to be worth, shown before they are published.
 *
 * The player's report was that announcing something felt like it changed
 * nothing. Measured, that is false and by a wide margin. Paired over 120 seeds
 * per bucket with the *rate trajectory held identical* between the two arms, so
 * the only difference is what was said:
 *
 *                     1y expectations closed   anchoring index   score   wins
 *   fed/easy               +0.054 pp (se .016)     +0.073          +78    92 %
 *   fed/medium             +0.208 pp (se .026)     +0.105         +126    91 %
 *   ecb/easy               +0.064 pp (se .017)     +0.069         +136    95 %
 *   ecb/medium             +0.223 pp (se .026)     +0.108         +173    83 %
 *
 * Four to ten standard errors, winning four seeds in five. The instrument was
 * never weak; it was invisible. Nothing on the screen connected the sentence
 * the player picked to the numbers that moved, and the same-day reaction panel
 * only appears *after* the decision is already taken.
 *
 * So the estimate goes on the confirmation screen, next to the statement it is
 * about. It is deliberately an estimate of *direction and rough size*, and the
 * copy says so: it is computed from the published credibility survey, which
 * carries its own measurement error, and markets do not owe anyone their
 * reaction function.
 *
 * Every figure here is derived from `COMMUNICATION` and `EXPECTATIONS` — the
 * same constants `applyPolicyPackage` uses — so the preview cannot drift from
 * the mechanism it describes without `guidancePreview.test.ts` failing.
 */

export interface GuidancePreview {
  /** Percentage points the priced one-year path is expected to move today. */
  readonly pricedPathMove: number
  /** Percentage points a year that one-year expectations will be pulled. */
  readonly expectationsPullPerYear: number
  /** Whether this puts a promise on the record that will come due. */
  readonly binding: boolean
  /** The meeting the promise is judged at, when there is one. */
  readonly judgedAtMeeting: number | null
}

/**
 * The reach of a statement. Only one channel is open at easy and it is the
 * one every difficulty has, so this is the honest default rather than a
 * simplification.
 */
const STATEMENT_REACH = COMMUNICATION.channelReach.statement

export function guidancePreview({
  observation,
  announcedRate,
  commitment,
  meetingIndex,
}: {
  readonly observation: ObservationSet
  /** Where the announcement puts the rate a year out, %. */
  readonly announcedRate: number
  readonly commitment: CommunicationCommitment
  readonly meetingIndex: number
}): GuidancePreview {
  const commitmentWeight = COMMUNICATION.commitmentWeight[commitment]
  const binding = commitmentWeight >= COMMUNICATION.commitmentWeight.conditional_path

  // The credibility survey is published exactly, like any other series, so
  // this reads it rather than the latent value — the preview is only ever as
  // good as what the player can see, which is the honest construction.
  const credibility = observation.indicators.credibility_index?.value ?? 50
  const priced = observation.indicators.market_expected_rate?.value ?? announcedRate

  const jump = Math.min(
    1,
    COMMUNICATION.guidanceMarketJump *
      (credibility / 100) *
      commitmentWeight *
      STATEMENT_REACH,
  )

  return {
    pricedPathMove: jump * (announcedRate - priced),
    // The standing announcement pulls one-year expectations between meetings,
    // for as long as it stands. Stated per year because that is the unit the
    // pull is defined in; a meeting is an eighth of it.
    expectationsPullPerYear:
      EXPECTATIONS.guidancePull *
      COMMUNICATION.guidanceInflationSensitivity *
      (credibility / 100) *
      commitmentWeight *
      (announcedRate - priced),
    binding,
    judgedAtMeeting: binding
      ? meetingIndex + GUIDANCE_HORIZON_MEETINGS + 1
      : null,
  }
}

/** Percentage points per meeting, for copy that talks in meetings. */
export function perMeeting(perYear: number): number {
  return perYear / MEETINGS_PER_YEAR
}
