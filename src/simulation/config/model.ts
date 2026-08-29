/**
 * Every behavioural coefficient of the semi-structural model.
 *
 * All of them live here rather than being scattered through the engine, so
 * balancing is a matter of tuning configuration. Rates are per year: a value
 * of 1.2 on an adjustment speed means the variable closes roughly 70 % of its
 * gap to target within one year.
 *
 * The blocks below correspond to the equations documented in docs/SIMULATION.md.
 */

/** Expectations-augmented Phillips curve, core inflation. */
export const PHILLIPS = {
  /** Slope on the output gap. Deliberately flat, as in modern estimates. */
  gapSlope: 0.22,
  /** Pass-through from unit labour cost pressure. */
  wagePressure: 0.25,
  /** Speed at which core inflation closes on its target level. */
  adjustment: 1.15,
} as const

/** Headline inflation: core plus energy, food and imported goods. */
export const HEADLINE = {
  /** Headline moves much faster than core. */
  adjustment: 3.0,
  /** Supply shocks hit headline harder than core. */
  supplyAmplifier: 1.8,
} as const

/** Adaptive, partly anchored inflation expectations. */
export const EXPECTATIONS = {
  /** Speed of one-year expectations. */
  shortAdjustment: 2.2,
  /** Baseline weight on long-run expectations when anchoring is zero. */
  shortAnchorBase: 0.35,
  /** Extra weight on long-run expectations at full anchoring. */
  shortAnchorSlope: 0.45,
  /** Speed of five-year expectations. Slow: they are hard to move. */
  longAdjustment: 0.45,
  /** Baseline weight on the target when credibility is zero. */
  longTargetBase: 0.3,
  /** Extra weight on the target at full credibility and anchoring. */
  longTargetSlope: 0.65,
  /** Speed at which the anchoring index itself moves. */
  anchoringAdjustment: 0.6,
  /** How much a persistent expectations miss erodes anchoring. */
  anchoringMissSensitivity: 0.16,
  /** How much credibility supports anchoring. */
  anchoringCredibility: 0.25,
  /** Strength of the pull from published guidance, before credibility. */
  guidancePull: 1.6,
} as const

/** IS curve driving the output gap. */
export const IS_CURVE = {
  /** Response to the lag-weighted real policy rate gap. */
  rateSensitivity: 0.55,
  /** Response to the lag-weighted financial conditions gap. */
  financialConditions: 0.22,
  /** Response to the fiscal impulse. */
  fiscal: 0.35,
  /** Response to credit growth above its neutral pace. */
  credit: 0.05,
  /** Neutral real credit growth, %/year. */
  creditNeutral: 2.0,
  /**
   * Direct trade channel of the exchange rate, scaled by openness. Modest,
   * because the financial conditions index already carries the currency's
   * effect on financing costs.
   */
  exchangeRate: 0.35,
  /** Response to the lag-weighted balance-sheet impulse. */
  balanceSheet: 0.06,
  /** Response to the confidence disturbance. */
  confidence: 0.3,
  /** Mean reversion of the gap back to zero. */
  meanReversion: 0.55,
} as const

/** Okun-style unemployment dynamics. */
export const LABOR = {
  /** Percentage points of unemployment per point of output gap. */
  okun: 0.42,
  /** Speed at which unemployment closes on its Okun target. */
  adjustment: 1.4,
  /** Smoothing of the employment momentum indicator. */
  momentumSmoothing: 2.5,
} as const

/** Wage Phillips curve. */
export const WAGES = {
  /** Response to labour market slack. */
  slackSensitivity: 0.55,
  adjustment: 1.0,
} as const

/** Uncovered-interest-parity style exchange rate block. */
export const EXCHANGE = {
  /** Neutral index level. */
  baseline: 100,
  /** Assumed foreign real rate, %. */
  foreignRealRate: 0.6,
  /** Index points per percentage point of real rate differential. */
  rateSensitivity: 4.0,
  /** Index points lost per unit of aggregate risk premium. */
  riskSensitivity: 6.0,
  adjustment: 2.5,
} as const

/** Imported inflation, driven by currency moves and commodity shocks. */
export const IMPORTS = {
  /** Share of a currency move passed into import prices. */
  fxPassThrough: 0.35,
  /** Amplification of supply shocks into import prices. */
  supplyAmplifier: 2.0,
  adjustment: 3.0,
} as const

/** Credit aggregates and the financial accelerator. */
export const CREDIT = {
  base: 2.0,
  gapSensitivity: 0.55,
  financialConditions: 0.9,
  stressSensitivity: 3.5,
  adjustment: 1.6,
} as const

