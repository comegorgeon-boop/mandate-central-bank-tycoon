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
  /**
   * Slope on the output gap.
   *
   * This and the IS curve's rate sensitivity together set the sacrifice ratio.
   * Raised from 0.33 — the flat end of modern estimates — to 0.45, which puts
   * it at roughly 2.2 gap-years per point of disinflation rather than 3.0.
   *
   * A deliberate trade of realism for a decision problem. At 0.33 no policy
   * trajectory could bring inflation back inside a mandate at any difficulty:
   * eight hundred basis points of tightening across a whole fed/easy mandate
   * bought 0.30pp of disinflation against a typical opening miss of 0.85pp, so
   * the instrument was weaker than the problem it exists to solve. A flat
   * Phillips curve is good economics and, at these mandate lengths, an
   * unplayable game. See docs/BALANCE.md.
   */
  gapSlope: 0.45,
  /** Pass-through from unit labour cost pressure. */
  wagePressure: 0.25,
  /**
   * Speed at which core inflation closes on its target level.
   *
   * Raised from 1.3. The persistence that makes core inflation sticky comes
   * from `expectedInflationShort` inside its target, not from this: leaving
   * the closing speed low as well delayed the same stickiness twice over, and
   * pushed the policy-to-inflation response past the end of every mandate.
   */
  adjustment: 2.2,
} as const

/** Headline inflation: core plus energy, food and imported goods. */
export const HEADLINE = {
  /** Headline moves much faster than core. */
  adjustment: 3.0,
  /**
   * Supply shocks hit headline harder than core.
   *
   * Raised from 1.8 to keep the *identifying evidence* above the measurement
   * noise. The information ladder's promise is that the name of a shock is
   * withdrawn at higher difficulties but the evidence that identifies it is
   * not — headline running far ahead of core, with the gap opening rather than
   * closing. At 1.8 that wedge was 1.56pp against a combined first-print error
   * of 2.19pp on hard, so at the difficulty where nothing is named the player
   * was being asked to identify a shock from something indistinguishable from
   * noise. Energy and food are a fifth of the basket and move several times
   * core, so a wider wedge is the more realistic figure too.
   */
  supplyAmplifier: 2.4,
} as const

/**
 * When a cost-push shock is large enough that the inflation target stops being
 * available at any policy the desk could run.
 *
 * One band, read in two places that must agree: `engine/dynamics.ts` uses it to
 * decide how much of an inflation miss the institution's standing should be
 * charged for, and `scoring/calculateScore.ts` uses it to decide what objective
 * the mandate is judged on. They were separate judgements once and disagreed —
 * the score forgave a miss the end conditions were still ending the mandate
 * over.
 *
 * A linear ramp rather than a threshold, so there is no cliff a player could
 * park under.
 */
export const SUPPLY_REGIME_BAND = {
  /** Below this, ordinary weather: nothing is forgiven. */
  floor: 0.8,
  /** At and above this, the target was not available at all. */
  full: 3.0,
} as const

