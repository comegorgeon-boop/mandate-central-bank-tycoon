import type { Institution } from '../types/core.ts'
import type { ObservationSet, SeriesId, ShockDiagnosis, ShockKind } from '../types/observation.ts'
import type { LatentState } from '../types/state.ts'
import { getInstitution } from '../config/institutions.ts'
import { SHOCK_PROCESSES } from '../config/shocks.ts'

/**
 * Naming the shock, and showing the evidence that names it.
 *
 * This is the learning mode's central device, and the order of the two halves
 * matters more than either half alone. A label on its own teaches obedience to
 * a label: the player learns "supply shock means do not tighten" and is
 * helpless the moment the label is taken away. The evidence teaches the
 * reading itself — that a headline print running far ahead of core, with the
 * output gap opening rather than closing, *is* what a supply shock looks like
 * from the inside.
 *
 * So the label comes from the latent truth, which is what makes the learning
 * mode reliable, while every piece of evidence is drawn from published data
 * the player can see for themselves. When the label is withdrawn at higher
 * difficulties, the evidence is still on the screen and still means what it
 * meant here.
 */

/**
 * Stationary standard deviation of a mean-reverting process, sqrt(v²/2k).
 *
 * Shocks are compared on this scale rather than in their raw units, so a
 * supply shock and a financial shock are judged by how unusual each is for
 * itself rather than by which happens to be measured in bigger numbers.
 */
function stationarySd(key: string): number {
  const process = SHOCK_PROCESSES.find((candidate) => candidate.key === key)
  if (process === undefined) return 1
  return process.volatility / Math.sqrt(2 * process.meanReversion)
}

/** Below this many standard deviations, nothing is worth naming. */
const QUIET_THRESHOLD = 0.9

const KIND_BY_FIELD: Readonly<Record<string, ShockKind>> = {
  supplyShock: 'supply',
  demandShock: 'demand',
  financialShock: 'financial',
  productivityShock: 'productivity',
  confidenceShock: 'confidence',
}

const SUMMARY: Readonly<Record<ShockKind, string>> = {
  supply:
    'Costs are being pushed up by something outside domestic demand — energy, ' +
    'food or supply chains. It raises prices and cuts output at the same time, ' +
    'so the two halves of the mandate pull in opposite directions.',
  demand:
    'Spending is running ahead of what the economy can supply. Prices and ' +
    'activity move together, so tightening addresses both at once and there is ' +
    'no trade-off to manage.',
  financial:
    'Stress is building in credit and funding markets. Financial conditions ' +
    'tighten on their own, doing part of the work of policy — and occasionally ' +
    'far more of it than intended.',
  productivity:
    'The economy’s capacity to produce is shifting. Potential output is moving ' +
    'under the estimates, which makes the output gap less reliable than usual ' +
    'and the neutral rate itself uncertain.',
  confidence:
    'Households and firms are changing their spending plans ahead of any change ' +
    'in their circumstances. It moves demand quickly and can reverse just as ' +
    'quickly.',
  none: 'No single disturbance dominates. The economy is being moved mostly by ' +
    'the lagged effects of decisions already taken, including this committee’s.',
}

const LABEL: Readonly<Record<ShockKind, string>> = {
  supply: 'Supply shock',
  demand: 'Demand shock',
  financial: 'Financial shock',
  productivity: 'Productivity shock',
  confidence: 'Confidence shock',
  none: 'No dominant shock',
}

function value(observation: ObservationSet, id: SeriesId): number | null {
  return observation.indicators[id]?.value ?? null
}

function previous(observation: ObservationSet, id: SeriesId): number | null {
  return observation.indicators[id]?.previous ?? null
}

/**
 * The observable tells for a shock, built from published data only.
 *
 * A tell is included only when the published numbers actually show it. An
 * evidence list that asserted a pattern the panel next to it contradicts would
 * teach the player to distrust the screen, which is worse than saying less.
 */
