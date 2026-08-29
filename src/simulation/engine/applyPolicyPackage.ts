import type { DiagnosticEvent } from '../types/core.ts'
import type {
  GuidanceState,
  PolicyContradiction,
  PolicyPackage,
  PolicyRejection,
  PolicyStance,
  PolicyValidation,
} from '../types/policy.ts'
import type { LatentState, SimulationState } from '../types/state.ts'
import { clamp, clampLatentState } from '../config/bounds.ts'
import { getDifficulty, meetsDifficulty } from '../config/difficulty.ts'
import { getInstitution } from '../config/institutions.ts'
import {
  COMMUNICATION_AVAILABILITY,
  POLICY_RATE_FLOOR,
  getInstrument,
  getInstrumentRange,
} from '../config/instruments.ts'
import { BANKING, COMMUNICATION, INSTITUTIONAL, VOLATILITY } from '../config/model.ts'
import { GUIDANCE_REVERSAL_JUSTIFICATION } from '../config/thresholds.ts'
import { effectivePolicyRate } from './initialState.ts'

/**
 * Validating and applying a confirmed policy package.
 *
 * Validation is total: an action that is unknown, unavailable to this
 * institution, locked at this difficulty, duplicated, non-finite, out of
 * bounds, off the allowed increment, or that would push the rate through its
 * floor is rejected and the package is not applied at all.
 *
 * Contradictions are different. An internally inconsistent package — easing
 * the rate while draining the balance sheet, talking hawkish while cutting —
 * is a legitimate choice the player may have reasons for. It is reported so
 * the confirmation screen can show it, and it costs credibility when
 * confirmed, but it never blocks the decision.
 */

export type PolicyApplication =
  | {
      readonly ok: true
      readonly state: SimulationState
      readonly validation: PolicyValidation
    }
  | { readonly ok: false; readonly validation: PolicyValidation }

/** Floating-point-tolerant multiple check for instrument increments. */
function isMultipleOf(value: number, increment: number): boolean {
  if (increment <= 0) return true
  const ratio = value / increment
  return Math.abs(ratio - Math.round(ratio)) < 1e-6
}

function magnitudeOf(
  pkg: PolicyPackage,
  instrument: string,
): number | undefined {
  return pkg.actions.find((action) => action.instrument === instrument)?.magnitude
}