/** Adaptive, partly anchored inflation expectations. */
export const EXPECTATIONS = {
  /** Speed of one-year expectations. */
  shortAdjustment: 2.2,
  /** Baseline weight on long-run expectations when anchoring is zero. */
  shortAnchorBase: 0.35,
  /**
   * Extra weight on long-run expectations at full anchoring. Even fully
   * anchored expectations keep some weight on realised inflation, which is
   * what lets a sustained policy stance feed back into expectations.
   */
  shortAnchorSlope: 0.38,
  /** Speed of five-year expectations. Slow: they are hard to move. */
  longAdjustment: 0.45,
  /**
   * Weight on the target when credibility is zero.
   *
   * Deliberately small. An inflation anchor that holds regardless of
   * credibility is not an anchor — it is a free stabiliser that would let an
   * unattended economy drift back to target on its own, and would quietly
   * remove the reason the institution exists. Nearly all the pull toward
   * target has to be earned through `longTargetSlope`.
   */
  longTargetBase: 0.08,
  /** Extra weight on the target at full credibility and anchoring. */
  longTargetSlope: 0.65,
  /** Speed at which the anchoring index itself moves. */
  anchoringAdjustment: 0.6,
  /** How much a persistent expectations miss erodes anchoring. */
  anchoringMissSensitivity: 0.16,
  /**
   * Where the miss stops eroding the anchor linearly, in points.
   *
   * Same argument as `INSTITUTIONAL.credibility.missKnee`, on the variable
   * where it actually traps the model. Linear, a six-point expectations miss
   * drives the anchoring target below zero however hard policy is being run,
   * and since expectations only fall when the anchor holds, an economy that
   * once lost its anchor could never recover it — which is a claim about
   * 1979-83 that history falsifies. Ordinary mandates run a miss pressure
   * around 1.25, so nothing below four is touched.
   */
  anchoringMissKnee: 4.0,
  anchoringMissCompression: 0.3,
  /**
   * What holding real rates above neutral buys back of the anchor.
   *
   * See `INSTITUTIONAL.credibility.resolve` for the argument; this is the
   * same mechanism on the variable it is really about. Zero unless long-run
   * expectations are already more than a point from target, so an ordinary
   * mandate never sees it and nothing rebalances.
   */
  anchoringResolve: 1.7,
  /** Ex-post real-rate gap, in points, that earns the whole of it. */
  anchoringResolveFullAt: 4.0,
  /** How much credibility supports anchoring. */
  anchoringCredibility: 0.25,
  /**
   * How much a visible threat to the institution's independence erodes the
   * anchor, at full political pressure above the tolerance below.
   *
   * The channel that makes political pressure a variable rather than a
   * readout. Until this existed, `politicalPressure` was written by the
   * dynamics, written by events, and read by nothing except a warning label —
   * so an event that raised it by 45 points changed the economy not at all,
   * which is exactly what a player reported about the one event in the catalog
   * whose whole subject is political.
   *
   * The mechanism is the real one: an anchor is a belief that the institution
   * will keep doing what it says, and a bank whose leadership is publicly in
   * question is one markets and households discount — independently of
   * anything that bank has actually done. Sized against the credibility term,
   * which spans ±0.25: a political crisis should cost roughly what a large
   * swing in the institution's own record costs.
   */
  anchoringIndependence: 0.9,
  /**
   * Political pressure below which nothing is read into it.
   *
   * Every central bank is criticised, and criticism is not a threat to
   * independence. The base target is 22 and ordinary tightening into an
   * inflation overshoot reaches about 40, so this sits above the noise of
   * doing the job and below where a genuine institutional crisis lands.
   */
  independenceTolerance: 55,
  /** Strength of the pull from published guidance, before credibility. */
  guidancePull: 1.6,
} as const

/**
 * IS curve driving the output gap.
 *
 * `rateSensitivity`, `financialConditions` and `meanReversion` were raised
 * together by half, which leaves the *size* of the demand response to a rate
 * change unchanged — the steady-state gap is their ratio — while making it
 * arrive in about two years instead of three. The peak output effect of a rate
 * change lands four to six quarters out in the estimates this is drawn from,
 * so the faster settings are the more realistic ones as well as the playable
 * ones. Raising the three in step is what keeps the long-run sacrifice ratio
 * where it was.
 */
export const IS_CURVE = {
  /** Response to the lag-weighted real policy rate gap. */
  rateSensitivity: 0.6,
  /** Response to the lag-weighted financial conditions gap. */
  financialConditions: 0.33,
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
  /**
   * Direct contractionary effect of a cost-push shock.
   *
   * Without this the model would get supply shocks backwards: higher prices
   * would raise expected inflation, lower the real rate at an unchanged
   * nominal rate, and *stimulate* demand. A genuine terms-of-trade shock cuts
   * real income and output, which is what makes it stagflationary and what
   * makes it a different decision problem from a demand shock.
   */
  supply: 0.45,
  /**
   * Mean reversion of the gap back to zero.
   *
   * Raised in step with `rateSensitivity` above, so the gap converges faster
   * without the economy becoming more self-healing relative to policy: both
   * the numerator and the denominator of the steady-state gap moved together.
   */
  meanReversion: 0.83,
} as const