function evidenceFor(
  kind: ShockKind,
  observation: ObservationSet,
  institution: Institution,
): readonly string[] {
  const target = getInstitution(institution).inflationTarget
  const headline = value(observation, 'headline_inflation')
  const core = value(observation, 'core_inflation')
  const gap = value(observation, 'output_gap_estimate')
  const imports = value(observation, 'import_prices')
  const spread = value(observation, 'credit_spread')
  const spreadPrev = previous(observation, 'credit_spread')
  const confidence = value(observation, 'consumer_confidence')
  const growth = value(observation, 'real_growth')
  const wages = value(observation, 'wage_growth')
  const unemployment = value(observation, 'unemployment')
  const unemploymentPrev = previous(observation, 'unemployment')
  const valuation = value(observation, 'asset_valuation')

  const tells: string[] = []

  switch (kind) {
    case 'supply': {
      // Cost pushes run both ways. A fall in energy prices is as much a supply
      // shock as a rise, and reads as the same divergence with the sign flipped.
      if (headline !== null && core !== null && Math.abs(headline - core) >= 0.3) {
        const above = headline > core
        tells.push(
          `Headline inflation is at ${headline.toFixed(2)} % while core ` +
            `${above ? 'holds at' : 'stays higher at'} ${core.toFixed(2)} % — the move ` +
            'is in the volatile components, not in the underlying trend.',
        )
      }
      if (gap !== null && gap < -0.2 && headline !== null && headline > target) {
        tells.push(
          `The output gap is at ${gap.toFixed(2)} % of potential while inflation runs ` +
            'above target. Prices rising as output falls is the signature: demand ' +
            'shocks move both the same way.',
        )
      }
      if (imports !== null && imports >= 2) {
        tells.push(
          `Import prices are running at ${imports.toFixed(1)} %, which is the route ` +
            'world costs take into domestic inflation.',
        )
      }
      break
    }
    case 'demand': {
      if (headline !== null && core !== null && Math.abs(headline - core) < 0.5) {
        tells.push(
          `Core at ${core.toFixed(2)} % is moving with headline at ` +
            `${headline.toFixed(2)} % — the pressure is broad, not confined to energy ` +
            'and food.',
        )
      }
      if (gap !== null && Math.abs(gap) > 0.2) {
        tells.push(
          gap > 0
            ? `The output gap is at +${gap.toFixed(2)} % of potential: the economy is ` +
                'running above what it can sustain.'
            : `The output gap is at ${gap.toFixed(2)} % of potential: spending has ` +
                'fallen below what the economy could produce.',
        )
      }
      if (
        unemployment !== null &&
        unemploymentPrev !== null &&
        unemployment - unemploymentPrev <= -0.05
      ) {
        tells.push(
          `Unemployment fell to ${unemployment.toFixed(2)} %, tightening the labour ` +
            'market further.',
        )
      }
      if (wages !== null && wages >= target + 2) {
        tells.push(
          `Wage growth at ${wages.toFixed(2)} % is above what productivity and the ` +
            'objective together can absorb.',
        )
      }
      break
    }
    case 'financial': {
      if (spread !== null && spreadPrev !== null && spread - spreadPrev >= 0.05) {
        tells.push(
          `Corporate credit spreads widened to ${spread.toFixed(2)} pp, up ` +
            `${(spread - spreadPrev).toFixed(2)} pp since the last meeting. Spreads are ` +
            'a market price, so they move before any statistic does.',
        )
      } else if (spread !== null) {
        tells.push(
          `Corporate credit spreads sit at ${spread.toFixed(2)} pp — the fastest ` +
            'series on the table for this kind of stress.',
        )
      }
      if (valuation !== null && valuation <= -5) {
        tells.push(
          `Asset valuations are ${valuation.toFixed(1)} below fair value, which is ` +
            'where financial stress shows up before it reaches lending.',
        )
      }
      tells.push(
        'Financial conditions tighten here without the committee doing anything, ' +
          'so the stance is more restrictive than the policy rate alone suggests.',
      )
      break
    }
    case 'productivity': {
      if (growth !== null) {
        tells.push(
          `Real output growth is at ${growth.toFixed(2)} %, which is what shifts the ` +
            'estimate of potential — and therefore the output gap under it.',
        )
      }
      tells.push(
        'The output gap estimate is the least reliable number on the table at the ' +
          'best of times. When potential itself is moving, it is worse than usual.',
      )
      break
    }
    case 'confidence': {
      if (confidence !== null) {
        tells.push(
          `Consumer confidence reads ${confidence.toFixed(1)} against a neutral 50. ` +
            'The survey turns before the spending it describes.',
        )
      }
      if (gap !== null) {
        tells.push(
          `The output gap estimate is at ${gap.toFixed(2)} % but lags this survey by ` +
            'two meetings, so it has not caught up yet.',
        )
      }
      break
    }
    case 'none': {
      tells.push(
        'No indicator is far enough from its normal range to point at a single ' +
          'cause. What moves the economy now is mostly what was decided earlier.',
      )
      break
    }
  }

  // Every named shock must arrive with something the player can look up, or
  // the label is exactly the bare instruction this mode exists to avoid.
  if (tells.length === 0) {
    tells.push(
      'The published series are not yet showing this clearly. The tell to watch ' +
        'is the gap between headline and core inflation, read against the ' +
        'direction of the output gap.',
    )
  }

  return tells
}

/**
 * Identifies the disturbance currently dominating the economy.
 *
 * Called only where the difficulty grants it. The latent state is read here to
 * name the shock — this is the one place the learning mode is allowed to be
 * omniscient — and never leaves this function: only the label and the
 * published evidence reach the player.
 */
export function diagnoseShock(
  latent: LatentState,
  observation: ObservationSet,
  institution: Institution,
): ShockDiagnosis {
  let kind: ShockKind = 'none'
  let strongest = QUIET_THRESHOLD

  for (const [field, candidate] of Object.entries(KIND_BY_FIELD)) {
    const raw = latent[field as keyof LatentState]
    if (typeof raw !== 'number') continue
    const magnitude = Math.abs(raw) / stationarySd(field)
    if (magnitude > strongest) {
      strongest = magnitude
      kind = candidate
    }
  }

  return {
    kind,
    label: LABEL[kind],
    summary: SUMMARY[kind],
    evidence: evidenceFor(kind, observation, institution),
  }
}
