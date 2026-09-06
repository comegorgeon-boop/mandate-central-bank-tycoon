import type { Institution } from '../types/core.ts'
import type { ScoreComponentId } from '../types/scoring.ts'

/** Maximum attainable score. */
export const MAX_SCORE = 10000

/**
 * Component weights, per institution. Each set sums to 1.
 *
 * For the Fed, price stability and employment carry substantial coequal
 * weight, matching the dual mandate. For the ECB, price stability carries the
 * primary weight; employment and growth still matter but cannot be the main
 * route to a high score.
 *
 * `market_prosperity` was added after a played mandate watched the equity
 * index fall from 1000 to 500 and could not tell whether it had counted. It
 * had not: `financial_stability` scores banking stress, credit spreads,
 * volatility and fragmentation, and none of those is the value of the assets
 * households own.
 *
 * Its weight comes entirely out of `financial_stability`, splitting that block
 * in half rather than taking a slice from everywhere. The financial side of
 * the scorecard is unchanged in total and now answers two different questions
 * instead of one: did the system break, and was wealth destroyed. Taking the
 * weight from elsewhere would have been an arbitrary reweighting of the real
 * economy dressed up as an addition.
 *
 * It sits below price stability and employment at both institutions on
 * purpose. A central bank that maximised asset prices would be doing the wrong
 * job, and a scorecard that paid well for it would teach exactly that.
 */
export const SCORE_WEIGHTS: Readonly<
  Record<Institution, Readonly<Record<ScoreComponentId, number>>>
> = {
  fed: {
    price_stability: 0.26,
    employment_output: 0.26,
    financial_stability: 0.06,
    market_prosperity: 0.06,
    anchoring: 0.12,
    credibility: 0.1,
    shock_response: 0.06,
    policy_volatility: 0.04,
    completion: 0.04,
  },
  ecb: {
    price_stability: 0.38,
    employment_output: 0.14,
    financial_stability: 0.06,
    market_prosperity: 0.06,
    anchoring: 0.14,
    credibility: 0.1,
    shock_response: 0.06,
    policy_volatility: 0.03,
    completion: 0.03,
  },
}

/**
 * Scales that map a path statistic onto a 0..1 component score.
 *
 * Each is the value at which the component falls to roughly 37 % (one e-fold),
 * so they read as "how bad is bad".
 */
export const SCORE_SCALES = {
  /** Root-mean-square deviation of inflation from target, percentage points. */
  priceStabilityRmse: 1.6,
  /** RMS of the unemployment gap and output gap, blended. */
  employmentRmse: 1.9,
  /** Average financial stress penalty. */
  financialStress: 26,
  /** RMS deviation of long-run expectations from target. */
  anchoringRmse: 0.85,
  /** Average shortfall of credibility below 100. */
  credibilityShortfall: 34,
  /** Cumulative absolute policy rate change beyond the free allowance, in pp. */
  policyVolatility: 4.5,
  /**
   * Average distance of asset valuations from fundamentals, in index points
   * beyond `VALUATION_TOLERANCE`.
   *
   * Measured over 100 mandates a side, an ordinary mandate sits 0.1 to 1.4
   * points outside the tolerance and scores 0.9 or better; a dislocated one
   * runs several times that. Sized so a mandate that lets valuations come
   * badly adrift gives up roughly 300 points of the final score — enough to
   * be seen, nowhere near enough to be chased.
   */
  marketProsperity: 4.5,
} as const

/**
 * How far valuations may sit from fundamentals before it is scored at all.
 *
 * Wide, and the width is the whole design. Three narrower formulations were
 * measured first and every one of them charged competent play for doing its
 * job: on the tutorial's overheated opening, disinflating necessarily takes
 * valuations from frothy to somewhat below fair, so a measure of the index's
 * *level* — or of its drawdown, or of any distance from fair value read
 * tightly — scores the cure as the disease. Measured, that single term flipped
 * fed/easy from competent play beating passivity to losing to it.
 *
 * At 20 points, the ordinary swing a disinflation causes is inside the band
 * and free, and what remains outside it is dislocation: a market that has come
 * genuinely adrift from what the economy underneath it can support.
 */