/** Corporate credit spreads. */
export const SPREADS = {
  base: 1.1,
  /** Widening per point of negative output gap. */
  gapSensitivity: 0.12,
  /** Widening driven by banking stress. */
  stressSensitivity: 1.4,
  /** Widening driven by market volatility. */
  volatilitySensitivity: 0.9,
  /** Compression delivered by asset purchases, before the state multiplier. */
  purchaseSupport: 0.35,
  adjustment: 2.6,
  /** Term premium block. */
  termBase: 0.9,
  termPurchaseSupport: 0.25,
  termVolatility: 0.35,
  termAdjustment: 2.0,
} as const

/** Housing and equity valuation pressure. */
export const ASSETS = {
  /** Build-up from an accommodative real rate gap. */
  easyPolicy: 5.5,
  /** Build-up from credit growth above neutral. */
  credit: 1.6,
  /** Build-up from asset purchases. */
  purchases: 1.8,
  /** Natural decay back to fair value. */
  meanReversion: 0.45,
  /** Correction forced by banking stress. */
  stressCorrection: 0.35,
} as const

/** Banking-system stress. */
export const BANKING = {
  base: 12,
  /**
   * Duration losses from rapid tightening: driven by how far the real rate
   * gap has travelled over the past year, not by its level.
   */
  tighteningSpeed: 9.0,
  /** Stress from an unwinding asset-price boom. */
  assetBust: 0.55,
  /** Stress from a deep recession. */
  gapSensitivity: 2.2,
  /** Stress from wide credit spreads. */
  spreadSensitivity: 6.0,
  /** Relief per unit of liquidity support. */
  liquiditySupport: 14.0,
  adjustment: 1.8,
} as const

/** Market volatility index. */
export const VOLATILITY = {
  base: 11,
  stressSensitivity: 0.42,
  spreadSensitivity: 6.0,
  geopolitical: 0.25,
  /** Reaction to a policy decision the market had not priced. */
  policySurprise: 9.0,
  adjustment: 3.2,
} as const

/**
 * Institution-specific transmission impairment.
 *
 * ECB: sovereign fragmentation, measured in basis points of spread.
 * Fed: regional banking stress, measured on a 0-100 index stored in the same
 * latent field.
 */
export const FRAGMENTATION = {
  ecb: {
    base: 10,
    /** Widening as the policy rate rises. */
    rateSensitivity: 6.0,
    /** Widening driven by sovereign debt pressure. */
    debtSensitivity: 0.5,
    /** Widening driven by market volatility. */
    volatilitySensitivity: 3.0,
    /** Widening in a recession. */
    gapSensitivity: 16.0,
    /** Compression from the transmission-protection instrument. */
    protectionSupport: 190,
    adjustment: 3.0,
    /** Share of policy transmission lost at full impairment. */
    impairment: 0.35,
    /** Fragmentation level treated as full impairment, basis points. */
    impairmentScale: 600,
  },
  fed: {
    base: 14,
    rateSensitivity: 0,
    /** Regional banks are hurt by the speed of tightening, not its level. */
    tighteningSpeed: 11.0,
    assetBust: 0.5,
    stressSensitivity: 0.45,
    /** Relief from the discount window and standing facilities. */
    facilitySupport: 16,
    adjustment: 2.4,
    impairment: 0.25,
    impairmentScale: 100,
  },
} as const

/** Balance-sheet block: purchases, runoff, reserves. */
export const BALANCE_SHEET = {
  /** Reserves added per point of GDP of purchases. */
  reservesPerPurchase: 1.4,
  /** Reserves drained back toward baseline each year. */
  reservesDecay: 0.6,
  reservesBaseline: 50,
  /**
   * State dependence of asset purchases.
   *
   * Purchases into a dysfunctional market compress spreads and relieve stress
   * strongly; the same purchases into a calm, richly valued market do little
   * for the real economy and mostly inflate valuations, which shows up later
   * as banking stress when the boom unwinds.
   */
  dysfunctionVolatilityPivot: 30,
  dysfunctionVolatilityScale: 35,
  dysfunctionStressScale: 45,
  /** Maximum multiplier on purchase effectiveness in a dysfunctional market. */
  dysfunctionMaxMultiplier: 2.4,
  /** Minimum multiplier when markets are calm and valuations stretched. */
  calmMinMultiplier: 0.35,
  /** Extra valuation pressure per point of GDP bought into a bubble. */
  bubbleCost: 0.9,
  /** Valuation level above which purchases are treated as feeding a bubble. */
  bubblePivot: 20,
} as const