/**
 * Okun-style unemployment dynamics.
 *
 * ## The coefficient is not one number, and that is the point
 *
 * A single linear Okun coefficient was taught a false sacrifice ratio. Played
 * by the benchmark rule, the model reached 8.7 % unemployment in 1979-83
 * against the 10.8 % that printed, and swung 2.9 points against the real 4.9;
 * 1929-33 swung 6.1 against 21.7. Prices tracked in every period and
 * quantities were damped in every period, which is one coefficient failing
 * rather than seven scenarios.
 *
 * **Okun's law is steeper in recessions than in expansions.** That asymmetry
 * is well documented and it is exactly the shape of the miss: the 2021-23
 * mandates, whose gaps barely leave zero, already fitted (a range of 2.7
 * against an actual 2.6); every period with a deep gap fell short. A linear
 * coefficient fitted to the mild case therefore has to understate the severe
 * one, and raising it uniformly would break the case that already worked.
 *
 * So the coefficient steepens as the gap deepens. `okun` is the expansion and
 * mild-recession value; `deepeningMax` is how much is added at a fully
 * deepened gap, reached at `deepeningAt` points below zero, ramping linearly
 * from `deepeningFrom`. A scenario that sets its own `okun` gets the same
 * steepening on top of its own base — 1929's 0.75 becomes 1.10 at depth —
 * because the asymmetry is a property of labour markets, not of a year.
 */
export const LABOR = {
  /** Percentage points of unemployment per point of output gap. */
  okun: 0.42,
  /** Output gap below which the coefficient begins to steepen, points. */
  deepeningFrom: -2,
  /** Output gap at which the steepening is complete, points. */
  deepeningAt: -10,
  /** Added to the coefficient at a fully deepened gap. */
  deepeningMax: 0.30,
  /** Speed at which unemployment closes on its Okun target. */
  adjustment: 1.4,
  /** Smoothing of the employment momentum indicator. */
  momentumSmoothing: 2.5,
} as const

/**
 * The Okun coefficient that applies at this output gap.
 *
 * Exported so the measurement script and the tests read the same function the
 * engine does, rather than reimplementing the ramp and drifting from it.
 */
