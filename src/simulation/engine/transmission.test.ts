// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Difficulty } from '../types/core.ts'
import type { LagBuffers } from '../types/state.ts'
import { LAG_KERNEL_LENGTH, MEETING_COUNT, SUBSTEPS_PER_MEETING } from '../config/time.ts'
import { buildLagKernel, fillLag, tighteningSpeed } from './lags.ts'
import {
  HOLD,
  READABLE_MULTIPLE,
  difference,
  holds,
  invisibleEffect,
  pathOf,
  playWithoutEvents,
  publishedNoiseSd,
  rateMove,
  readableEffect,
  testConfig,
} from '../testing/harness.ts'

/**
 * Policy transmission and shock identification.
 *
 * Both suites work by differencing a treatment run against a control run that
 * shares its seed. Because the number of random draws per sub-step does not
 * depend on the state, the two runs see exactly the same shock sequence, so
 * every difference between them is caused by the intervention under test.
 *
 * **Every claim about whether an effect is visible or negligible is stated in
 * multiples of that series' own published error, never as a bare number.** A
 * bare threshold cannot tell a working instrument from a broken one: this file
 * used to require a 100bp hike to move core inflation by 0.02pp over a whole
 * mandate, which is a third of the measurement noise on core inflation, and it
 * passed on an economy where the policy rate did essentially nothing. See
 * `publishedNoiseSd` in the harness, and docs/BALANCE.md.
 *
 * The bar is deliberately demanding — three standard deviations of a *single*
 * print. A player reading several consecutive prints does better than that by
 * roughly the square root of their number, so an effect that clears this bar is
 * comfortably legible, and one that does not is a coin flip.
 */

/**
 * Three years. Deliberately long: the point of the two-stage lag is that
 * inflation has barely begun to respond within the first year, so a shorter
 * horizon would be testing the wrong thing.
 */
const HORIZON = 24

describe('policy acts with a lag, not instantly', () => {
  const config = testConfig('fed', 'hard', 'transmission-lag')

  // Treatment hikes 200bp at the first meeting and then holds it there.
  const treatment = playWithoutEvents(config, [rateMove(200), ...holds(HORIZON)])
  const control = playWithoutEvents(config, [HOLD, ...holds(HORIZON)])

  const coreEffect = difference(
    pathOf(treatment, 'inflationCore'),
    pathOf(control, 'inflationCore'),
  )
  const gapEffect = difference(
    pathOf(treatment, 'outputGap'),
    pathOf(control, 'outputGap'),
  )

  it('actually raises the policy rate', () => {
    const rateEffect = difference(
      pathOf(treatment, 'policyRate'),
      pathOf(control, 'policyRate'),
    )
    expect(rateEffect[1]).toBeCloseTo(2, 5)
  })

  it('barely moves core inflation after one meeting', () => {
    // Invisible means invisible *to the player*: below the error on the print.
    expect(Math.abs(coreEffect[1])).toBeLessThan(invisibleEffect('core_inflation', 'hard'))
  })

  it('barely moves the output gap after one meeting', () => {
    expect(Math.abs(gapEffect[1])).toBeLessThan(0.05)
  })

  it('has clearly tightened by the end of the horizon', () => {
    expect(gapEffect[HORIZON]).toBeLessThan(-1)
    expect(coreEffect[HORIZON]).toBeLessThan(-readableEffect('core_inflation', 'hard'))
  })

  it('has barely started after one meeting relative to where it ends', () => {
    // The sharpest statement of "not an instant turn bonus": one meeting in,
    // less than a twentieth of the eventual effect has arrived.
    expect(Math.abs(gapEffect[1]) / Math.abs(gapEffect[HORIZON])).toBeLessThan(0.05)
    expect(Math.abs(coreEffect[1]) / Math.abs(coreEffect[HORIZON])).toBeLessThan(0.05)
  })

  it('has still not fully reached inflation after one year', () => {
    // Eight meetings is a full year of holding the stance. Inflation should
    // have moved, but by much less than output — and by much less than it
    // eventually will.
    expect(Math.abs(coreEffect[8])).toBeLessThan(Math.abs(coreEffect[HORIZON]) * 0.6)
    expect(Math.abs(coreEffect[8])).toBeLessThan(Math.abs(gapEffect[8]))
  })

  it('builds the effect gradually rather than in one step', () => {
    // Each successive meeting must be at least as restrictive as the last:
    // a hump-shaped kernel spreads the impulse instead of delivering it whole.
    for (let meeting = 2; meeting <= HORIZON; meeting += 1) {
      expect(gapEffect[meeting]).toBeLessThanOrEqual(gapEffect[meeting - 1] + 1e-9)
    }
    // And the cumulative effect must keep growing, not plateau immediately.
    expect(Math.abs(gapEffect[HORIZON])).toBeGreaterThan(
      Math.abs(gapEffect[2]) * 4,
    )
  })

  it('reaches inflation later than it reaches output', () => {
    // The gap responds to the rate; inflation responds to the gap. The second
    // stage cannot lead the first.
    const gapHalfLife = coeffFirstCrossing(gapEffect, gapEffect[HORIZON] / 2)
    const coreHalfLife = coeffFirstCrossing(coreEffect, coreEffect[HORIZON] / 2)
    expect(coreHalfLife).toBeGreaterThan(gapHalfLife)
  })
})

