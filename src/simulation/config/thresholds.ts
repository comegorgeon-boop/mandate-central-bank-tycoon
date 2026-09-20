/**
 * Failure and warning thresholds.
 *
 * Every catastrophe family has a warning tier that fires before the failure
 * tier, and every failure requires the condition to hold for several
 * consecutive meetings. A single bad reading, or a single unpopular decision,
 * can never end a run.
 *
 * `thresholdLeniency` from the difficulty config scales these: easy mode
 * needs a more extreme economy before anything triggers.
 */
export const THRESHOLDS = {
  /** Runaway inflation. */
  inflationSpiral: {
    watchInflation: 6,
    failInflation: 12,
    /** Long-run expectations this far above target also count as a spiral. */
    failExpectations: 6,
    meetingsToFail: 3,
  },
  /** Self-reinforcing deflation. */
  deflationSpiral: {
    watchInflation: 0,
    watchOutputGap: -2,
    failInflation: -2,
    failExpectations: 0,
    meetingsToFail: 4,
  },
  /** Depression-level collapse in output and employment. */
  depression: {
    watchOutputGap: -4,
    watchUnemploymentGap: 3,
    failOutputGap: -8,
    failUnemploymentGap: 5,
    meetingsToFail: 4,
  },
  /** Systemic banking crisis. */
  bankingCrisis: {
    watchStress: 55,
    failStress: 85,
    meetingsToFail: 2,
  },
  /** Disorderly sovereign fragmentation. ECB only. */
  fragmentationCrisis: {
    watchSpread: 250,
    failSpread: 500,
    meetingsToFail: 2,
  },
  /** Currency and market dysfunction. */
  currencyDysfunction: {
    watchVolatility: 70,
    failVolatility: 90,
    /** Percentage move of the exchange rate index away from baseline. */
    failExchangeRateMove: 25,
    meetingsToFail: 2,
  },
  /** Expectations no longer pinned: the loss of monetary control. */
  lossOfMonetaryControl: {
    watchAnchoring: 0.4,
    failAnchoring: 0.15,
    /** Long-run expectations this far from target, in percentage points. */
    failExpectationsMiss: 4,
    meetingsToFail: 3,
  },
  /**
   * Giving in: a disinflation abandoned before it worked.
   *
   * Reached only in a historical scenario, because it is the only mode whose
   * opening has expectations far enough above target for the second clause to
   * be true at all. Four meetings is half a year of free real credit with the
   * anchor still adrift, which is a policy rather than a slip — and it is long
   * enough that the actual 1980 episode, three meetings of it, survives.
   */
  capitulation: {
    watchRealRate: 0.5,
    failRealRate: 0,
    /** Long-run expectations this far above target still count as adrift. */
    unanchoredBy: 3,
    /**
     * And inflation itself this far above target, still.
     *
     * The clause that separates giving in from normalising. Without it the
     * condition fires at the *end* of a successful disinflation: inflation
     * back to 4 %, the rate cut to 9 %, and long-run expectations still
     * lagging at 8 because they always lag — which the model would read as
     * capitulation when it is the thing capitulation prevents. Measured on
     * the historical path across thirteen seeds, it was the only failure the
     * real policy produced, and it produced it in 1983 rather than in 1980.
     */
    inflationStillAbove: 4,
    meetingsToFail: 4,
  },
  /**
   * Forced resignation.
   *
   * Requires a sustained collapse in institutional standing: credibility must
   * stay below the failure level for four consecutive meetings. Political
   * pressure alone never dismisses the player.
   */
  dismissal: {
    watchCredibility: 40,
    watchPoliticalPressure: 70,
    failCredibility: 25,
    meetingsToFail: 4,
  },
} as const

/**
 * The shape of the threshold table, with the literal types widened.
 *
 * `THRESHOLDS` is `as const`, so every figure in it is its own literal type
 * and nothing else can be assigned. A historical scenario brings its own
 * numbers for some of them, so the merged table it produces needs a type that
 * says "the same fields, holding numbers".
 */
export type ThresholdSet = {
  readonly [Family in keyof typeof THRESHOLDS]: {
    readonly [Key in keyof (typeof THRESHOLDS)[Family]]: number
  }
}

/** What a scenario may override, family by family. */
export type ThresholdOverrides = {
  readonly [Family in keyof ThresholdSet]?: Partial<ThresholdSet[Family]>
}

/**
 * A shock large enough to justify reversing previously published guidance
 * without paying the full credibility cost, in absolute percentage points of
 * combined inflation and output-gap surprise.
 */
export const GUIDANCE_REVERSAL_JUSTIFICATION = 1.8

/**
 * Meetings before published guidance comes due.
 *
 * Guidance describes the rate "roughly a year out", and eight meetings is one
 * year at every difficulty. At maturity a binding promise is judged — the rate
 * is within tolerance of the announced path or the promise was broken — and
 * the guidance expires either way: a promise about next year cannot go on
 * pulling expectations three years later. Refreshing an unchanged path keeps
 * the original clock, so a promise cannot be kept young forever by restating
 * it.
 */
export const GUIDANCE_HORIZON_MEETINGS = 8

/**
 * How far, in percentage points, the delivered rate may sit from the announced
 * path and still count as keeping the promise — at maturity, and equally when
 * a new announcement replaces a standing one, where a larger walk-back is a
 * broken promise made with words instead of with the rate.
 */
export const GUIDANCE_DELIVERY_TOLERANCE = 0.5