export const VALUATION_TOLERANCE = 20

/**
 * Policy churn the player may use for free before the volatility component and
 * the conduct gate start to bite, in cumulative percentage points of rate
 * change per year, per difficulty.
 *
 * Per-difficulty because a committee reading noisier data moves more often
 * without being erratic, and a single figure tuned for easy's quiet prints
 * calls that erratic. Measured over 60 seeds per bucket, mean churn per year:
 *
 *            competent (toolkit rule)   deliberate sabotage
 *   easy               0.49                     6.67
 *   medium             1.46 - 1.50             11.60 - 11.93
 *   hard               1.73 - 1.92              7.39 - 8.09
 *
 * Left at 2.0 on easy, where it was measured. At the harder modes the old
 * single value was biting competent play in 114 of 150 hard mandates, pulling
 * a median conduct gate to 0.78 for a rule doing nothing but react to the data
 * in front of it — which is how competent play came to score *below* passive
 * at hard the first time the gate was opened above easy.
 */
export const POLICY_VOLATILITY_ALLOWANCE_PER_YEAR: Readonly<
  Record<'easy' | 'medium' | 'hard', number>
> = { easy: 2.0, medium: 3.0, hard: 3.5 }

/**
 * What the completion component is worth to a tutorial that ran its length
 * without reaching its objective.
 *
 * Not zero: the player served every meeting and nothing collapsed, which is
 * materially better than being revoked at meeting nine. Not one either, which
 * is what reading `status === 'completed'` alone used to award — a tutorial
 * that ends because the clock ran out has finished, not succeeded, and paying
 * both endings the same is the scoring equivalent of congratulating a player
 * for turning up.
 */
export const MISSED_OBJECTIVE_CREDIT = 0.35

/**
 * Banking stress above which the financial stability component starts to bite.
 *
 * Named here rather than left inline in `calculateScore` because the indicator
 * panel quotes it to the player. A threshold stated in two places is a
 * threshold that will eventually disagree with itself — which is exactly what
 * happened when the banking stress indicator told players the system was
 * impaired above 50, a number no part of the engine has ever known.
 */
export const STRESS_PENALTY_FLOOR = 25

/**
 * ECB safeguard: a persistent failure on inflation caps the total score, so
 * strong employment and growth cannot compensate for it.
 *
 * Below `threshold` on the price-stability component, the whole score is
 * multiplied by a factor that falls linearly to `floor`.
 */
export const PRICE_STABILITY_GATE = {
  threshold: 0.4,
  floor: 0.55,
} as const

/**
 * The conduct gate: erratic, self-contradictory policy guts the whole score,
 * independent of how the real economy happened to absorb it.
 *
 * The engine's own transmission lag is a low-pass filter: a policy rate that
 * alternates sign every meeting mostly cancels inside the kernel before it
 * ever reaches inflation or output, so a churning, contradictory mandate can
 * leave every path-based component looking almost as good as a steady one —
 * measured directly, alternating +/-100bp left the post-kernel real-rate gap
 * within 0.1-0.15pp of a flat hold's, on the same seed. Every *other*
 * component in this file measures the economy; this is the one that measures
 * the decisions themselves, the same way `PRICE_STABILITY_GATE` measures one
 * objective directly rather than trusting the weighted blend to notice it.
 *
 * Three independent exponential factors — churn beyond the free allowance,
 * accumulated contradiction severity beyond `freeContradictionCost`, and
 * broken guidance promises beyond `freeBrokenPromises` — each at the scale
 * where the *billed* excess alone would pull the gate to roughly 37%. They
 * multiply, so genuinely incoherent conduct (bad on more than one axis at
 * once, which alternating-and-lying is) is punished harder than any single
 * axis implies. `floor` keeps the gate a steep slope rather than a hard wall
 * at zero, matching every other `performance`-shaped component in this file.
 *
 * The free allowances matter as much as the scales. `guidedStaffPackage`'s
 * own honest mode — the falsifiable criterion's "communication is a real
 * instrument" benchmark — breaks roughly 0.1-0.15 promises per mandate on
 * easy as a normal artefact of its target shifting on noisy data, exactly as
 * intended and already priced elsewhere (docs/BALANCE.md, "the honest rule
 * breaks 0.1 promises per mandate and keeps 4"). Measured directly: one
 * broken promise with `freeBrokenPromises` at 0 cut a seed's score from
 * ~6600 to 3250 on its own, which was severe enough to invert the whole
 * falsifiable criterion in `engine/guidance.test.ts` — communication looked
 * like it no longer paid, when what had actually happened was this gate
 * punishing an already-priced, already-acceptable rate of normal slippage.
 * `churnScale` needed no equivalent fix: `POLICY_VOLATILITY_ALLOWANCE_PER_YEAR`
 * already gives churn its own free allowance upstream of this gate.
 */
