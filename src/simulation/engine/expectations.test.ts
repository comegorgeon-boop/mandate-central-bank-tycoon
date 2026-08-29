// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { PolicyPackage } from '../types/policy.ts'
import type { LatentState } from '../types/state.ts'
import { HOLD, holds, pathOf, playWithoutEvents, testConfig } from '../testing/harness.ts'

/**
 * Expectations respond to communication, in proportion to credibility.
 *
 * Measured as a difference in differences. Comparing a guidance run against a
 * hold run at one credibility level isolates the effect of the communication;
 * comparing those two effects across credibility levels isolates the role of
 * credibility itself. That removes everything else credibility does to the
 * economy, so what is left is the communication channel alone.
 */

const HORIZON = 6
const config = testConfig('fed', 'hard', 'communication-credibility')

/** Hawkish guidance: a firmly committed signal of a higher path ahead. */
const HAWKISH_GUIDANCE: PolicyPackage = {
  actions: [{ instrument: 'forward_guidance', magnitude: 150 }],
  communication: {
    tone: 'hawkish',
    emphasis: 'inflation',
    commitment: 'strong_commitment',
    channel: 'press_conference',
  },
}

function withCredibility(level: number) {
  return (latent: LatentState): LatentState => ({ ...latent, credibility: level })
}

/** Change in one-year expectations over the horizon, for a given script. */
function expectationsDrift(
  credibility: number,
  first: PolicyPackage,
): number {
  const state = playWithoutEvents(
    config,
    [first, ...holds(HORIZON)],
    withCredibility(credibility),
  )
  const path = pathOf(state, 'expectedInflationShort')
  return path[path.length - 1] - path[0]
}

describe('communication moves expectations', () => {
  it('pulls one-year expectations down when guidance is hawkish', () => {
    const guided = expectationsDrift(85, HAWKISH_GUIDANCE)
    const silent = expectationsDrift(85, HOLD)
    expect(guided).toBeLessThan(silent)
  })
})

describe('credibility scales how far expectations move', () => {
  const highEffect =
    expectationsDrift(85, HAWKISH_GUIDANCE) - expectationsDrift(85, HOLD)
  const lowEffect =
    expectationsDrift(30, HAWKISH_GUIDANCE) - expectationsDrift(30, HOLD)

  it('moves expectations further when the institution is credible', () => {
    expect(Math.abs(highEffect)).toBeGreaterThan(Math.abs(lowEffect))
  })

  it('keeps the same direction at both credibility levels', () => {
    expect(highEffect).toBeLessThan(0)
    expect(lowEffect).toBeLessThan(0)
  })

  it('is a substantial difference, not a rounding artefact', () => {
    expect(Math.abs(highEffect)).toBeGreaterThan(Math.abs(lowEffect) * 1.5)
  })
})

describe('commitment strength scales how far expectations move', () => {
  const strong = HAWKISH_GUIDANCE
  const weak: PolicyPackage = {
    actions: strong.actions,
    communication: { ...strong.communication!, commitment: 'weak_bias' },
  }
  const uncommitted: PolicyPackage = {
    actions: strong.actions,
    communication: { ...strong.communication!, commitment: 'none' },
  }

  const baseline = expectationsDrift(85, HOLD)
  const strongEffect = expectationsDrift(85, strong) - baseline
  const weakEffect = expectationsDrift(85, weak) - baseline
  const uncommittedEffect = expectationsDrift(85, uncommitted) - baseline

  it('moves expectations further the more firmly the path is committed to', () => {
    expect(Math.abs(strongEffect)).toBeGreaterThan(Math.abs(weakEffect))
    expect(Math.abs(weakEffect)).toBeGreaterThan(Math.abs(uncommittedEffect))
  })
})

describe('the market-implied path also responds', () => {
  it('reprices further when guidance is credible', () => {
    const priced = (credibility: number, pkg: PolicyPackage): number => {
      const state = playWithoutEvents(
        config,
        [pkg, ...holds(HORIZON)],
        withCredibility(credibility),
      )
      const path = pathOf(state, 'marketExpectedRate')
      return path[path.length - 1] - path[0]
    }

    const high = priced(85, HAWKISH_GUIDANCE) - priced(85, HOLD)
    const low = priced(30, HAWKISH_GUIDANCE) - priced(30, HOLD)

    expect(high).toBeGreaterThan(0)
    expect(high).toBeGreaterThan(low)
  })
})