/** First meeting at which a (negative) effect path passes `level`. */
function coeffFirstCrossing(path: readonly number[], level: number): number {
  for (let index = 0; index < path.length; index += 1) {
    if (path[index] <= level) return index
  }
  return path.length
}

/** Where the transmission kernel peaks, in meetings. */
function peakLagMeetings(difficulty: Difficulty): number {
  const kernel = buildLagKernel(difficulty)
  let peak = 0
  for (let index = 1; index < kernel.length; index += 1) {
    if (kernel[index] > kernel[peak]) peak = index
  }
  return (peak + 1) / SUBSTEPS_PER_MEETING
}

/**
 * The design decision this file exists to protect.
 *
 * What makes a lag playable is not its length but its ratio to the mandate:
 * how many decision -> effect -> correction loops fit before the mandate ends.
 * Below three, a player's skill cannot show, because the consequence of a
 * decision lands after the credits. See docs/BALANCE.md.
 */
describe('the lag is calibrated on the mandate-to-lag ratio', () => {
  const TARGET_PEAK: Readonly<Record<Difficulty, readonly [number, number]>> = {
    easy: [1, 2],
    medium: [3, 4],
    hard: [6, 8],
  }

  for (const difficulty of ['easy', 'medium', 'hard'] as const) {
    const [low, high] = TARGET_PEAK[difficulty]

    it(`peaks between ${low} and ${high} meetings on ${difficulty}`, () => {
      const peak = peakLagMeetings(difficulty)
      expect(peak).toBeGreaterThanOrEqual(low)
      expect(peak).toBeLessThanOrEqual(high)
    })

    it(`leaves at least three closed loops on ${difficulty}`, () => {
      // One publication lag on top of the transmission lag: the player cannot
      // correct against an effect that has not been published yet.
      const loops = MEETING_COUNT[difficulty] / (peakLagMeetings(difficulty) + 1)
      expect(loops).toBeGreaterThanOrEqual(3)
    })
  }

  it('holds the loop count roughly constant across difficulties', () => {
    // Difficulty must not change how many chances the player gets. It changes
    // whether they can react or have to anticipate.
    const loops = (['easy', 'medium', 'hard'] as const).map(
      (difficulty) => MEETING_COUNT[difficulty] / (peakLagMeetings(difficulty) + 1),
    )
    expect(Math.max(...loops) / Math.min(...loops)).toBeLessThan(1.5)
  })
})

