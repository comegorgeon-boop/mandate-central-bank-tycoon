import type { Institution } from '../types/core.ts'
import type {
  CausalFactor,
  EndConditionId,
  EndConditionResult,
  EndConditionWarning,
} from '../types/scoring.ts'
import type { LatentState, SimulationState } from '../types/state.ts'
import { getDifficulty } from '../config/difficulty.ts'
import { EXCHANGE, VOLATILITY } from '../config/model.ts'
import type { ThresholdSet } from '../config/thresholds.ts'
import { inflationTargetFor, thresholdsFor } from '../scenarios/scenarios.ts'
import { tutorialExhausted, tutorialProgress } from './tutorialGoal.ts'
import {
  COUNCIL,
  HEARING,
  TENURE,
  atTermEnd,
  hearingBar,
  termOf,
} from '../config/tenure.ts'
import { realRateGap, unemploymentGap } from '../engine/indices.ts'
import { dispersion } from '../engine/members.ts'

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
 *
 * `limit` caps the result, and is required wherever the variable is itself
 * bounded. Banking stress and market volatility are 0-100 indices, so an
 * unbounded 1.45x leniency would push their failure thresholds past 100 and
 * make those catastrophes literally unreachable on easy — forgiving is the
 * intent, impossible is not.
 */
function scaleThreshold(
  threshold: number,
  leniency: number,
  direction: 'high' | 'low',
  limit?: number,
): number {
  const scaled =
    direction === 'high'
      ? threshold * leniency
      : threshold > 0
        ? threshold / leniency
        : threshold * leniency

  if (limit === undefined) return scaled
  return direction === 'high' ? Math.min(scaled, limit) : Math.max(scaled, limit)
}

/** Reachable ceilings for the 0-100 indices, kept just below their bound. */
const STRESS_CEILING = 95
const VOLATILITY_CEILING = 96

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

/**
 * The conditions, read against whichever thresholds are in force.
 *
 * A function rather than a constant because a historical scenario brings its
 * own. The fictional thresholds are calibrated on a fictional economy, and
 * 1979 would fail three of them on the first meeting — inflation opens at
 * 11.84 % against a spiral threshold of 12, and long-run expectations open
 * five points above target against a loss-of-control threshold of four. A
 * scenario that ended before the player's first decision would be saying that
 * August 1979 was already lost, which is both false and the opposite of what
 * the scenario is for. See `docs/SCENARIOS.md`.
 */
function conditionsFor(THRESHOLDS: ThresholdSet): readonly ConditionDefinition[] {
  return [
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
      scaleThreshold(
        THRESHOLDS.bankingCrisis.failStress,
        leniency,
        'high',
        STRESS_CEILING,
      ),
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
          VOLATILITY_CEILING,
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
  {
    // Scenario only, and it is how you lose a disinflation.
    //
    // Not unpopularity, which this mandate has in quantity and survives, and
    // not a bad quarter. Giving in: the real policy rate back below zero
    // while long-run expectations are still far above the objective, held
    // long enough to be a policy rather than a slip. That is the trap of 1980
    // — the funds rate fell from 17.19 % in March to 9.03 % in July while
    // expectations had not moved — and it is the one thing Volcker did not do
    // twice. A player who does it has bought a recession and spent it.
    //
    // Stated on the real rate rather than on the size of the cut, which is
    // both better economics and the only version that survives reserve
    // targeting: under that procedure the realised rate moves without anybody
    // voting for it, and charging a player for a fall they did not choose
    // would be scoring them on the procedure rather than on the decision.
    id: 'gave_in',
    // The label says the *mechanism*, not the story, and that is a correction
    // rather than a preference. It read "The disinflation was abandoned",
    // which is exactly right for 1979-83 and false for 1972-74 — a mandate
    // that opens at 3.3 % inflation has no disinflation under way to abandon,
    // and the screen told a player who had just watched prices triple that
    // they had given up on bringing them down. The condition itself is the
    // same in both periods and is the right one for both: real rates below
    // zero while the anchor is adrift. The period-specific story is carried by
    // the written account above it, which names the embargo or the oil shock
    // as the case may be.
    label: 'Real rates were left below zero',
    meetingsToFail: THRESHOLDS.capitulation.meetingsToFail,
    watch: (latent, _leniency, target) =>
      latent.policyRate - latent.expectedInflationShort <
        THRESHOLDS.capitulation.watchRealRate &&
      latent.expectedInflationLong - target > THRESHOLDS.capitulation.unanchoredBy &&
      latent.inflationHeadline - target > THRESHOLDS.capitulation.inflationStillAbove,
    fail: (latent, _leniency, target) =>
      latent.policyRate - latent.expectedInflationShort <
        THRESHOLDS.capitulation.failRealRate &&
      latent.expectedInflationLong - target > THRESHOLDS.capitulation.unanchoredBy &&
      latent.inflationHeadline - target > THRESHOLDS.capitulation.inflationStillAbove,
    summary:
      'With expectations already adrift and inflation far above the ' +
      'objective, real short rates were allowed below zero and left there — ' +
      'which makes borrowing free again in exactly the conditions that make ' +
      'it expensive for a reason. Whatever the policy had cost up to that ' +
      'point was spent rather than banked.',
    warning:
      'Real short rates are near zero while expectations are still ' +
      'unanchored. Held there, this is a policy rather than a pause.',
  },
  ]
}

