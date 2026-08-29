import type { Institution } from '../types/core.ts'
import type {
  CausalFactor,
  EndConditionId,
  EndConditionResult,
  EndConditionWarning,
} from '../types/scoring.ts'
import type { LatentState, SimulationState } from '../types/state.ts'
import { getDifficulty } from '../config/difficulty.ts'
import { getInstitution } from '../config/institutions.ts'
import { EXCHANGE, VOLATILITY } from '../config/model.ts'
import { THRESHOLDS } from '../config/thresholds.ts'
import { realRateGap, unemploymentGap } from '../engine/indices.ts'

/**
 * End-state evaluation.
 *
 * Two rules govern this file.
 *
 * First, nothing ends a run on a single reading. Every failure requires its
 * condition to hold for several consecutive meetings, tracked in
 * `breachCounters`, and every family has a warning tier that fires first.
 * Dismissal in particular needs four consecutive meetings of collapsed
 * credibility — an unpopular decision, or even a bad year, is not enough.
 *
 * Second, the postmortem never blames one thing. When a run ends, the result
 * carries a ranked causal chain whose contributions sum to one, so a complex
 * crisis is reported as the several factors that produced it.
 */

/**
 * Scales a threshold by the difficulty's leniency.
 *
 * `direction` says which side is bad. Easy mode moves the bar further away,
 * so a catastrophe needs a more extreme economy before it triggers.
 */
function scaleThreshold(
  threshold: number,
  leniency: number,
  direction: 'high' | 'low',
): number {
  if (direction === 'high') return threshold * leniency
  return threshold > 0 ? threshold / leniency : threshold * leniency
}

interface ConditionDefinition {
  readonly id: EndConditionId
  readonly label: string
  readonly institutions?: readonly Institution[]
  readonly meetingsToFail: number
  readonly watch: (latent: LatentState, leniency: number, target: number) => boolean
  readonly fail: (latent: LatentState, leniency: number, target: number) => boolean
  readonly summary: string
  readonly warning: string
}

