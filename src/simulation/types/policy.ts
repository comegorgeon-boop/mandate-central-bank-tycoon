import type { OperatingProcedure } from './scenario.ts'
import type { Difficulty, Institution } from './core.ts'

/**
 * Every instrument the engine understands.
 *
 * Availability is institution- and difficulty-dependent and lives in
 * config/instruments.ts, never in this union.
 */
export type InstrumentId =
  // Shared
  | 'policy_rate'
  | 'asset_purchases'
  | 'balance_sheet_runoff'
  | 'forward_guidance'
  // Federal Reserve
  | 'iorb_spread'
  | 'discount_window'
  | 'reverse_repo'
  | 'swap_lines'
  // European Central Bank
  | 'deposit_facility_spread'
  | 'minimum_reserves'
  | 'targeted_refinancing'
  | 'transmission_protection'

/** Transmission channel labels, used for the Policy Desk copy and the postmortem. */
export type TransmissionChannel =
  | 'interest_rate'
  | 'credit'
  | 'asset_prices'
  | 'exchange_rate'
  | 'expectations'
  | 'bank_liquidity'
  | 'sovereign_spreads'

/** A single instrument setting chosen for one meeting. */
export interface PolicyAction {
  readonly instrument: InstrumentId
  /**
   * Magnitude in the instrument's own unit, documented per instrument in
   * config/instruments.ts (basis points for rates, % of GDP for purchases,
   * an ordinal step for qualitative facilities).
   */
  readonly magnitude: number
}

export type CommunicationTone =
  | 'hawkish'
  | 'neutral'
  | 'dovish'
  | 'reassuring'
  | 'alarmed'

export type CommunicationEmphasis =
  | 'inflation'
  | 'employment'
  | 'growth'
  | 'financial_stability'
  | 'uncertainty'
  | 'data_dependence'

export type CommunicationCommitment =
  | 'none'
  | 'weak_bias'
  | 'conditional_path'
  | 'strong_commitment'

export type CommunicationChannel =
  | 'statement'
  | 'press_conference'
  | 'speech'
  | 'social_post'

/**
 * The communication half of a policy package.
 *
 * All copy is generated locally from deterministic templates; this structure
 * is the only input the simulation reads. No model, no remote call.
 */
export interface CommunicationChoice {
  readonly tone: CommunicationTone
  readonly emphasis: CommunicationEmphasis
  readonly commitment: CommunicationCommitment
  readonly channel: CommunicationChannel
}

/** Everything the player confirms at one meeting. */
export interface PolicyPackage {
  readonly actions: readonly PolicyAction[]
  readonly communication: CommunicationChoice | null
  /**
   * A change of operating procedure, if this is the meeting that offers one.
   *
   * Not an instrument, which is why it is not in `actions`: an instrument has
   * a level you set every meeting, and this is a decision about *what the dial
   * means* that is taken once and stands. Only a historical scenario offers
   * it, and only at the meeting it names. See `types/scenario.ts`.
   */
  readonly procedure?: OperatingProcedure | null
}

/**
 * Standing policy settings that persist between meetings.
 *
 * Distinct from the latent economic state: these are configuration the player
 * has chosen and that stays in force until changed. Facilities in particular
 * keep acting every sub-step, which is why they cannot live in a per-meeting
 * package alone.
 */
export interface PolicyStance {
  /**
   * What the rate the committee votes actually is.
   *
   * `rate_target`: the dial is the rate, and what is voted is what prevails.
   * `reserve_target`: the dial is a midpoint, and the realised rate is left to
   * the market around it — which is how the funds rate reached 19 % in 1981
   * without the Committee ever having to vote for 19 %.
   */
  readonly operatingProcedure: OperatingProcedure
  /**
   * The policy rate the committee has voted, %, before administered-rate
   * adjustments. The latent `policyRate` is this plus the effect of the
   * corridor and money-market instruments.
   */
  readonly targetRate: number
  /** Asset purchase pace, % of GDP per year. */
  readonly assetPurchasePace: number
  /** Balance-sheet runoff pace, % of GDP per year. */
  readonly runoffPace: number
  /** Fed: discount window and standing facilities, ordinal 0-3. */
  readonly discountWindowLevel: number
  /** Fed: reverse repo operations, ordinal 0-3. */
  readonly reverseRepoLevel: number
  /** Fed: liquidity swap lines, ordinal 0-2. */
  readonly swapLinesLevel: number
  /** Fed: interest on reserve balances, basis points off the midpoint. */
  readonly iorbSpread: number
  /** ECB: deposit facility spread below the main refinancing rate, bp. */
  readonly depositFacilitySpread: number
  /** ECB: minimum reserve requirement, %. */
  readonly minimumReserves: number
  /** ECB: targeted refinancing operations, % of GDP. */
  readonly targetedRefinancing: number
  /** ECB: transmission protection, ordinal 0-3. */
  readonly transmissionProtection: number
}