describe('every difficulty closes the loop inside its own mandate', () => {
  for (const difficulty of ['easy', 'medium', 'hard'] as const) {
    const mandate = MEETING_COUNT[difficulty]
    const config = testConfig('fed', difficulty, `loop-${difficulty}`)

    const treatment = playWithoutEvents(config, [rateMove(100), ...holds(mandate)])
    const control = playWithoutEvents(config, [HOLD, ...holds(mandate)])

    const gapEffect = difference(
      pathOf(treatment, 'outputGap'),
      pathOf(control, 'outputGap'),
    )
    const coreEffect = difference(
      pathOf(treatment, 'inflationCore'),
      pathOf(control, 'inflationCore'),
    )
    const headlineEffect = difference(
      pathOf(treatment, 'inflationHeadline'),
      pathOf(control, 'inflationHeadline'),
    )

    describe(difficulty, () => {
      it('has barely moved after one meeting', () => {
        expect(Math.abs(gapEffect[1]) / Math.abs(gapEffect[mandate])).toBeLessThan(0.05)
      })

      it('has clearly moved by the end of the mandate', () => {
        // A single 100bp hike must be worth something the player can *read*
        // before their term is over, at every difficulty — which means it has
        // to clear the error on the print, not merely differ from zero.
        //
        // This is the assertion that used to read `toBeLessThan(-0.02)` and
        // certified an effect a third the size of the noise on the series it
        // moves. It is the reason the easy-mode deadlock reached a playthrough.
        expect(gapEffect[mandate]).toBeLessThan(-0.2)
        expect(coreEffect[mandate]).toBeLessThan(
          -readableEffect('core_inflation', difficulty),
        )
        expect(headlineEffect[mandate]).toBeLessThan(
          -readableEffect('headline_inflation', difficulty),
        )
      })

      it('reaches output before it reaches inflation', () => {
        expect(Math.abs(coreEffect[mandate])).toBeLessThan(
          Math.abs(gapEffect[mandate]),
        )
      })

      it('builds gradually rather than in one step', () => {
        for (let meeting = 2; meeting <= mandate; meeting += 1) {
          expect(gapEffect[meeting]).toBeLessThanOrEqual(gapEffect[meeting - 1] + 1e-9)
        }
      })
    })
  }
})

describe('the cost of tightening runs on the same clock as its benefit', () => {
  /**
   * The design decision this suite protects: the dilemma between price
   * stability and financial stability must be a choice between a delayed cost
   * and a delayed benefit, not between an immediate cost and an invisible one.
   *
   * `tighteningSpeed` used to read the raw one-year change in the real rate
   * gap, so bank duration losses landed the instant the rate moved while the
   * disinflation crossed the kernel *and* the Phillips curve first. On fed/easy
   * that made the trade-off unresolvable rather than hard.
   */
  /** A lag buffer holding `recent` for `age` sub-steps, and `old` before that. */
  function buffers(recent: number, old: number, age: number): LagBuffers {
    const realRateGap = fillLag(old).map((value, index) =>
      index < age ? recent : value,
    )
    return {
      realRateGap,
      balanceSheetImpulse: fillLag(0),
      financialConditions: fillLag(0),
    }
  }

  for (const difficulty of ['easy', 'medium', 'hard'] as const) {
    const kernel = buildLagKernel(difficulty)

    it(`reports no tightening on an unchanged stance on ${difficulty}`, () => {
      expect(tighteningSpeed(buffers(0.5, 0.5, 0), kernel)).toBeCloseTo(0, 10)
    })

    /** The strongest reading a completed 1pp tightening cycle ever produces. */
    const peakOf = (move: number): number => {
      let peak = 0
      for (let age = 1; age <= LAG_KERNEL_LENGTH; age += 1) {
        peak = Math.max(peak, tighteningSpeed(buffers(0.5 + move, 0.5, age), kernel))
      }
      return peak
    }

    it(`keeps the full magnitude of a completed cycle on ${difficulty}`, () => {
      // This fix delays the cost of tightening. It must not discount it: a
      // 1pp cycle has to still peak at 1pp, or the dilemma quietly weakens
      // wherever the kernel is slowest — which is hard, where it should bite
      // hardest.
      expect(peakOf(1)).toBeCloseTo(1, 2)
    })

    it(`scales with the size of the move on ${difficulty}`, () => {
      expect(peakOf(2)).toBeCloseTo(2 * peakOf(1), 6)
    })

    it(`has barely registered a move made this meeting on ${difficulty}`, () => {
      expect(tighteningSpeed(buffers(1.5, 0.5, 1), kernel) / peakOf(1)).toBeLessThan(0.1)
    })
  }

  it('delivers the cost no faster than the demand channel it shares a kernel with', () => {
    // Measured as shares of each channel's own eventual size, so the two are
    // comparable despite living on different scales.
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const mandate = MEETING_COUNT[difficulty]
      const config = testConfig('fed', difficulty, `clock-${difficulty}`)
      const treatment = playWithoutEvents(config, [rateMove(100), ...holds(mandate)])
      const control = playWithoutEvents(config, [HOLD, ...holds(mandate)])

      const stress = difference(
        pathOf(treatment, 'bankingStress'),
        pathOf(control, 'bankingStress'),
      )
      const peakStress = Math.max(...stress.map(Math.abs))

      // One meeting in, a tenth of the cost at most. Before this fix easy
      // delivered 19 % of it on the first meeting.
      expect(Math.abs(stress[1]) / peakStress).toBeLessThan(0.1)
    }
  })
})