const CONDITIONS: readonly ConditionDefinition[] = [
  {
    id: 'inflation_spiral',
    label: 'Runaway inflation',
    meetingsToFail: THRESHOLDS.inflationSpiral.meetingsToFail,
    watch: (latent, leniency) =>
      latent.inflationHeadline >
      scaleThreshold(THRESHOLDS.inflationSpiral.watchInflation, leniency, 'high'),
    fail: (latent, leniency) =>
      latent.inflationHeadline >
        scaleThreshold(THRESHOLDS.inflationSpiral.failInflation, leniency, 'high') ||
      latent.expectedInflationLong >
        scaleThreshold(THRESHOLDS.inflationSpiral.failExpectations, leniency, 'high'),
    summary:
      'Inflation accelerated beyond the point where the institution could still ' +
      'bring it back, and long-run expectations followed it up.',
    warning: 'Inflation is far above target and still rising.',
  },
  {
    id: 'deflation_spiral',
    label: 'Deflation spiral',
    meetingsToFail: THRESHOLDS.deflationSpiral.meetingsToFail,
    watch: (latent, leniency) =>
      latent.inflationHeadline <
        scaleThreshold(THRESHOLDS.deflationSpiral.watchInflation, leniency, 'low') &&
      latent.outputGap <
        scaleThreshold(THRESHOLDS.deflationSpiral.watchOutputGap, leniency, 'low'),
    fail: (latent, leniency) =>
      latent.inflationHeadline <
        scaleThreshold(THRESHOLDS.deflationSpiral.failInflation, leniency, 'low') &&
      latent.expectedInflationLong <
        scaleThreshold(THRESHOLDS.deflationSpiral.failExpectations, leniency, 'low'),
    summary:
      'Prices fell, expectations of further falls took hold, and real rates rose ' +
      'even as the policy rate was cut — the self-reinforcing trap.',
    warning: 'Prices are falling while the economy runs well below potential.',
  },
  {
    id: 'depression',
    label: 'Depression-level collapse',
    meetingsToFail: THRESHOLDS.depression.meetingsToFail,
    watch: (latent, leniency) =>
      latent.outputGap <
        scaleThreshold(THRESHOLDS.depression.watchOutputGap, leniency, 'low') ||
      unemploymentGap(latent) >
        scaleThreshold(THRESHOLDS.depression.watchUnemploymentGap, leniency, 'high'),
    fail: (latent, leniency) =>
      latent.outputGap <
        scaleThreshold(THRESHOLDS.depression.failOutputGap, leniency, 'low') &&
      unemploymentGap(latent) >
        scaleThreshold(THRESHOLDS.depression.failUnemploymentGap, leniency, 'high'),
    summary:
      'Output and employment collapsed far below potential and stayed there long ' +
      'enough for the damage to become structural.',
    warning: 'Output and employment are deteriorating sharply.',
  },
  {
    id: 'banking_crisis',
    label: 'Systemic banking crisis',
    meetingsToFail: THRESHOLDS.bankingCrisis.meetingsToFail,
    watch: (latent, leniency) =>
      latent.bankingStress >
      scaleThreshold(THRESHOLDS.bankingCrisis.watchStress, leniency, 'high'),
    fail: (latent, leniency) =>
      latent.bankingStress >
      scaleThreshold(THRESHOLDS.bankingCrisis.failStress, leniency, 'high'),
    summary:
      'Stress in the banking system passed the point of self-correction and ' +
      'intermediation broke down.',
    warning: 'Banking system stress is at levels that historically precede a crisis.',
  },
  {
    id: 'fragmentation_crisis',
    label: 'Sovereign fragmentation crisis',
    institutions: ['ecb'],
    meetingsToFail: THRESHOLDS.fragmentationCrisis.meetingsToFail,
    watch: (latent, leniency) =>
      latent.fragmentation >
      scaleThreshold(THRESHOLDS.fragmentationCrisis.watchSpread, leniency, 'high'),
    fail: (latent, leniency) =>
      latent.fragmentation >
      scaleThreshold(THRESHOLDS.fragmentationCrisis.failSpread, leniency, 'high'),
    summary:
      'Sovereign spreads widened disorderly, the single policy rate stopped ' +
      'reaching parts of the currency area, and monetary union transmission broke.',
    warning: 'Sovereign spreads are widening in a way that impairs transmission.',
  },
  {
    id: 'currency_dysfunction',
    label: 'Currency and market dysfunction',
    meetingsToFail: THRESHOLDS.currencyDysfunction.meetingsToFail,
    watch: (latent, leniency) =>
      latent.marketVolatility >
      scaleThreshold(THRESHOLDS.currencyDysfunction.watchVolatility, leniency, 'high'),
    fail: (latent, leniency) =>
      latent.marketVolatility >
        scaleThreshold(
          THRESHOLDS.currencyDysfunction.failVolatility,
          leniency,
          'high',
        ) &&
      Math.abs(latent.exchangeRate - EXCHANGE.baseline) >
        scaleThreshold(
          THRESHOLDS.currencyDysfunction.failExchangeRateMove,
          leniency,
          'high',
        ),
    summary:
      'Markets stopped functioning: volatility went to extremes and the currency ' +
      'moved far enough to make orderly pricing impossible.',
    warning: 'Market volatility is at dysfunctional levels.',
  },
  {
    id: 'loss_of_monetary_control',
    label: 'Loss of monetary control',
    meetingsToFail: THRESHOLDS.lossOfMonetaryControl.meetingsToFail,
    watch: (latent, leniency) =>
      latent.anchoring <
      scaleThreshold(THRESHOLDS.lossOfMonetaryControl.watchAnchoring, leniency, 'low'),
    fail: (latent, leniency, target) =>
      latent.anchoring <
        scaleThreshold(
          THRESHOLDS.lossOfMonetaryControl.failAnchoring,
          leniency,
          'low',
        ) &&
      Math.abs(latent.expectedInflationLong - target) >
        scaleThreshold(
          THRESHOLDS.lossOfMonetaryControl.failExpectationsMiss,
          leniency,
          'high',
        ),
    summary:
      'Long-run expectations came unpinned from the target. Once the anchor is ' +
      'gone the policy rate no longer sets the inflation the economy plans for.',
    warning: 'Long-run inflation expectations are slipping away from the target.',
  },
  {
    id: 'dismissed',
    label: 'Forced resignation',
    meetingsToFail: THRESHOLDS.dismissal.meetingsToFail,
    watch: (latent, leniency) =>
      latent.credibility <
        scaleThreshold(THRESHOLDS.dismissal.watchCredibility, leniency, 'low') ||
      latent.politicalPressure >
        scaleThreshold(THRESHOLDS.dismissal.watchPoliticalPressure, leniency, 'high'),
    // Political pressure alone never dismisses anyone. Only a sustained
    // collapse in credibility does, and only after four consecutive meetings.
    fail: (latent, leniency) =>
      latent.credibility <
      scaleThreshold(THRESHOLDS.dismissal.failCredibility, leniency, 'low'),
    summary:
      'Institutional credibility collapsed and stayed collapsed. The mandate was ' +
      'ended early — not over any single decision, but over a sustained loss of ' +
      'confidence in the institution.',
    warning: 'Institutional standing is deteriorating badly.',
  },
]