export function okunAt(base: number, outputGap: number): number {
  const { deepeningFrom, deepeningAt, deepeningMax } = LABOR
  const span = deepeningFrom - deepeningAt
  const depth = Math.min(1, Math.max(0, (deepeningFrom - outputGap) / span))
  return base + deepeningMax * depth
}

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
    /**
     * How much of the headline-miss penalty is forgiven when the miss is
     * cost-push pushed in from outside domestic demand.
     *
     * A central bank's standing does not collapse because headline inflation is
     * high during an oil shock. It collapses when people stop believing
     * inflation will be brought back — which is the anchoring term below, and
     * which is left at full strength. Charging the full headline miss on top
     * was the same error the score made and, unlike the score, it *ends
     * mandates*: measured over 100 hard runs, a competent toolkit-playing
     * policy was dismissed 34-35 times, and loosening every failure threshold
     * only converted banking crises into dismissals (34 -> 48) because this
     * term, not the thresholds, was the binding constraint.
     *
     * Not one. A committee that lets a supply shock run into the price level
     * indefinitely does lose standing — but through the anchor slipping, which
     * is the channel that means it.
     */
    supplyMissForgiveness: 0.75,
    /**
     * Where the miss penalty stops being linear, in percentage points.
     *
     * Below the knee, nothing changes: 8 points of standing per point of
     * miss, exactly as calibrated. Above it the penalty compresses, because
     * the linear form extended far enough says something false. At a
     * ten-point miss it charges 79 points of standing against a ceiling of
     * 90 and a floor of nought, which is the model asserting that the Federal
     * Reserve of 1979 had no credibility at all — while the dollar was the
     * reserve currency and its auctions cleared. What a very large miss means
     * is *they have lost control*, and that is a state, not a quantity that
     * keeps doubling.
     *
     * Six points is above anything the fictional modes produce in practice,
     * so this changes no existing balance; it exists for the historical
     * scenarios, where a double-digit miss is the situation rather than a
     * catastrophe.
     */
    missKnee: 6.0,
    /** Slope beyond the knee, as a fraction of the linear one. */
    missCompression: 0.3,
    /**
     * How much of the inflation a chairman *inherited* is forgiven, and for
     * how long.
     *
     * The mechanism this model was missing, and the one that made the Volcker
     * scenario unplayable on its own historical path. Measured on the rate
     * path that actually prevailed in 1979-83: credibility fell monotonically
     * from 45 to 0 and anchoring from 0.45 to 0.05, over three years in which
     * the real policy rate averaged above +3. The institution was being
     * destroyed for the *level* of inflation rather than for what it was doing
     * about it — and because expectations in this model are pulled toward the
     * objective in proportion to credibility, a collapsing credibility made
     * inflation rise, which collapsed credibility further. The historical path
     * disinflated in two of twelve seeds and ended the other ten in a spiral
     * or a capitulation.
     *
     * A new chairman is judged on the trajectory they establish, not on the
     * number they walked into. So the miss is charged against a **glide path**:
     * at the first meeting the whole inherited miss is forgiven, at the last
     * none of it is, and in between the forgiveness falls linearly. A committee
     * that stays on the glide pays nothing; one above it pays for the
     * difference; one below it is already earning.
     *
     * In an ordinary mandate the inherited miss is small — a fraction of a
     * point — so this term is nearly inert, which is the right behaviour: it
     * is a rule about inheriting a disaster, and the fictional modes do not.
     * The cap stops it forgiving a mandate that opens on an inflation nobody
     * could have inherited.
     */
    inheritedForgivenessCap: 10.0,
    /**
     * The part of an inherited miss that is *not* forgiven, in points.
     *
     * A deductible, and it is what keeps the glide path above from being a
     * general softening. Every mandate inherits something — the tutorial opens
     * 2.4 points above its objective by design — and forgiving that too made
     * an idle player's credibility hold up as well as an active one's.
     * Measured: the tutorial's "competent beats passive" guard, which exists
     * because an earlier opening healed itself, went to a dead tie the moment
     * the glide path applied to ordinary openings.
     *
     * Four points is above anything the fictional modes produce and well below
     * what 1979 (9.8) or 2021 (0.7, so nothing) or 1929 (1.2, so nothing)
     * hand over. It makes this a rule about inheriting a disaster rather than
     * a discount on having a job.
     */
    inheritedDeductible: 4.0,
    /** Penalty for unanchored long-run expectations. */
    anchoring: 35.0,
    /**
     * Credit for bearing the cost of getting the anchor back.
     *
     * The mechanism the model did not have, and the one this whole project's
     * credibility hawk is about: in Barro and Gordon a central bank
     * establishes its type by *paying* — holding real rates above neutral
     * through the recession that follows. Nothing in this file used to let a
     * committee earn standing that way; the only route up was keeping
     * guidance promises, which is a theory of announcements rather than of
     * resolve.
     *
     * Deliberately gated on the anchor having slipped, and worth nothing when
     * it has not: when expectations are pinned there is nothing to prove, and
     * paying a premium to prove it would be a policy error rather than a
     * demonstration. So in an ordinary mandate this term is zero and nothing
     * rebalances; in 1979 it is the whole of how the disinflation is won.
     */
    resolve: 46.0,
    /** Real-rate gap, in points above neutral, that earns the full credit. */
    resolveFullAt: 4.0,
    /** Expectations miss, in points beyond one, at which it is fully live. */
    resolveLiveAt: 4.0,
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
    /** Resentment per point of real policy rate above the tolerance. */
    policyRate: 4.0,
    /**
     * Where resentment of the cost of credit starts, as a **real** rate.
     *
     * Read on the real rate rather than the nominal one, because the previous
     * form double-counted inflation: it charged pressure for a nominal rate
     * above 3 % *and*, on the line below, for the inflation that was the
     * reason the nominal rate was there. In a 2 %-target world the two are
     * nearly the same thing and the error is invisible. In August 1979 it is
     * not: a funds rate of 10.94 % against inflation of 11.84 % — credit free
     * in real terms, and nobody in Congress writing letters about it yet —
     * scored 32 points of resentment on the rate term alone and opened the
     * mandate at maximum political pressure, before a single decision.
     *
     * On the real rate, that opening scores nothing, and 1981 — a funds rate
     * of 19 % against inflation of 9 % — scores 34. Which is the right shape:
     * the builders posting lumber to the Board did it in 1981 and 1982, not
     * in 1979.
     */
    realRateTolerance: 1.5,
    publicTrust: 0.6,
    inflation: 5.0,
    adjustment: 1.8,
  },
} as const