describe('the output gap is deliberately unreadable', () => {
  /**
   * The one series the readability rule does not govern, pinned so the
   * exclusion stays a decision rather than an oversight.
   *
   * Potential output is inferred, not measured. Drowning the real-time gap
   * estimate in noise is what reproduces the Orphanides critique the whole
   * engine is built around, and `staffRule.ts` targets core inflation with no
   * gap term precisely because of it. Requiring a policy effect to clear the
   * gap estimate's own noise would demand a 2.9pp move on easy and destroy the
   * information problem on purpose.
   */
  for (const difficulty of ['easy', 'medium', 'hard'] as const) {
    it(`keeps the gap estimate noisier than any policy effect on ${difficulty}`, () => {
      const mandate = MEETING_COUNT[difficulty]
      const config = testConfig('fed', difficulty, `gap-noise-${difficulty}`)
      const treatment = playWithoutEvents(config, [rateMove(100), ...holds(mandate)])
      const control = playWithoutEvents(config, [HOLD, ...holds(mandate)])
      const gapEffect = difference(
        pathOf(treatment, 'outputGap'),
        pathOf(control, 'outputGap'),
      )

      // Noisier than the effect it is supposed to reveal: that is the point.
      expect(publishedNoiseSd('output_gap_estimate', difficulty)).toBeGreaterThan(
        Math.abs(gapEffect[mandate]),
      )
    })
  }

  it('keeps the gap estimate the noisiest number on the table', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      for (const other of ['headline_inflation', 'core_inflation', 'unemployment'] as const) {
        expect(publishedNoiseSd('output_gap_estimate', difficulty)).toBeGreaterThan(
          publishedNoiseSd(other, difficulty),
        )
      }
    }
  })
})

describe('the instrument can reach the target inside the mandate', () => {
  /**
   * The winnability bar, as distinct from the legibility bar above.
   *
   * The player does not run a single 100bp hike; they run a stance. So the
   * question this asks is the one the fed/easy playthrough failed: with the
   * instrument used to the limit the difficulty allows, can inflation be moved
   * by an amount that matters against the size of a typical miss?
   *
   * Measured as a maximum tightening trajectory against the same seed held
   * flat, so it is the whole rate channel and nothing else.
   */
  for (const difficulty of ['easy', 'medium', 'hard'] as const) {
    const mandate = MEETING_COUNT[difficulty]

    it(`moves inflation readably under maximum tightening on ${difficulty}`, () => {
      const config = testConfig('fed', difficulty, `potency-${difficulty}`)
      const maximum = Array.from({ length: mandate }, () => rateMove(100))
      const treatment = playWithoutEvents(config, maximum)
      const control = playWithoutEvents(config, holds(mandate))
      const headlineEffect = difference(
        pathOf(treatment, 'inflationHeadline'),
        pathOf(control, 'inflationHeadline'),
      )

      // Comfortably clear, not marginally: a player who has to max out the
      // instrument to produce a barely-readable effect has no room to steer.
      expect(headlineEffect[mandate]).toBeLessThan(
        -2 * readableEffect('headline_inflation', difficulty),
      )
    })
  }
})

describe('difficulty decides whether the player reacts or anticipates', () => {
  it('delivers more of the same hike within the same number of meetings', () => {
    // Measured over a common eight-meeting window, so the only thing that
    // differs is the kernel.
    const delivered = (difficulty: Difficulty): number => {
      const config = testConfig('fed', difficulty, 'kernel-speed')
      const treatment = playWithoutEvents(config, [rateMove(100), ...holds(8)])
      const control = playWithoutEvents(config, [HOLD, ...holds(8)])
      return Math.abs(
        difference(pathOf(treatment, 'outputGap'), pathOf(control, 'outputGap'))[8],
      )
    }

    expect(delivered('easy')).toBeGreaterThan(delivered('medium'))
    expect(delivered('medium')).toBeGreaterThan(delivered('hard'))
  })
})