/** Unnormalised contributors, later scaled so the chain sums to one. */
interface RawFactor {
  readonly label: string
  readonly weight: number
  readonly detail: string
}

function contributors(state: SimulationState, id: EndConditionId): RawFactor[] {
  const latent = state.latent
  const target = getInstitution(state.config.institution).inflationTarget
  const gap = realRateGap(latent)
  const broken = state.guidance.brokenPromises

  const shared: RawFactor[] = [
    {
      label: 'Policy stance',
      weight: Math.abs(gap) * 1.2,
      detail:
        gap < 0
          ? `The real policy rate sat ${Math.abs(gap).toFixed(2)} points below neutral, adding stimulus.`
          : `The real policy rate sat ${gap.toFixed(2)} points above neutral, restricting demand.`,
    },
    {
      label: 'Expectations anchor',
      weight: (1 - latent.anchoring) * 3,
      detail: `Anchoring stood at ${latent.anchoring.toFixed(2)}, against 1.00 for fully pinned expectations.`,
    },
  ]

  switch (id) {
    case 'inflation_spiral':
      return [
        ...shared,
        {
          label: 'Cost-push shocks',
          weight: Math.max(0, latent.supplyShock) * 1.5,
          detail: 'Persistent supply-side cost pressure kept feeding headline prices.',
        },
        {
          label: 'Demand pressure',
          weight: Math.max(0, latent.outputGap) * 0.8,
          detail: 'The economy ran above potential, adding domestic price pressure.',
        },
        {
          label: 'Wage-price dynamics',
          weight: Math.max(0, latent.wageGrowth - latent.potentialGrowth - target) * 0.9,
          detail: 'Wage growth ran well above what productivity and the target could absorb.',
        },
      ]
    case 'deflation_spiral':
      return [
        ...shared,
        {
          label: 'Demand shortfall',
          weight: Math.max(0, -latent.outputGap) * 1.1,
          detail: 'The economy ran persistently below potential.',
        },
        {
          label: 'Effective lower bound',
          weight: latent.policyRate < 0.5 ? 3 : 0.5,
          detail: 'With the policy rate at its floor, real rates rose as prices fell.',
        },
      ]
    case 'depression':
      return [
        ...shared,
        {
          label: 'Credit contraction',
          weight: Math.max(0, -latent.creditGrowth) * 0.8,
          detail: 'Credit contracted, amplifying the downturn through the accelerator.',
        },
        {
          label: 'Financial conditions',
          weight: Math.max(0, latent.creditSpread - 1.1) * 1.5,
          detail: 'Wide spreads kept financing costly for firms and households.',
        },
        {
          label: 'Banking impairment',
          weight: (latent.bankingStress / 100) * 2.5,
          detail: 'A stressed banking system could not support lending through the downturn.',
        },
      ]
    case 'banking_crisis':
      return [
        ...shared,
        {
          label: 'Speed of tightening',
          weight: Math.max(0, gap) * 1.8,
          detail: 'Rapid tightening imposed duration losses across bank balance sheets.',
        },
        {
          label: 'Asset price unwind',
          weight: Math.max(0, -latent.assetPricePressure) * 0.05 + 1,
          detail: 'The unwinding of an earlier valuation boom crystallised losses.',
        },
        {
          label: 'Liquidity support',
          weight: 2,
          detail: 'Emergency facilities were not escalated far enough, or early enough.',
        },
      ]
    case 'fragmentation_crisis':
      return [
        ...shared,
        {
          label: 'Sovereign debt pressure',
          weight: (latent.debtPressure / 100) * 3,
          detail: 'Elevated sovereign debt burdens made spreads sensitive to any tightening.',
        },
        {
          label: 'Market volatility',
          weight: Math.max(0, latent.marketVolatility - VOLATILITY.base) * 0.06,
          detail: 'Volatile markets amplified the flight to the safest sovereign issuers.',
        },
        {
          label: 'Transmission protection',
          weight: state.stance.transmissionProtection === 0 ? 3 : 0.5,
          detail:
            state.stance.transmissionProtection === 0
              ? 'The transmission protection instrument was never deployed.'
              : 'Transmission protection was deployed but could not contain the widening.',
        },
      ]
    case 'currency_dysfunction':
      return [
        ...shared,
        {
          label: 'Geopolitical risk',
          weight: (latent.geopoliticalRisk / 100) * 2.5,
          detail: 'Elevated geopolitical risk drove disorderly cross-border flows.',
        },
        {
          label: 'Rate differential',
          weight: Math.abs(gap) * 1.0,
          detail: 'A wide real rate gap against the rest of the world moved the currency hard.',
        },
      ]
    case 'loss_of_monetary_control':
      return [
        ...shared,
        {
          label: 'Sustained target miss',
          weight: Math.abs(latent.inflationHeadline - target) * 1.2,
          detail: 'Inflation stayed far from target long enough for expectations to follow it.',
        },
        {
          label: 'Communication consistency',
          weight: broken * 1.5,
          detail:
            broken > 0
              ? `Guidance was reversed without justification ${broken} time(s), teaching markets to discount it.`
              : 'Guidance was consistent, but not enough to hold the anchor alone.',
        },
      ]
    case 'dismissed':
      return [
        ...shared,
        {
          label: 'Public trust',
          weight: ((100 - latent.publicTrust) / 100) * 3,
          detail: `Public trust fell to ${latent.publicTrust.toFixed(0)} as households absorbed the cost of living and unemployment.`,
        },
        {
          label: 'Political pressure',
          weight: (latent.politicalPressure / 100) * 2,
          detail: `Political pressure reached ${latent.politicalPressure.toFixed(0)}.`,
        },
        {
          label: 'Broken guidance',
          weight: broken * 1.8,
          detail:
            broken > 0
              ? `${broken} unjustified guidance reversal(s) eroded the institution's word.`
              : 'Guidance was kept, but performance alone had already cost the institution its standing.',
        },
      ]
    case 'mandate_completed':
      return []
  }
}

