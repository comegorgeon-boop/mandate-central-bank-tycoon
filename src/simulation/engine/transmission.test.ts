// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Difficulty } from '../types/core.ts'
import { MEETING_COUNT, SUBSTEPS_PER_MEETING } from '../config/time.ts'
import { buildLagKernel } from './lags.ts'
import {
  HOLD,
  difference,
  holds,
  pathOf,
  playWithoutEvents,
  rateMove,
  testConfig,
} from '../testing/harness.ts'

/**
 * Policy transmission and shock identification.
 *
 * Both suites work by differencing a treatment run against a control run that
 * shares its seed. Because the number of random draws per sub-step does not
 * depend on the state, the two runs see exactly the same shock sequence, so
 * every difference between them is caused by the intervention under test.
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
    expect(Math.abs(coreEffect[1])).toBeLessThan(0.05)
  })

  it('barely moves the output gap after one meeting', () => {
    expect(Math.abs(gapEffect[1])).toBeLessThan(0.05)
  })

  it('has clearly tightened by the end of the horizon', () => {
    expect(gapEffect[HORIZON]).toBeLessThan(-1)
    expect(coreEffect[HORIZON]).toBeLessThan(-0.25)
  })

  it('has barely started after one meeting relative to where it ends', () => {
    // The sharpest statement of "not an instant turn bonus": one meeting in,
    // less than a twentieth of the eventual effect has arrived.
    expect(Math.abs(gapEffect[1]) / Math.abs(gapEffect[HORIZON])).toBeLessThan(0.05)
    expect(Math.abs(coreEffect[1]) / Math.abs(coreEffect[HORIZON])).toBeLessThan(0.05)
  })

  it('has still not fully reached inflation after one year', () => {
    // Eight meetings is a full year of holding the stance. Inflation should
    // have moved, but only slightly, and by much less than output.
    expect(Math.abs(coreEffect[8])).toBeLessThan(0.1)
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

    describe(difficulty, () => {
      it('has barely moved after one meeting', () => {
        expect(Math.abs(gapEffect[1]) / Math.abs(gapEffect[mandate])).toBeLessThan(0.05)
      })

      it('has clearly moved by the end of the mandate', () => {
        // A single 100bp hike must be worth something the player can read
        // before their term is over, at every difficulty.
        expect(gapEffect[mandate]).toBeLessThan(-0.2)
        expect(coreEffect[mandate]).toBeLessThan(-0.02)
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
    expect(supplyCore[2]).toBeGreaterThan(0.1)
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