/**
 * Targeting reserves instead of the rate.
 *
 * The October 1979 reform, as a mechanism. The Committee stopped defending a
 * funds-rate range and set a path for nonborrowed reserves instead, and the
 * rate went where the path sent it: between October 1979 and the end of 1980
 * the effective funds rate ranged from 8.5 % to 20 %, and it reached 19 %
 * without anybody having to vote for 19 %.
 *
 * Both numbers are calibrated rather than measured. The standing is what the
 * reform is usually credited with — a committee that has stopped defending a
 * number is read as one that will not blink — and it is deliberately smaller
 * than the swings it costs you, so the choice is a trade and not a free gift.
 */
export const RESERVE_TARGETING = {
  /** Standard deviation of the realised rate around the voted midpoint, pp. */
  bandSd: 1.3,
  /** Hard limit on that offset, pp. */
  bandLimit: 3.2,
  /** Credit to the credibility target while the anchor is adrift. */
  credibility: 7.0,
  /** Credit to the anchoring target on the same condition. */
  anchoring: 0.1,
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
  /**
   * How far below the institution's own effective lower bound markets will
   * price a policy path, in points.
   *
   * Markets do not price a rate the central bank cannot set. They will price
   * a little *through* a floor — a bank that has gone to −0.50 might go to
   * −0.75, and short rates traded through the ECB's deposit rate more than
   * once — but not by much and not for long, because the floor is a fact about
   * cash and the banking system rather than a preference.
   *
   * This exists because the Taylor benchmark has no floor at all. In a
   * deflation of −7 % the rule prescribes about −11, the priced path followed
   * it down, and the only thing stopping it was the safety rail at −2 in
   * `config/bounds.ts` — which is how `marketExpectedRate` came to be the one
   * standing clamp warning in `npm run sim:sweep`, carried in docs/BALANCE.md
   * as "not diagnosed" for several sessions. Diagnosed: not an inflation
   * spiral reaching the upper rail, as the bounds file guessed, but *deflation
   * reaching the lower one*.
   *
   * Making it a modelled floor rather than a rail also matters for what the
   * model can teach. A nominal path that cannot fall below zero while prices
   * fall is the *entire* mechanism of 1929-33: the expected real rate rises
   * exactly when the economy needs it to fall, and policy is tightening while
   * doing nothing. A model whose priced path happily went to −11 could not
   * produce that, and the number it produced instead was a clamp warning.
   */
  belowFloorAllowance: 0.5,
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
  /**
   * Inflation-expectation response per point of guided rate stance.
   *
   * Raised from 0.25 when communication became a real instrument. The product
   * `guidancePull × credibility × commitment × this` is the annual pull on
   * one-year expectations per point of announced-versus-current rate gap: at
   * credibility 60 under a conditional commitment it is now ~0.31pp/year,
   * which makes a credible, delivered guidance worth the same order as the
   * rate channel on an easy mandate — arriving two to four meetings sooner,
   * because it skips the output gap. That head start is the whole reason the
   * second instrument exists; below ~0.15pp/year it is cosmetic.
   */
  guidanceInflationSensitivity: 0.5,
  /** Immediate expectations nudge from tone at full credibility, pp. */
  toneExpectationImpact: 0.2,
  /** Immediate market-path nudge from tone at full credibility, pp. */
  toneMarketImpact: 0.25,
  /**
   * Share of the gap between the priced path and a newly announced one that
   * markets close on the day of the announcement, at full credibility and
   * commitment, before channel reach.
   *
   * This is what makes the market answer *words* on the day they are said:
   * announcing "we expect to go further" repositions `marketExpectedRate`
   * immediately, exactly as tone already nudges it, but sized by how much of
   * a path was announced and how much the announcer is believed. At
   * credibility 60 under a conditional commitment, a +100bp announced path
   * moves the priced rate by roughly +0.35pp the same day.
   */
  guidanceMarketJump: 0.6,
  /**
   * Credibility and market-trust lost when the words contradict the
   * decision, per unit of contradiction severity. Easy only raised from 4.5
   * (medium/hard unchanged) — see the doc comment on `reversalCost` below
   * for why this is difficulty-scoped at all.
   *
   * A single contradictory meeting was survivable by design — committees do
   * sometimes mean it — but a *pattern* of it, repeated every meeting, was
   * barely denting credibility by the end of a mandate: mean-reversion
   * pulled it back up between hits faster than an occasional 2-3 point loss
   * could keep it down. This is deliberately large enough that saying the
   * opposite of what you do, meeting after meeting, drives credibility
   * toward dismissal territory on its own. See docs/BALANCE.md, "Conduct has
   * to cost, independent of the economy".
   */
  inconsistencyCost: { easy: 15, medium: 12, hard: 12 },
  /**
   * Credibility and market-trust cost of sharply reversing the *previous*
   * meeting's rate move, per point of the smaller of the two moves reversed,
   * per reversal beyond `freeReversals` — independent of what was said about
   * either one, and escalating with the count so far this mandate. Easy
   * only: this whole mechanism, `inconsistencyCost`'s raise, and the
   * conduct gate in `config/scoring.ts` are all scoped to easy, and for the
   * same reason. They were built and tuned against easy's own, comparatively
   * calm observation noise (`observationNoiseScale` 0.35). Measured directly
   * on medium and hard, whose noise is 1.0x and 1.7x: the staff rule's own
   * target legitimately jumps far more often at that noise level — already
   * documented in docs/BALANCE.md as *correct*, hard-mode behaviour — and
   * these mechanisms, calibrated for easy's quieter data, read that
   * legitimate jumpiness as sabotage. fed/hard completion fell from 22-27%
   * to 7% and credibility hit its clamp 41 times in 150 seeded runs before
   * this was scoped. Medium and hard are out of scope for the session that
   * built this; their conduct-related credibility dynamics are exactly what
   * they were before it.
   *
   * Priced separately from `inconsistencyCost` on purpose: a package whose
   * words never contradict its own action can still whipsaw the rate meeting
   * after meeting, and a committee that cannot hold a direction erodes
   * confidence in its own judgement regardless of how honestly each
   * individual meeting was described.
   *
   * Escalating rather than flat because a flat cost cannot tell a genuine
   * pivot from a pattern of whiplash: the staff rule itself reverses once or
   * twice across a typical mandate, reacting to real data, and a flat cost
   * large enough to matter for sabotage was large enough to make that rule
   * lose to silence — the exact inversion `engine/guidance.test.ts` exists to
   * catch. `freeReversals` gives every mandate the same benefit of the
   * doubt a real committee would get; the cost only engages once the pattern
   * itself is the story. See docs/BALANCE.md, "Conduct has to cost,
   * independent of the economy".
   */
  reversalCost: 10.0,
  /**
   * Reversals per mandate before `reversalCost` starts charging for them,
   * per difficulty.
   *
   * A per-difficulty record, and measured rather than guessed. The cost used to
   * be gated off above easy entirely, on the finding that medium and hard's
   * observation noise makes a rule's own target jump legitimately far more
   * often — which is true, and which a single allowance tuned for easy's much
   * quieter data read as sabotage. The answer is a bigger allowance where the
   * data are noisier and the mandate longer, not no allowance at all: sixty
   * seeds per bucket, mean reversals per mandate,
   *
   *            competent (toolkit rule)   deliberate sabotage
   *   easy               0.0                      9.0
   *   medium             0.6 - 0.8               14.5 - 14.9
   *   hard               2.1 - 3.4               13.8 - 15.2
   *
   * so a bar set between the two columns bills a pattern of whiplash at every
   * difficulty and never bills a committee reacting to genuinely noisy data.
   */
  freeReversals: { easy: 2, medium: 3, hard: 6 },
  /** Public trust gained by an earned reassurance, per unit of crisis intensity, before reach. */
  reassuranceTrust: 6.0,
  /** Market volatility added by an alarmed tone, before the crisis amplifier. */
  alarmVolatility: 5.0,
  /**
   * How much harder words land when markets are already in crisis.
   *
   * Multiplies the tone's market and expectations impact, the alarmed-tone
   * volatility add, and the guidance same-day jump's share, by
   * `1 + crisisAmplifier * crisisIntensity`. At `crisisIntensity` 1 — roughly
   * what one of the catalog's major events produces on its own — a statement
   * moves markets a bit over twice as much as the identical words would in
   * calm weather. This is the mechanism behind "markets become listenable":
   * the rate is still one instrument, but what is said about it now carries
   * real weight when there is something worth saying it about.
   */
  crisisAmplifier: 1.2,
  /**
   * Floor of `crisisIntensity` below which a reassuring tone is judged
   * neither earned nor hollow — it is just a tone. Below it there is nothing
   * to reassure anyone about.
   */
  reassuranceCrisisFloor: 0.15,
  /** Market trust gained by an earned reassurance, per unit of crisis intensity, before reach. */
  reassuranceMarketTrust: 6.0,
  /** Market volatility relieved by an earned reassurance, per unit of crisis intensity, before reach. */
  reassuranceVolatilityRelief: 4.0,
  /**
   * Credibility and market-trust cost of a reassuring tone published during a
   * real crisis with nothing behind it — no stabilising rate move, no
   * liquidity or support instrument escalated, no binding guidance. Spin that
   * is not backed by action, priced the way a broken promise is: on
   * credibility (scaled by the difficulty's sensitivity) and on market trust.
   */
  hollowReassuranceCost: 5.0,
  /**
   * `crisisIntensity` above which staying silent is a choice rather than a
   * neutral default — set higher than `reassuranceCrisisFloor`, so a mildly
   * tense meeting can still pass without comment.
   */
  silenceCrisisThreshold: 0.3,
  /** Market trust cost of publishing nothing at all during a real crisis. */
  silenceCrisisCost: 4.0,
  /** Market volatility added by publishing nothing at all during a real crisis. */
  silenceCrisisVolatility: 3.0,
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

  /**
   * The public finances, as arithmetic rather than as an index.
   *
   * ## Why this exists
   *
   * The unpleasant monetarist arithmetic (Sargent and Wallace, 1981). A
   * central bank that raises rates raises the interest bill of the government
   * it serves, and if that government will not or cannot close the gap, the
   * bill is eventually paid by the central bank — which is to say by
   * inflation. The whole argument turns on a *lag*: the rate rises today and
   * the bill rises over the years it takes the debt stock to roll over.
   *
   * So the model integrates the stock rather than indexing it:
   *
   *     effectiveRate → longRate, at 1/maturity a year
   *     debtService   = debt × effectiveRate / 100
   *     deficit       = debtService − primaryBalance
   *     debt          += deficit − debt × nominal growth / 100
   *
   * The last term is the one people forget and it is why debt ratios fall in
   * an inflation: the denominator grows. It is also why this scenario's own
   * 1979 chairman was accused of making the deficit worse and 1983's was not.
   *
   * ## What it is *not*
   *
   * Not in the score. Nothing in `calculateScore.ts` reads any of these. They
   * reach the player through the event generator — a high debt ratio makes a
   * fiscal-dominance episode more likely to be drawn — and through the panel
   * that shows them. A central bank scored on the deficit would be a treasury.
   */
  publicFinances: {
    /**
     * Average maturity of the debt stock, in years, per institution.
     *
     * The United States Treasury's weighted average maturity has run near six
     * years for most of the past two decades; the euro area's aggregate is
     * longer, nearer eight, because its members issue further out. These are
     * the real orders of magnitude and they are the single number that
     * decides how long a rate rise takes to show up in the interest bill.
     */
    maturityYears: { fed: 6, ecb: 8 },
    /**
     * How far the primary balance moves with the cycle, per point of output
     * gap.
     *
     * Automatic stabilisers: revenue falls and transfers rise in a recession
     * without anybody deciding anything. Half a point of balance per point of
     * gap is the standard estimate for an advanced economy.
     */
    cyclicalBalance: 0.5,
    /** And how far it moves with a discretionary fiscal impulse. */
    impulseBalance: 0.9,
    /** The structural primary balance each institution reverts to. */
    structuralBalance: { fed: -2.5, ecb: -1.0 },
    /** Speed at which the primary balance returns to that. */
    balanceAdjustment: 0.8,
    /**
     * Index points of fiscal pressure per point of debt ratio **above where
     * the mandate opened**.
     *
     * The link between the two notions, and it is additive rather than a
     * substitution. `debtPressure` is not a debt ratio: it is how much the
     * public finances constrain *this* central bank, and the engine opens the
     * Fed at 38 and the ECB at 52 although the United States carries the
     * larger debt — because the euro area's debt is a monetary problem in a
     * way a sovereign borrowing in its own currency at depth is not.
     *
     * What the ratio contributes is therefore its *rise*. At 0.45, a debt
     * ratio twenty points higher than it opened adds nine points of pressure,
     * which is about a quarter of the Fed's opening level: enough to move the
     * term premium and to make a fiscal-dominance episode visibly likelier,
     * and not enough to swamp everything else in the block.
     */
    pressurePerDebtPoint: 0.45,
  },
} as const