/** Normalises contributors into a ranked chain summing to one. */
function buildCausalChain(
  state: SimulationState,
  id: EndConditionId,
): readonly CausalFactor[] {
  const raw = contributors(state, id).filter((factor) => factor.weight > 0.01)
  const total = raw.reduce((sum, factor) => sum + factor.weight, 0)
  if (total <= 0) return []

  return raw
    .map((factor) => ({
      label: factor.label,
      contribution: factor.weight / total,
      detail: factor.detail,
    }))
    .sort((a, b) => b.contribution - a.contribution)
}

export function evaluateEndConditions(
  state: SimulationState,
  previousCounters: Readonly<Record<string, number>> = {},
): EndConditionResult {
  const difficulty = getDifficulty(state.config.difficulty)
  const leniency = difficulty.thresholdLeniency
  const target = getInstitution(state.config.institution).inflationTarget
  const latent = state.latent

  const applicable = CONDITIONS.filter(
    (condition) =>
      condition.institutions === undefined ||
      condition.institutions.includes(state.config.institution),
  )

  const breachCounters: Record<string, number> = {}
  const warnings: EndConditionWarning[] = []
  let triggered: ConditionDefinition | null = null

  for (const condition of applicable) {
    const failing = condition.fail(latent, leniency, target)
    const held = failing ? (previousCounters[condition.id] ?? 0) + 1 : 0
    breachCounters[condition.id] = held

    const needed = condition.meetingsToFail + difficulty.breachPatience

    if (held >= needed && triggered === null) {
      triggered = condition
      continue
    }

    if (failing || condition.watch(latent, leniency, target)) {
      warnings.push({
        id: condition.id,
        label: condition.label,
        message: condition.warning,
        severity: failing ? 'severe' : 'watch',
        meetingsHeld: held,
        meetingsToTrigger: needed,
      })
    }
  }

  if (triggered !== null) {
    return {
      status: 'failed',
      triggered: triggered.id,
      label: triggered.label,
      summary: triggered.summary,
      causalChain: buildCausalChain(state, triggered.id),
      warnings,
      breachCounters,
    }
  }

  // Completion is checked last: surviving to the end of a mandate that was
  // already lost on the final meeting should still count as the failure.
  if (state.meetingIndex >= state.config.meetingCount) {
    return {
      status: 'completed',
      triggered: 'mandate_completed',
      label: 'Mandate completed',
      summary: 'The full mandate was served to its scheduled end.',
      causalChain: [],
      warnings,
      breachCounters,
    }
  }

  return {
    status: 'active',
    triggered: null,
    label: null,
    summary: null,
    causalChain: [],
    warnings,
    breachCounters,
  }
}