export const CONDUCT_GATE = {
  churnScale: 4.0,
  contradictionScale: 10.0,
  /**
   * Contradiction severity forgiven before the contradiction factor bites,
   * per difficulty.
   *
   * The gate applied at easy alone until it was measured elsewhere. Sixty
   * seeds per bucket, mean accumulated contradiction cost per mandate:
   *
   *            competent (toolkit rule)   deliberate sabotage
   *   easy               0.00                     7.00
   *   medium             1.23 - 1.31             10.83 - 11.13
   *   hard               1.85 - 1.87             10.35 - 11.33
   *
   * A committee reading noisier data contradicts itself more often without
   * meaning to, which is what the wider allowances are for — and the two
   * populations are six to nine times apart at every difficulty, so a bar
   * between them bills the pattern and never the accident.
   */
  freeContradictionCost: { easy: 0.7, medium: 2.5, hard: 3.0 },
  brokenPromiseScale: 3.0,
  /**
   * Broken promises forgiven before the broken-promise factor bites, per
   * difficulty.
   *
   * Deliberately generous above easy, and this is the one conduct signal that
   * does **not** separate the two populations — it inverts. Measured over the
   * same runs, mean broken promises per mandate: competent honest guidance
   * breaks 1.3 at medium and 3.5-4.2 at hard, while deliberate sabotage breaks
   * 0.0 to 0.6, because a saboteur rewriting its promise every meeting never
   * holds one long enough to mature into a default. Billing this at a bar
   * tuned for easy would therefore have punished exactly the honest play it
   * exists to protect and left the sabotage untouched — the precise inversion
   * of `engine/guidance.test.ts`'s falsifiable criterion that this gate has
   * already been caught causing twice.
   *
   * So the allowance covers what honest play at each difficulty actually
   * produces. What catches sabotage is the churn and contradiction factors,
   * which separate cleanly.
   */
  freeBrokenPromises: { easy: 1, medium: 3, hard: 6 },
  floor: 0.03,
} as const

