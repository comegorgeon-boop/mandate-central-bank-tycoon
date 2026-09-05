import type { ObservationSet, SeriesId } from '../../simulation/index.ts'

/**
 * What winning looks like, in the regime the committee is actually in.
 *
 * The game used to state one objective in every state of the world — return
 * inflation to target — and score against it. Under a cost-push shock that is
 * not a demanding standard, it is an impossible one, and being marked down for
 * a target nobody could have hit is what made an easy mandate opening on a
 * supply crisis unplayable. `config/scoring.ts`'s `SUPPLY_REGIME` moves the
 * scored objective with the regime; this says so out loud, at the meeting, so
 * the player is told what they are being judged on before they are judged on
 * it rather than afterwards in the postmortem.
 *
 * Read from the *published* observation, never from the latent state, for two
 * reasons. It is what every other player-facing derivation in this build does,
 * so the information ladder stays intact and hard is not handed the shock's
 * identity through a side door. And it is verifiable: the tells quoted here are
 * on the indicator panels, so the player can check the claim rather than take
 * it. The score reads the exact latent shock instead — scoring is not an
 * information problem — so the two agree up to the measurement error on the
 * prints, which is the same honest gap every other reading in the game carries.
 *
 * All copy is assembled from fixed templates. No model, no remote call.
 */

export interface RegimeObjective {
  /** Whether the regime has displaced the standing objective. */
  readonly displaced: boolean
  /** The headline: what winning looks like from here. */
  readonly goal: string
  /** Why it is that, and not the usual one. */
  readonly reason: string
}

function value(observation: ObservationSet, id: SeriesId): number | null {
  return observation.indicators[id]?.value ?? null
}

/**
 * How wide the headline-core wedge has to be before it is a cost-push story.
 *
 * The same tell `observation/diagnose.ts` leads its supply evidence with, and
 * the same one docs/BALANCE.md pins above the combined print error at every
 * difficulty (`the evidence that identifies a shock stays above the noise`).
 * Stated here at that guard's own comfortable margin rather than at the noise
 * floor, because acting on this changes what the player is told they are
 * playing for and should need more than a marginal reading.
 */
const WEDGE_THRESHOLD = 0.8

export function regimeObjective(
  observation: ObservationSet,
  inflationTarget: number,
): RegimeObjective {
  const headline = value(observation, 'headline_inflation')
  const core = value(observation, 'core_inflation')
  const gap = value(observation, 'output_gap_estimate')
  const imports = value(observation, 'import_prices')

  const standing: RegimeObjective = {
    displaced: false,
    goal: `Bring inflation back to ${inflationTarget.toFixed(1)} % without breaking employment on the way.`,
    reason:
      'Prices and activity are moving together, so the rate addresses both at ' +
      'once and there is no trade-off to manage.',
  }

  if (headline === null || core === null) return standing

  const wedge = headline - core
  const costPush = wedge >= WEDGE_THRESHOLD && headline > inflationTarget
  if (!costPush) return standing

  // A cost-push shock with output already falling is the full stagflation
  // case; without it, the shock has not yet reached the real economy.
  const biting = gap !== null && gap < -0.2

  return {
    displaced: true,
    goal:
      'Keep five-year expectations anchored, and hold down the total damage. ' +
      `Returning inflation to ${inflationTarget.toFixed(1)} % inside this mandate is not available.`,
    reason:
      `Headline is running ${wedge.toFixed(2)} pp ahead of core` +
      (imports !== null && imports >= 2
        ? `, with import prices at ${imports.toFixed(1)} %`
        : '') +
      (biting ? `, and the output gap has opened to ${gap.toFixed(2)} %` : '') +
      '. Costs are being pushed up from outside domestic demand, and no ' +
      'instrument on this desk reaches them. Tightening enough to hit the ' +
      'target would have to work by destroying output instead — so the ' +
      'mandate is judged on the anchor and the damage, not on the target.',
  }
}