/** Guidance carried between meetings, used to price consistency. */
export interface GuidanceState {
  /** Rate path implied by the last published guidance, %. Null if none given. */
  readonly impliedRatePath: number | null
  /** Strength of that commitment. */
  readonly commitment: CommunicationCommitment
  /** Tone of the last published guidance. */
  readonly tone: CommunicationTone
  /** Meeting index at which it was published. -1 if never. */
  readonly issuedAtMeeting: number
  /** Running count of guidance reversals not justified by a large shock. */
  readonly brokenPromises: number
  /** Running count of meetings whose action matched the prior guidance. */
  readonly keptPromises: number
}

export type PolicyRejectionCode =
  | 'unknown_instrument'
  | 'unavailable_for_institution'
  | 'unavailable_at_difficulty'
  | 'duplicate_instrument'
  | 'non_finite_magnitude'
  | 'below_minimum'
  | 'above_maximum'
  | 'invalid_increment'
  | 'effective_rate_below_floor'
  | 'communication_unavailable_at_difficulty'
  | 'channel_unavailable_at_difficulty'
  /** The instrument had not been invented yet in this historical scenario. */
  | 'unavailable_in_scenario'

/** A rejected action, with enough detail for the confirmation screen. */
export interface PolicyRejection {
  readonly instrument: InstrumentId | null
  readonly code: PolicyRejectionCode
  readonly message: string
}

export type ContradictionCode =
  | 'easing_rate_while_tightening_balance_sheet'
  | 'tightening_rate_while_expanding_balance_sheet'
  | 'purchases_and_runoff_together'
  | 'hawkish_guidance_with_rate_cut'
  | 'dovish_guidance_with_rate_hike'
  | 'strong_commitment_reverses_recent_strong_commitment'
  | 'liquidity_support_without_stress'

/**
 * An internally inconsistent combination. Contradictions do not reject the
 * package: the player may deliberately choose one. They are surfaced on the
 * confirmation screen and they cost credibility when applied.
 */
export interface PolicyContradiction {
  readonly code: ContradictionCode
  readonly message: string
  /** Credibility cost applied when the package is confirmed anyway, 0..1. */
  readonly severity: number
}

export interface PolicyValidation {
  readonly ok: boolean
  readonly rejections: readonly PolicyRejection[]
  readonly contradictions: readonly PolicyContradiction[]
}

/** Allowed magnitudes for one instrument. */
export interface InstrumentRange {
  readonly min: number
  readonly max: number
  /** Magnitude must be an exact multiple of this. */
  readonly increment: number
}

/** Static description of one instrument, consumed by the UI and the engine. */
export interface InstrumentDefinition extends InstrumentRange {
  readonly id: InstrumentId
  readonly unit: 'basis_points' | 'percent_of_gdp' | 'ordinal' | 'index_points'
  readonly availableTo: readonly Institution[]
  readonly availableFrom: Difficulty
  /** Narrower or wider bounds at specific difficulties. */
  readonly rangeByDifficulty?: Readonly<Partial<Record<Difficulty, InstrumentRange>>>
  readonly channels: readonly TransmissionChannel[]
  /** Expected lag before the peak effect, in meetings, as an inclusive range. */
  readonly lagMeetings: readonly [number, number]
  /** Institution-specific display names. */
  readonly label: Readonly<Record<Institution, string>>
  /** One-line description of the implementation channel, for the Policy Desk. */
  readonly description: string
  /**
   * What this instrument is *for*, in one sentence a reader who has never met
   * it can act on. No jargon, no channel names, no acronyms.
   *
   * Separate from `description`, which says how it works. A player raised
   * targeted refinancing by one point and had, in their words, no idea what it
   * had done — and `description` was on screen at the time. Saying what a lever
   * is for and saying what mechanism it uses are two different sentences, and
   * this build was only ever writing the second one.
   */
  readonly purpose: string
  /**
   * What the numbers on the dial mean, and where the historically ordinary
   * range sits inside the allowed one.
   *
   * The bounds alone answer "what may I type"; they never answered "how much
   * is a lot", which is the question a player entering a figure in % of GDP is
   * actually asking.
   */
  readonly rangeNote: string
  /** What goes wrong when this instrument is overused. */
  readonly abuseRisk: string
  /**
   * The top of the historically ordinary range, in the instrument's own unit.
   *
   * The allowed range is deliberately wider — a mandate should be able to do
   * something unprecedented, because sometimes the situation is — but crossing
   * this is worth saying out loud at the moment it happens. Omitted where the
   * whole allowed range is ordinary.
   */
  readonly plausibleMax?: number
}