export function validatePolicyPackage(
  state: SimulationState,
  pkg: PolicyPackage,
): PolicyValidation {
  const { institution, difficulty } = state.config
  const rejections: PolicyRejection[] = []
  const seen = new Set<string>()

  for (const action of pkg.actions) {
    const definition = getInstrument(action.instrument)

    if (!definition) {
      rejections.push({
        instrument: action.instrument,
        code: 'unknown_instrument',
        message: `"${action.instrument}" is not a recognised instrument.`,
      })
      continue
    }

    if (seen.has(action.instrument)) {
      rejections.push({
        instrument: action.instrument,
        code: 'duplicate_instrument',
        message: `${definition.label[institution]} was set more than once in this package.`,
      })
      continue
    }
    seen.add(action.instrument)

    if (!definition.availableTo.includes(institution)) {
      rejections.push({
        instrument: action.instrument,
        code: 'unavailable_for_institution',
        message: `${definition.id} is not part of the ${getInstitution(institution).shortName} toolkit.`,
      })
      continue
    }

    if (!meetsDifficulty(difficulty, definition.availableFrom)) {
      rejections.push({
        instrument: action.instrument,
        code: 'unavailable_at_difficulty',
        message: `${definition.label[institution]} unlocks at ${definition.availableFrom} difficulty.`,
      })
      continue
    }

    if (!Number.isFinite(action.magnitude)) {
      rejections.push({
        instrument: action.instrument,
        code: 'non_finite_magnitude',
        message: `${definition.label[institution]} was given a value that is not a finite number.`,
      })
      continue
    }

    const range = getInstrumentRange(definition, difficulty)
    if (action.magnitude < range.min) {
      rejections.push({
        instrument: action.instrument,
        code: 'below_minimum',
        message: `${definition.label[institution]} cannot go below ${range.min}.`,
      })
      continue
    }
    if (action.magnitude > range.max) {
      rejections.push({
        instrument: action.instrument,
        code: 'above_maximum',
        message: `${definition.label[institution]} cannot go above ${range.max}.`,
      })
      continue
    }
    if (!isMultipleOf(action.magnitude, range.increment)) {
      rejections.push({
        instrument: action.instrument,
        code: 'invalid_increment',
        message: `${definition.label[institution]} moves in steps of ${range.increment}.`,
      })
      continue
    }

    if (action.instrument === 'policy_rate') {
      const resulting = state.stance.targetRate + action.magnitude / 100
      const floor = POLICY_RATE_FLOOR[institution]
      if (resulting < floor - 1e-9) {
        rejections.push({
          instrument: action.instrument,
          code: 'effective_rate_below_floor',
          message: `That move would set the policy rate at ${resulting.toFixed(2)} %, below the ${floor.toFixed(2)} % effective lower bound.`,
        })
      }
    }
  }

  const availability = COMMUNICATION_AVAILABILITY[difficulty]
  const communication = pkg.communication
  if (communication) {
    if (!availability.channels.includes(communication.channel)) {
      rejections.push({
        instrument: null,
        code: 'channel_unavailable_at_difficulty',
        message: `The ${communication.channel.replace('_', ' ')} channel is not available at ${difficulty} difficulty.`,
      })
    }
    if (!availability.commitments.includes(communication.commitment)) {
      rejections.push({
        instrument: null,
        code: 'communication_unavailable_at_difficulty',
        message: `A ${communication.commitment.replace('_', ' ')} is not available at ${difficulty} difficulty.`,
      })
    }
  }

  return {
    ok: rejections.length === 0,
    rejections,
    contradictions: rejections.length === 0 ? detectContradictions(state, pkg) : [],
  }
}

/** Internally inconsistent combinations. Reported, priced, never blocked. */
export function detectContradictions(
  state: SimulationState,
  pkg: PolicyPackage,
): readonly PolicyContradiction[] {
  const contradictions: PolicyContradiction[] = []

  const rateMove = (magnitudeOf(pkg, 'policy_rate') ?? 0) / 100
  const purchases = magnitudeOf(pkg, 'asset_purchases') ?? state.stance.assetPurchasePace
  const runoff = magnitudeOf(pkg, 'balance_sheet_runoff') ?? state.stance.runoffPace

  if (purchases > 0 && runoff > 0) {
    contradictions.push({
      code: 'purchases_and_runoff_together',
      message:
        'The package buys assets and lets the portfolio run off at the same time. ' +
        'Markets read this as an institution arguing with itself.',
      severity: 0.6,
    })
  }

  if (rateMove < -0.1 && runoff > 0) {
    contradictions.push({
      code: 'easing_rate_while_tightening_balance_sheet',
      message:
        'Cutting the policy rate while draining the balance sheet sends opposite ' +
        'signals through the rate and asset-price channels.',
      severity: 0.4,
    })
  }

  if (rateMove > 0.1 && purchases > 0) {
    contradictions.push({
      code: 'tightening_rate_while_expanding_balance_sheet',
      message:
        'Raising the policy rate while expanding the balance sheet sends opposite ' +
        'signals through the rate and asset-price channels.',
      severity: 0.4,
    })
  }

  const communication = pkg.communication
  if (communication) {
    const tone = COMMUNICATION.toneSignal[communication.tone]
    if (tone > 0.2 && rateMove < -0.1) {
      contradictions.push({
        code: 'hawkish_guidance_with_rate_cut',
        message: 'The statement reads hawkish while the decision cuts the policy rate.',
        severity: 0.7,
      })
    }
    if (tone < -0.2 && rateMove > 0.1) {
      contradictions.push({
        code: 'dovish_guidance_with_rate_hike',
        message: 'The statement reads dovish while the decision raises the policy rate.',
        severity: 0.7,
      })
    }

    const prior = state.guidance
    const guidanceMove = magnitudeOf(pkg, 'forward_guidance')
    if (
      communication.commitment === 'strong_commitment' &&
      prior.impliedRatePath !== null &&
      COMMUNICATION.commitmentWeight[prior.commitment] >= 0.65 &&
      guidanceMove !== undefined
    ) {
      const priorDirection = Math.sign(prior.impliedRatePath - state.latent.policyRate)
      const newDirection = Math.sign(guidanceMove)
      if (priorDirection !== 0 && newDirection !== 0 && priorDirection !== newDirection) {
        contradictions.push({
          code: 'strong_commitment_reverses_recent_strong_commitment',
          message:
            'This binds the institution to a path opposite to the one it committed ' +
            'to at a recent meeting.',
          severity: 1.0,
        })
      }
    }
  }

  const stressed = state.latent.bankingStress > BANKING.base * 1.8
  const escalations =
    (magnitudeOf(pkg, 'discount_window') ?? 0) +
    (magnitudeOf(pkg, 'swap_lines') ?? 0) +
    (magnitudeOf(pkg, 'transmission_protection') ?? 0)
  if (!stressed && escalations >= 2) {
    contradictions.push({
      code: 'liquidity_support_without_stress',
      message:
        'Escalating emergency facilities into a calm system invites markets to ask ' +
        'what the central bank can see that they cannot.',
      severity: 0.5,
    })
  }

  return contradictions
}