describe('demand and supply shocks behave differently', () => {
  const config = testConfig('fed', 'hard', 'shock-identification')
  const control = playWithoutEvents(config, holds(HORIZON))

  const demand = playWithoutEvents(config, holds(HORIZON), (latent) => ({
    ...latent,
    demandShock: latent.demandShock + 2.5,
  }))

  const supply = playWithoutEvents(config, holds(HORIZON), (latent) => ({
    ...latent,
    supplyShock: latent.supplyShock + 2.5,
  }))

  const demandGap = difference(pathOf(demand, 'outputGap'), pathOf(control, 'outputGap'))
  const demandCore = difference(
    pathOf(demand, 'inflationCore'),
    pathOf(control, 'inflationCore'),
  )
  const supplyGap = difference(pathOf(supply, 'outputGap'), pathOf(control, 'outputGap'))
  const supplyCore = difference(
    pathOf(supply, 'inflationCore'),
    pathOf(control, 'inflationCore'),
  )

  it('moves output and inflation the same way after a demand shock', () => {
    expect(demandGap[2]).toBeGreaterThan(0.1)
    expect(demandCore[2]).toBeGreaterThan(0)
    expect(Math.sign(demandGap[2])).toBe(Math.sign(demandCore[2]))
  })

  it('moves output and inflation opposite ways after a supply shock', () => {
    expect(supplyCore[2]).toBeGreaterThan(readableEffect('core_inflation', 'hard'))
    expect(supplyGap[2]).toBeLessThan(0)
    expect(Math.sign(supplyGap[2])).not.toBe(Math.sign(supplyCore[2]))
  })

  it('poses a genuine trade-off only in the supply case', () => {
    // A demand shock lets the committee fix both problems with one instrument.
    // A supply shock forces it to choose, which is the whole difficulty.
    const demandAligned = demandGap[2] * demandCore[2]
    const supplyOpposed = supplyGap[2] * supplyCore[2]
    expect(demandAligned).toBeGreaterThan(0)
    expect(supplyOpposed).toBeLessThan(0)
  })

  it('raises headline inflation more than core after a supply shock', () => {
    const supplyHeadline = difference(
      pathOf(supply, 'inflationHeadline'),
      pathOf(control, 'inflationHeadline'),
    )
    expect(supplyHeadline[1]).toBeGreaterThan(supplyCore[1])
  })
})

describe('the evidence that identifies a shock stays above the noise', () => {
  /**
   * The information ladder's central promise, made testable.
   *
   * docs/BALANCE.md: "the evidence is what persists down the ladder; the name
   * is what gets withdrawn". A player taught only the label learns to obey a
   * label; a player taught that headline running far ahead of core *is* a
   * supply shock can still read the economy at hard, where nothing is named.
   *
   * That promise is empty unless the wedge between headline and core is
   * actually bigger than the combined error on the two prints it is read from.
   * If it is not, then at hard — where `namesShocks` is false — the player is
   * being asked to identify a shock from evidence that is indistinguishable
   * from measurement error, and the ladder's bottom rung is a bluff.
   */
  const LARGE_SUPPLY_SHOCK = 2.5

  for (const difficulty of ['easy', 'medium', 'hard'] as const) {
    it(`keeps the headline-core wedge readable on ${difficulty}`, () => {
      const config = testConfig('fed', difficulty, `wedge-${difficulty}`)
      const control = playWithoutEvents(config, holds(4))
      const supply = playWithoutEvents(config, holds(4), (latent) => ({
        ...latent,
        supplyShock: latent.supplyShock + LARGE_SUPPLY_SHOCK,
      }))

      const headline = difference(
        pathOf(supply, 'inflationHeadline'),
        pathOf(control, 'inflationHeadline'),
      )
      const core = difference(
        pathOf(supply, 'inflationCore'),
        pathOf(control, 'inflationCore'),
      )

      // Reading a wedge means reading two prints, so it carries both errors.
      const wedgeNoise = Math.sqrt(
        publishedNoiseSd('headline_inflation', difficulty) ** 2 +
          publishedNoiseSd('core_inflation', difficulty) ** 2,
      )

      // Two meetings in: early enough that the player can still act on it.
      const wedge = headline[2] - core[2]
      expect(wedge).toBeGreaterThan(READABLE_MULTIPLE * wedgeNoise)
    })
  }
})