/** Institutional standing: credibility, trust, political pressure. */
export const INSTITUTIONAL = {
  credibility: {
    /** Ceiling: even a flawless mandate does not reach 100. */
    ceiling: 90,
    /** Penalty per percentage point of average inflation miss. */
    inflationMiss: 8.0,
    /** Penalty for unanchored long-run expectations. */
    anchoring: 35.0,
    /** Penalty per guidance reversal not justified by a large shock. */
    brokenPromise: 6.0,
    /** Credit per meeting whose action matched the published guidance. */
    keptPromise: 1.5,
    /** Maximum total credit from kept promises. */
    keptPromiseCap: 8,
    /** Penalty driven by banking stress. */
    bankingStress: 0.25,
    adjustment: 0.9,
  },
  publicTrust: {
    ceiling: 85,
    /** The public feels headline inflation, not core. */
    inflation: 9.0,
    unemployment: 8.0,
    /** Resentment of high nominal rates above a tolerance level. */
    policyRate: 2.0,
    policyRateTolerance: 3.0,
    adjustment: 1.6,
  },
  marketTrust: {
    ceiling: 88,
    surprise: 20.0,
    brokenPromise: 8.0,
    volatility: 0.5,
    adjustment: 2.4,
  },
  politicalPressure: {
    base: 22,
    unemployment: 10.0,
    policyRate: 4.0,
    policyRateTolerance: 3.0,
    publicTrust: 0.6,
    inflation: 5.0,
    adjustment: 1.8,
  },
} as const

/** How the market forms its expected policy path. */
export const MARKET_EXPECTATIONS = {
  /** Weight on the Taylor benchmark when credibility is zero. */
  taylorWeightBase: 0.55,
  /** Weight shifted onto published guidance at full credibility. */
  guidanceWeightSlope: 0.45,
  /** Weight always retained on the current setting. */
  currentWeight: 0.25,
  adjustment: 2.8,
} as const

/**
 * Taylor rule used purely as a benchmark for the postmortem.
 *
 * It is never applied automatically and is never presented as the uniquely
 * correct policy.
 */
export const TAYLOR = {
  inflationWeight: 0.5,
  /** Gap weight per institution: the ECB's mandate is price-stability-first. */
  gapWeight: { fed: 0.5, ecb: 0.25 },
} as const

/** Potential output and the natural rate. */
export const SUPPLY_SIDE = {
  potentialAdjustment: 0.5,
  /** Hysteresis: a long, deep recession raises the natural rate. */
  hysteresis: 0.05,
  naturalRateAdjustment: 0.25,
} as const

/**
 * Financial conditions index: a single summary of how tight money is, beyond
 * the policy rate alone. Positive means tighter than neutral.
 */
export const FINANCIAL_CONDITIONS = {
  rateGap: 0.55,
  spread: 0.6,
  termPremium: 0.35,
  /** Per index point of banking stress above its base. */
  bankingStress: 0.015,
  /** Per index point of valuation pressure; rich valuations ease conditions. */
  assetPressure: 0.0075,
  /** Per index point of currency strength, scaled by trade openness. */
  exchangeRate: 0.02,
} as const

/**
 * Communication gameplay.
 *
 * All copy is assembled locally from deterministic templates. These
 * coefficients describe only how the *structured* choice — tone, emphasis,
 * commitment, channel — is read by markets and the public.
 */
export const COMMUNICATION = {
  /** How binding each commitment level is. */
  commitmentWeight: {
    none: 0,
    weak_bias: 0.3,
    conditional_path: 0.65,
    strong_commitment: 1.0,
  },
  /** Direction each tone signals, in notional percentage points of stance. */
  toneSignal: {
    hawkish: 0.35,
    neutral: 0,
    dovish: -0.35,
    reassuring: -0.1,
    alarmed: 0.15,
  },
  /** Inflation-expectation response per point of guided rate stance. */
  guidanceInflationSensitivity: 0.25,
  /** Immediate expectations nudge from tone at full credibility, pp. */
  toneExpectationImpact: 0.12,
  /** Immediate market-path nudge from tone at full credibility, pp. */
  toneMarketImpact: 0.25,
  /** Credibility lost when the words contradict the decision. */
  inconsistencyCost: 4.5,
  /** Public trust gained by a reassuring tone while the system is stressed. */
  reassuranceTrust: 2.5,
  /** Market volatility added by an alarmed tone. */
  alarmVolatility: 5.0,
  /** How each emphasis choice supports or dilutes expectations anchoring. */
  emphasisAnchoringSupport: {
    inflation: 0.02,
    employment: -0.005,
    growth: -0.005,
    financial_stability: 0.005,
    uncertainty: 0,
    data_dependence: 0.01,
  },
  /** Reach of each channel, scaling every communication effect. */
  channelReach: {
    statement: 1.0,
    press_conference: 1.25,
    speech: 0.7,
    social_post: 0.45,
  },
} as const

/** Fiscal block. */
export const FISCAL = {
  impulseDecay: 1.1,
  /** Debt pressure builds with deficits and high real rates. */
  debtFromImpulse: 2.2,
  debtFromRealRate: 1.8,
  debtDecay: 0.35,
} as const