/**
 * What winning looks like when returning inflation to target is not available.
 *
 * Every other component in this file judges the same objective in every state
 * of the world. Under a cost-push shock that is not a demanding standard, it is
 * an impossible one: the shock raises prices and cuts output at once, no
 * instrument in the game removes it, and the only trajectories that reach
 * target inside a mandate get there by crushing the real economy — which is the
 * error the engine is built to punish. Measured before this existed, an easy
 * mandate opening on a supply crisis scored 3117 on the ECB against 7039 for a
 * political one, and beat doing nothing by 300 points. That is not difficulty;
 * it is being marked down for a target nobody could have hit.
 *
 * The band itself — where "ordinary weather" ends and "the target was not
 * available" begins — is `config/model.ts`'s `SUPPLY_REGIME_BAND`, shared with
 * the engine's own credibility equation. They must agree: a score that forgave
 * a miss the end conditions were still ending the mandate over would be two
 * different games.
 *
 * So the *objective* moves with the regime, and the score follows it. Under
 * cost-push pressure, weight shifts out of `price_stability` and into the two
 * components that measure what a central bank is actually judged on in that
 * regime: `anchoring` — did five-year expectations stay put, so the shock
 * stayed a price-level event rather than becoming an inflation regime — and
 * `shock_response` — was the first round looked through rather than answered by
 * destroying output. This is flexible inflation targeting, which is what real
 * committees say they do and what the textbooks call the right answer.
 *
 * Two things this deliberately does *not* do. It never shifts all the weight:
 * a committee that lets inflation run to double digits through an oil shock has
 * still failed, and `maxShift` keeps most of the price-stability weight in
 * place. And it is driven by the *latent* shock, which the player cannot cause
 * — so it can never be farmed by choosing to do nothing.
 */
export const SUPPLY_REGIME = {
  /**
   * Share of the mandate under cost-push pressure at which the full shift
   * applies.
   *
   * Not 1. A mandate cannot spend all of itself at the peak of a shock — the
   * shock decays, and the meetings either side of it are calm — so the raw
   * mean pressure over a mandate genuinely dominated by cost-push measures
   * only 0.28 to 0.34. Reading that as "a third of a supply-shock mandate"
   * and shifting a third of the way would be an arithmetic mistake dressed as
   * caution: a mandate that spent a third of its meetings fighting a cost-push
   * shock *was* a supply-shock mandate. This is the saturation point that says
   * so.
   */
  shareAtFullShift: 0.3,
  /**
   * The largest share of price-stability weight the regime moves to anchoring
   * and shock response.
   *
   * Half, and the size is measured rather than chosen. Decomposing what a
   * cost-push mandate actually loses on ecb/medium: competent play held
   * employment at 91 % against 93 % in calm weather, financial stability at
   * 99 % against 99 %, the anchor at 95 % against 99 %, and *improved* its
   * shock response to 71 % from 60 % — succeeding on every measure of the
   * regime's own objective — while price stability was marked from 56 % to
   * **zero**. Nearly the whole penalty sat on the one objective that was
   * unavailable.
   *
   * A per-meeting discount on the miss itself was built first and measured
   * nearly inert: it moved price stability from 0 % to 3 %, because the RMSE
   * is dominated not by the shock meetings but by the ones after them, where
   * inflation is still elevated and the shock has already decayed. That
   * persistence is exactly what a central bank *does* stay responsible for —
   * it is the difference between a price-level event and an inflation regime,
   * and `anchoring` is the component that measures it. So the miss is measured
   * honestly and in full, and what changes is how much of the verdict it
   * carries.
   *
   * Never all of it: at half, a cost-push mandate that also lets the anchor go
   * still fails, which is the only outcome that should.
   */
  maxShift: 0.5,
  /** How that moved weight splits between anchoring and shock response. */
  anchoringShare: 0.6,
} as const

/**
 * Shock-response scoring.
 *
 * The engine rewards the textbook distinction: a demand shock should be
 * leaned against, while the first-round effect of a supply shock should
 * largely be looked through, defending expectations rather than crushing
 * output. A large shock is one whose absolute size exceeds this threshold.
 */
export const SHOCK_RESPONSE = {
  /** Absolute shock size, in percentage points, that counts as large. */
  largeShockThreshold: 1.2,
  /** Credit for leaning against a demand shock, per unit of correct response. */
  demandLeanReward: 1.0,
  /** Credit for looking through a supply shock's first-round effect. */
  supplyLookThroughReward: 1.0,
  /** Penalty weight for letting expectations drift during a supply shock. */
  anchoringPenalty: 1.2,
  /** Score awarded when a run contains no large shocks to respond to. */
  neutralScore: 0.6,
} as const