/**
 * Folds a package into the standing stance.
 *
 * `policy_rate` and `forward_guidance` are expressed as a change in basis
 * points; every other instrument sets a level that stays in force until the
 * player changes it.
 */
function deriveStance(state: SimulationState, pkg: PolicyPackage): PolicyStance {
  const stance = { ...state.stance }

  for (const action of pkg.actions) {
    switch (action.instrument) {
      case 'policy_rate':
        stance.targetRate = state.stance.targetRate + action.magnitude / 100
        break
      case 'asset_purchases':
        stance.assetPurchasePace = action.magnitude
        break
      case 'balance_sheet_runoff':
        stance.runoffPace = action.magnitude
        break
      case 'forward_guidance':
        // Recorded in the guidance state, not in the standing stance.
        break
      case 'iorb_spread':
        stance.iorbSpread = action.magnitude
        break
      case 'discount_window':
        stance.discountWindowLevel = action.magnitude
        break
      case 'reverse_repo':
        stance.reverseRepoLevel = action.magnitude
        break
      case 'swap_lines':
        stance.swapLinesLevel = action.magnitude
        break
      case 'deposit_facility_spread':
        stance.depositFacilitySpread = action.magnitude
        break
      case 'minimum_reserves':
        stance.minimumReserves = action.magnitude
        break
      case 'targeted_refinancing':
        stance.targetedRefinancing = action.magnitude
        break
      case 'transmission_protection':
        stance.transmissionProtection = action.magnitude
        break
    }
  }

  return stance
}

/**
 * Combined inflation and output-gap surprise since a past meeting.
 *
 * Used to decide whether reversing published guidance was forced by events or
 * was simply a change of mind.
 */
function shockSince(state: SimulationState, meetingIndex: number): number {
  const snapshot = state.history.find((entry) => entry.meetingIndex === meetingIndex)
  if (!snapshot) return 0
  return (
    Math.abs(state.latent.inflationHeadline - snapshot.latent.inflationHeadline) +
    Math.abs(state.latent.outputGap - snapshot.latent.outputGap)
  )
}

