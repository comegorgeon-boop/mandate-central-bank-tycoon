import type { DiagnosticEvent } from '../types/core.ts'
import type {
  GuidanceState,
  InstrumentId,
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
import { BANKING, COMMUNICATION, INSTITUTIONAL, SPREADS, VOLATILITY } from '../config/model.ts'
import {
  GUIDANCE_DELIVERY_TOLERANCE,
  GUIDANCE_HORIZON_MEETINGS,
  GUIDANCE_REVERSAL_JUSTIFICATION,
} from '../config/thresholds.ts'
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

/**
 * How keyed-up markets already are, on a scale where roughly 1 is what one of
 * the event catalog's major crises produces on its own and a genuine pile-up
 * of trouble can exceed it.
 *
 * Read from the state a decision *inherits* — the caller always passes the
 * pre-decision latent — never from anything the decision itself is about to
 * move. This is what makes "reassure at the right moment" a judgement of
 * whether the words matched the moment they were said into, not the moment
 * the decision itself just created.
 */
function crisisIntensity(latent: LatentState): number {
  const volatility = Math.max(0, latent.marketVolatility - VOLATILITY.base) / 25
  const banking = Math.max(0, latent.bankingStress - BANKING.base) / 30
  const spread = Math.max(0, latent.creditSpread - SPREADS.base) / 1.5
  const geopolitical = Math.max(0, latent.geopoliticalRisk - 25) / 45
  return clamp(
    0.4 * volatility + 0.3 * banking + 0.15 * spread + 0.15 * geopolitical,
    0,
    1.6,
  )
}

/**
 * Whether a package does anything beyond words about a live crisis: a rate
 * move, an escalated liquidity or support instrument, or a binding guidance
 * commitment. Used only to judge a reassuring tone — calm words backed by
 * none of this, in a real crisis, are spin rather than reassurance.
 */
function addressesCrisis(pkg: PolicyPackage, priorStance: PolicyStance): boolean {
  const rateMove = magnitudeOf(pkg, 'policy_rate')
  if (rateMove !== undefined && rateMove !== 0) return true

  const escalated = (instrument: InstrumentId, prior: number): boolean => {
    const magnitude = magnitudeOf(pkg, instrument)
    return magnitude !== undefined && magnitude > prior
  }
  if (escalated('discount_window', priorStance.discountWindowLevel)) return true
  if (escalated('swap_lines', priorStance.swapLinesLevel)) return true
  if (escalated('transmission_protection', priorStance.transmissionProtection)) return true
  if (escalated('targeted_refinancing', priorStance.targetedRefinancing)) return true
  const purchases = magnitudeOf(pkg, 'asset_purchases')
  if (purchases !== undefined && purchases > priorStance.assetPurchasePace) return true

  const commitment = pkg.communication?.commitment
  return commitment === 'conditional_path' || commitment === 'strong_commitment'
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

  // How keyed-up markets already are, judged from what the committee
  // inherited walking in — see `crisisIntensity`. Governs how hard every word
  // in this package lands.
  const crisis = crisisIntensity(state.latent)
  const crisisAmplifier = 1 + COMMUNICATION.crisisAmplifier * crisis

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
      COMMUNICATION.toneMarketImpact * tone * reach * credibilityShare * crisisAmplifier
    latent.expectedInflationShort -=
      COMMUNICATION.toneExpectationImpact * tone * reach * credibilityShare * crisisAmplifier
    latent.anchoring = clamp(
      latent.anchoring +
        COMMUNICATION.emphasisAnchoringSupport[communication.emphasis] *
          reach *
          credibilityShare,
      0,
      1,
    )

    if (communication.tone === 'alarmed') {
      latent.marketVolatility += COMMUNICATION.alarmVolatility * reach * crisisAmplifier
    }

    if (communication.tone === 'reassuring' && crisis > COMMUNICATION.reassuranceCrisisFloor) {
      if (addressesCrisis(pkg, state.stance)) {
        // Earned: there is something to reassure people about, and the
        // package backs the words with an actual response to it.
        latent.publicTrust += COMMUNICATION.reassuranceTrust * reach * crisis
        latent.marketTrust += COMMUNICATION.reassuranceMarketTrust * reach * crisis
        latent.marketVolatility -=
          COMMUNICATION.reassuranceVolatilityRelief * reach * crisis
      } else {
        // Hollow: calm words with nothing behind them, during a real crisis —
        // spin, priced like a broken promise rather than earning trust.
        latent.credibility -= COMMUNICATION.hollowReassuranceCost * crisis * sensitivity
        latent.marketTrust -= COMMUNICATION.hollowReassuranceCost * crisis
      }
    }
  } else if (crisis > COMMUNICATION.silenceCrisisThreshold) {
    // Saying nothing at all while markets are in real trouble is a choice,
    // not a neutral default.
    latent.marketTrust -= COMMUNICATION.silenceCrisisCost * crisis
    latent.marketVolatility += COMMUNICATION.silenceCrisisVolatility * crisis
  }

  // ---- The promise ledger --------------------------------------------------
  // Guidance is a promise about where the rate will be roughly a year out,
  // and a binding promise is judged three ways: by the moves made under it, by
  // what replaces it, and at maturity. Three exploits this block closes, each
  // of which made talk free: holding forever under a hawkish promise used to
  // accrue kept-promise credit without a single delivered move; a promise of
  // "no further moves" had no sign and so could never be broken; and restating
  // a promise every meeting reset its clock, so it never came due.
  const prior = state.guidance
  let brokenPromises = prior.brokenPromises
  let keptPromises = prior.keptPromises
  let carried: GuidanceState = prior

  const breakPromise = (): void => {
    // The escape hatch scales with the promise's age: `shockSince` measures
    // total drift since issuance, and a year of ordinary economic weather
    // already drifts past the immediate-reversal bar, so a flat bar would
    // excuse nearly every default at maturity. An old promise is only excused
    // by a genuine upheaval, not by the year having happened.
    const age = state.meetingIndex - prior.issuedAtMeeting
    const bar =
      GUIDANCE_REVERSAL_JUSTIFICATION * (1 + age / GUIDANCE_HORIZON_MEETINGS)
    if (shockSince(state, prior.issuedAtMeeting) >= bar) return
    brokenPromises += 1
    latent.credibility -= INSTITUTIONAL.credibility.brokenPromise * sensitivity
    latent.marketTrust -= INSTITUTIONAL.marketTrust.brokenPromise
  }

  const priorPath = prior.impliedRatePath
  if (priorPath !== null) {
    const binding = COMMUNICATION.commitmentWeight[prior.commitment] >= 0.65
    const matured =
      state.meetingIndex - prior.issuedAtMeeting >= GUIDANCE_HORIZON_MEETINGS

    if (matured) {
      // The promise comes due, today's decision included, and then expires
      // either way: a promise about next year cannot go on pulling
      // expectations three years later. An unbinding bias expires unjudged.
      if (binding) {
        if (Math.abs(newRate - priorPath) <= GUIDANCE_DELIVERY_TOLERANCE) {
          keptPromises += 1
        } else {
          breakPromise()
        }
      }
      carried = { ...prior, impliedRatePath: null }
    } else if (binding && Math.abs(actualMove) >= 0.2) {
      // Before maturity only moves are judged: a step toward the announced
      // path is a delivery, a step away from it repudiates it — in either
      // direction, because a path overshot is as unannounced as one abandoned
      // — and holding is neither. The credit for a promise comes from
      // delivering it, not from sitting under it.
      const before = Math.abs(previousRate - priorPath)
      const after = Math.abs(newRate - priorPath)
      if (after > before + 1e-9) breakPromise()
      else keptPromises += 1
    }
  }

  const guidanceMove = magnitudeOf(pkg, 'forward_guidance')
  let guidance: GuidanceState
  if (guidanceMove === undefined) {
    guidance = { ...carried, brokenPromises, keptPromises }
  } else {
    const announcedPath = newRate + guidanceMove / 100
    const commitment = communication?.commitment ?? 'weak_bias'

    // Replacing an unexpired binding promise is judged by what was left of
    // it. A promise the rate has already reached is settled — kept — and the
    // new announcement starts a fresh one: stepping down the commitment after
    // arriving is mission accomplished, not a walk-back. A promise still
    // outstanding can be restated within tolerance, keeping the original
    // clock so maturity cannot be postponed forever; rewriting it further
    // than that, or withdrawing the commitment while the path is undelivered,
    // is the promise broken with words instead of with the rate.
    let issuedAt = state.meetingIndex
    const carriedPath = carried.impliedRatePath
    if (
      carriedPath !== null &&
      COMMUNICATION.commitmentWeight[carried.commitment] >= 0.65
    ) {
      const outstanding = Math.abs(carriedPath - newRate)
      const rewritten = Math.abs(announcedPath - carriedPath)
      const withdrawn = COMMUNICATION.commitmentWeight[commitment] < 0.65
      if (outstanding <= GUIDANCE_DELIVERY_TOLERANCE) {
        keptPromises += 1
      } else if (rewritten > GUIDANCE_DELIVERY_TOLERANCE || withdrawn) {
        breakPromise()
      } else {
        issuedAt = carried.issuedAtMeeting
      }
    }

    guidance = {
      impliedRatePath: announcedPath,
      commitment,
      tone: communication?.tone ?? 'neutral',
      issuedAtMeeting: issuedAt,
      brokenPromises,
      keptPromises,
    }
  }

  // ---- The priced path answers the announced one, the same day -------------
  // Sized by how much of a path was announced and how much the announcer is
  // believed — with the credibility the announcement itself just cost, so a
  // volte-face is discounted the moment it is made.
  if (guidanceMove !== undefined && guidance.impliedRatePath !== null) {
    const reach = communication ? COMMUNICATION.channelReach[communication.channel] : 1
    const jump = clamp(
      COMMUNICATION.guidanceMarketJump *
        (latent.credibility / 100) *
        COMMUNICATION.commitmentWeight[guidance.commitment] *
        reach *
        crisisAmplifier,
      0,
      1,
    )
    latent.marketExpectedRate +=
      jump * (guidance.impliedRatePath - latent.marketExpectedRate)
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