/** Unnormalised contributors, later scaled so the chain sums to one. */
interface RawFactor {
  readonly label: string
  readonly weight: number
  readonly detail: string
}

function contributors(state: SimulationState, id: EndConditionId): RawFactor[] {
  const latent = state.latent
  const target = inflationTargetFor(state.config)
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
    case 'not_reappointed':
      return [
        ...shared,
        {
          label: 'Political pressure',
          weight: (latent.politicalPressure / 100) * 3.2,
          detail:
            `Political pressure stood at ${latent.politicalPressure.toFixed(0)} at the ` +
            'hearing. A Chair the administration has spent a term resenting is a ' +
            'Chair it does not have to renew.',
        },
        {
          label: 'Standing at the hearing',
          weight: ((100 - latent.credibility) / 100) * 3,
          detail:
            `Credibility stood at ${latent.credibility.toFixed(0)}, against a bar of ` +
            `${hearingBar(latent.politicalPressure).toFixed(0)} given that pressure.`,
        },
        {
          label: 'Broken guidance',
          weight: broken * 1.8,
          detail:
            broken > 0
              ? `${broken} unjustified guidance reversal(s) were read out at the hearing.`
              : 'Guidance was kept. The record was not what lost the hearing.',
        },
      ]
    case 'reappointed':
      return []
    case 'council_lost':
      return [
        ...shared,
        {
          label: 'The Council came apart',
          weight: 3.4,
          detail:
            'Members stopped converging. A president who cannot carry the ' +
            'Governing Council is finished in substance whatever the Treaty says — ' +
            'which is what Weber and Stark demonstrated in 2011.',
        },
        {
          label: 'Fragmentation',
          weight: Math.max(0, (latent.fragmentation - 150) / 100) * 2.5,
          detail: `Sovereign spreads across the area reached ${latent.fragmentation.toFixed(0)} basis points.`,
        },
        {
          label: 'Broken guidance',
          weight: broken * 1.4,
          detail:
            broken > 0
              ? `${broken} unjustified guidance reversal(s) cost the chair its authority in the room.`
              : 'Guidance was kept. What was lost was the argument, not the word.',
        },
      ]
    case 'gave_in':
      return [
        ...shared,
        {
          label: 'The anchor never moved',
          weight: Math.max(0, latent.expectedInflationLong - target) * 2,
          detail:
            `Long-run expectations were still ${(latent.expectedInflationLong - target).toFixed(1)} ` +
            'points above the objective when policy turned. Nothing had been ' +
            'bought with the recession that had been paid for.',
        },
        {
          label: 'The real rate',
          weight: Math.max(0, latent.expectedInflationShort - latent.policyRate) * 1.5,
          detail:
            `Short rates of ${latent.policyRate.toFixed(2)} % against expected inflation of ` +
            `${latent.expectedInflationShort.toFixed(2)} % left borrowing free in real terms.`,
        },
        {
          label: 'Political pressure',
          weight: (latent.politicalPressure / 100) * 2,
          detail: `Political pressure reached ${latent.politicalPressure.toFixed(0)}.`,
        },
      ]
    // Endings with no causal chain to build: nothing went wrong, so there is
    // nothing to attribute.
    case 'mandate_completed':
    case 'objective_met':
    case 'objective_missed':
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
  const target = inflationTargetFor(state.config)
  const latent = state.latent
  const thresholds = thresholdsFor(state.config)

  const applicable = conditionsFor(thresholds).filter(
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

  // The tutorial ends on its goal, not on a clock — and, like completion
  // below, only after the catastrophes have had their say: reaching the
  // objective on the meeting the banking system fails is still a failure.
  const tutorial = tutorialProgress(state)
  if (tutorial !== null) {
    if (tutorial.passed) {
      return {
        status: 'completed',
        triggered: 'objective_met',
        label: 'Objective met',
        summary:
          `Inflation was brought below ${tutorial.inflationBelow.toFixed(1)} % and ` +
          `unemployment below ${tutorial.unemploymentBelow.toFixed(1)} %, and held ` +
          `there for ${tutorial.meetingsNeeded} consecutive meetings. That is the ` +
          'whole job, done.',
        causalChain: [],
        warnings,
        breachCounters,
      }
    }
    if (tutorialExhausted(tutorial)) {
      return {
        status: 'completed',
        triggered: 'objective_missed',
        label: 'Objective not reached',
        summary:
          `After ${tutorial.meetingsPlayed} meetings the economy was still short of ` +
          `the objective: inflation at ${tutorial.inflation.toFixed(2)} % against ` +
          `${tutorial.inflationBelow.toFixed(1)} %, unemployment at ` +
          `${tutorial.unemployment.toFixed(2)} % against ` +
          `${tutorial.unemploymentBelow.toFixed(1)} %. Nothing collapsed; it simply ` +
          'was not repaired.',
        causalChain: [],
        warnings,
        breachCounters,
      }
    }
    // A tutorial has no scheduled end, so nothing below applies to it.
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

  /*
   * ── Survival ────────────────────────────────────────────────────────────
   *
   * A fictional mandate has no scheduled end. What it has is a *term*, and at
   * the end of a term the two institutions do something completely different
   * — which is the whole reason the structure changed. See `config/tenure.ts`.
   *
   * A scenario is exempt: 1929-33 is thirty meetings because it is a date
   * range, and a calendar is not a setting. It falls through to completion
   * below, as it always has.
   */
  const fictional = state.config.scenario === null
  const institution = state.config.institution
  const tenure = TENURE[institution]

  /*
   * ── The ECB: the Council stops following you ────────────────────────────
   *
   * Checked every meeting rather than at a term boundary, because that is how
   * it happens: not a vote lost on the day but a room that has drifted too far
   * for too long. There is no reappointment to withhold, so this is the only
   * way an ECB presidency ends other than the catastrophes above.
   */
  if (fictional && institution === 'ecb' && state.members.length > 0) {
    const spread = dispersion(state.members, 'inflationOffset')
    const fracturing =
      spread >= COUNCIL.fractureDispersion &&
      latent.fragmentation >= COUNCIL.fractureFragmentation
    const held = fracturing ? (breachCounters.council ?? 0) + 1 : 0
    breachCounters.council = held

    if (held >= COUNCIL.meetingsToFail) {
      return {
        status: 'failed',
        triggered: 'council_lost',
        label: 'The Council was lost',
        summary:
          `For ${COUNCIL.meetingsToFail} consecutive meetings the Governing Council ` +
          `sat ${spread.toFixed(1)} points apart on inflation with spreads at ` +
          `${latent.fragmentation.toFixed(0)} basis points. Nobody can remove you ` +
          'and there is no second term to withhold — but a president who cannot ' +
          'carry the room is finished all the same.',
        causalChain: buildCausalChain(state, 'council_lost'),
        warnings,
        breachCounters,
      }
    }
    if (spread >= COUNCIL.watchDispersion) {
      warnings.push({
        id: 'council_lost',
        label: 'The Council is straining',
        message:
          `Members are ${spread.toFixed(1)} points apart on inflation. You cannot be ` +
          'removed and you cannot be denied a second term. You can lose the room.',
        severity: held > 0 ? 'severe' : 'watch',
        meetingsHeld: held,
        meetingsToTrigger: COUNCIL.meetingsToFail,
      })
    }
  }

  /*
   * ── The Fed: the hearing ────────────────────────────────────────────────
   *
   * At the end of each term, the appointment is renewed or it is not. The bar
   * is standing, raised by the political pressure the term accumulated — so
   * pressure ignored for four years is a bill that arrives here. A Chair
   * handed 1973 and holding the line passes; one handed calm water and
   * whipsawing the rate does not.
   */
  if (fictional && tenure.renewable && atTermEnd(institution, state.meetingIndex)) {
    const bar = hearingBar(latent.politicalPressure)
    const passed = latent.credibility >= bar
    const served = termOf(institution, state.meetingIndex - 1)

    if (!passed) {
      return {
        status: 'failed',
        triggered: 'not_reappointed',
        label: 'Not reappointed',
        summary:
          `The term ended and the appointment was not renewed. Credibility stood at ` +
          `${latent.credibility.toFixed(0)} against a bar of ${bar.toFixed(0)}, which ` +
          `political pressure of ${latent.politicalPressure.toFixed(0)} had raised from ` +
          `${HEARING.baseCredibility}. No Chair has ever been removed; two have been ` +
          'declined a further term, and that is how this one ends.',
        causalChain: buildCausalChain(state, 'not_reappointed'),
        warnings,
        breachCounters,
      }
    }

    // Passed, and there is another term to serve: the run continues. The
    // report never sees this; it is a chapter break inside one mandate.
    if (served < tenure.maxTerms) {
      return {
        status: 'active',
        triggered: 'reappointed',
        label: `Reappointed for a ${served === 1 ? 'second' : 'further'} term`,
        summary:
          `Credibility of ${latent.credibility.toFixed(0)} cleared a bar of ` +
          `${bar.toFixed(0)}. You serve another four years, and from here you are ` +
          'judged against your own first term rather than against what you inherited.',
        causalChain: [],
        warnings,
        breachCounters,
      }
    }
  }

  // Completion is checked last: surviving to the end of a mandate that was
  // already lost on the final meeting should still count as the failure.
  //
  // For a fictional mandate this is now the *horizon* — every term served,
  // every hearing passed — and it is meant to be reached by almost nobody.
  if (state.meetingIndex >= state.config.meetingCount) {
    return {
      status: 'completed',
      triggered: 'mandate_completed',
      label: fictional && tenure.renewable ? 'Served to the last term' : 'Mandate completed',
      summary: fictional
        ? `Every term served and every hearing passed: ${state.meetingIndex} meetings, ` +
          `${(state.meetingIndex / 8).toFixed(0)} years in the office of ${tenure.office}.`
        : 'The full mandate was served to its scheduled end.',
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