export function applyPolicyPackage(
  state: SimulationState,
  pkg: PolicyPackage,
): PolicyApplication {
  const validation = validatePolicyPackage(state, pkg)
  if (!validation.ok) return { ok: false, validation }

  const difficulty = getDifficulty(state.config.difficulty)
  const sensitivity = difficulty.credibilitySensitivity
  const stance = deriveStance(state, pkg)

  const previousRate = state.latent.policyRate
  const newRate = effectivePolicyRate(stance, state.config.institution)
  const actualMove = newRate - previousRate

  const latent: LatentState = {
    ...state.latent,
    policyRate: newRate,
    balanceSheetFlow: stance.assetPurchasePace - stance.runoffPace,
  }

  // ---- Policy surprise ----------------------------------------------------
  // Markets front-run part of the path they have priced; the surprise is what
  // the decision does beyond that.
  const expectedMove = clamp(
    (state.latent.marketExpectedRate - previousRate) * 0.35,
    -1.5,
    1.5,
  )
  const surprise = actualMove - expectedMove
  latent.marketVolatility += VOLATILITY.policySurprise * Math.abs(surprise) * 0.5
  latent.marketTrust -=
    INSTITUTIONAL.marketTrust.surprise * Math.abs(surprise) * 0.25 * sensitivity

  // ---- Communication ------------------------------------------------------
  const communication = pkg.communication
  if (communication) {
    const reach = COMMUNICATION.channelReach[communication.channel]
    const credibilityShare = latent.credibility / 100
    const tone = COMMUNICATION.toneSignal[communication.tone]

    latent.marketExpectedRate +=
      COMMUNICATION.toneMarketImpact * tone * reach * credibilityShare
    latent.expectedInflationShort -=
      COMMUNICATION.toneExpectationImpact * tone * reach * credibilityShare
    latent.anchoring = clamp(
      latent.anchoring +
        COMMUNICATION.emphasisAnchoringSupport[communication.emphasis] *
          reach *
          credibilityShare,
      0,
      1,
    )

    if (communication.tone === 'alarmed') {
      latent.marketVolatility += COMMUNICATION.alarmVolatility * reach
    }
    if (communication.tone === 'reassuring' && latent.bankingStress > BANKING.base * 2) {
      latent.publicTrust += COMMUNICATION.reassuranceTrust * reach
    }
  }

  // ---- Guidance consistency ----------------------------------------------
  const prior = state.guidance
  let brokenPromises = prior.brokenPromises
  let keptPromises = prior.keptPromises

  if (
    prior.impliedRatePath !== null &&
    COMMUNICATION.commitmentWeight[prior.commitment] >= 0.65
  ) {
    const promisedRemaining = prior.impliedRatePath - previousRate
    const contradicts =
      Math.abs(actualMove) >= 0.2 &&
      Math.sign(promisedRemaining) !== 0 &&
      Math.sign(actualMove) !== Math.sign(promisedRemaining)

    if (contradicts) {
      const justified =
        shockSince(state, prior.issuedAtMeeting) >= GUIDANCE_REVERSAL_JUSTIFICATION
      if (!justified) {
        brokenPromises += 1
        latent.credibility -=
          INSTITUTIONAL.credibility.brokenPromise * sensitivity
        latent.marketTrust -= INSTITUTIONAL.marketTrust.brokenPromise
      }
    } else {
      keptPromises += 1
    }
  }

  const guidanceMove = magnitudeOf(pkg, 'forward_guidance')
  const guidance: GuidanceState =
    guidanceMove === undefined
      ? { ...prior, brokenPromises, keptPromises }
      : {
          impliedRatePath: newRate + guidanceMove / 100,
          commitment: communication?.commitment ?? 'weak_bias',
          tone: communication?.tone ?? 'neutral',
          issuedAtMeeting: state.meetingIndex,
          brokenPromises,
          keptPromises,
        }

  // ---- Cost of an internally contradictory package ------------------------
  let contradictionCost = 0
  for (const contradiction of validation.contradictions) {
    contradictionCost += contradiction.severity
  }
  if (contradictionCost > 0) {
    latent.credibility -=
      COMMUNICATION.inconsistencyCost * contradictionCost * sensitivity
    latent.marketTrust -= COMMUNICATION.inconsistencyCost * contradictionCost
  }

  const diagnostics: DiagnosticEvent[] = []
  const clamped = clampLatentState(latent, state.stepIndex, diagnostics)

  return {
    ok: true,
    validation,
    state: {
      ...state,
      latent: clamped,
      stance,
      guidance,
      diagnostics:
        diagnostics.length > 0
          ? [...state.diagnostics, ...diagnostics]
          : state.diagnostics,
    },
  }
}
