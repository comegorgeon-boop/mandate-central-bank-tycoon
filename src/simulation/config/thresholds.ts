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
