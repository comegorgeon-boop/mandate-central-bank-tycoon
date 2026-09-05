// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { IndicatorObservation, ObservationSet, SeriesId } from '../../simulation/index.ts'
import { SIMULATION_VERSION } from '../../simulation/index.ts'
import { createInitialState, createRunConfig } from '../../simulation/index.ts'
import { applyPolicyPackage } from '../../simulation/index.ts'
import { generateObservation } from '../../simulation/index.ts'
import { guidancePreview } from './guidancePreview.ts'

/**
 * The estimate shown at confirmation must be the mechanism, not a story about
 * it.
 *
 * The player's report was that announcing something felt like it changed
 * nothing. Measured, that was false by four to ten standard errors — but
 * nothing on the screen connected the sentence they picked to the numbers it
 * moved, and the same-day reaction panel only appears *after* the decision is
 * taken. A preview that drifted from `applyPolicyPackage` would be worse than
 * no preview at all, so the load-bearing test here is the last one: it plays
 * the announcement through the real engine and checks the estimate against what
 * actually happened.
 */

function indicator(seriesId: SeriesId, value: number): IndicatorObservation {
  return {
    seriesId,
    label: seriesId,
    unit: '%',
    definition: 'definition',
    meaning: 'meaning',
    category: 'market_data',
    value,
    previous: value,
    revision: null,
    publicationLagMeetings: 0,
    trend: [value],
    uncertainty: 0,
    missing: false,
  }
}

function observation(credibility: number, priced: number): ObservationSet {
  return {
    meetingIndex: 0,
    indicators: {
      credibility_index: indicator('credibility_index', credibility),
      market_expected_rate: indicator('market_expected_rate', priced),
    },
    forecasts: [],
    newswire: [],
    clues: [],
    taylorBenchmark: 3,
    diagnosis: null,
  }
}

describe('the guidance preview', () => {
  it('moves nothing when the announcement binds nothing', () => {
    const preview = guidancePreview({
      observation: observation(70, 3),
      announcedRate: 4,
      commitment: 'none',
      meetingIndex: 0,
    })
    expect(preview.pricedPathMove).toBe(0)
    expect(preview.expectationsPullPerYear).toBe(0)
    expect(preview.binding).toBe(false)
    expect(preview.judgedAtMeeting).toBeNull()
  })

  it('grows with the commitment the committee is willing to make', () => {
    const at = (commitment: 'weak_bias' | 'conditional_path') =>
      guidancePreview({
        observation: observation(70, 3),
        announcedRate: 4,
        commitment,
        meetingIndex: 0,
      })
    expect(at('conditional_path').pricedPathMove).toBeGreaterThan(
      at('weak_bias').pricedPathMove,
    )
    expect(at('conditional_path').binding).toBe(true)
    expect(at('weak_bias').binding).toBe(false)
  })

  it('grows with credibility, because a promise is worth what the promiser is', () => {
    const at = (credibility: number) =>
      guidancePreview({
        observation: observation(credibility, 3),
        announcedRate: 4,
        commitment: 'conditional_path',
        meetingIndex: 0,
      }).pricedPathMove
    expect(at(90)).toBeGreaterThan(at(45))
    expect(at(45)).toBeGreaterThan(at(10))
  })

  it('is signed by the distance to what markets already price, not by the rate', () => {
    // Announcing a path markets have already priced moves nothing; the whole
    // channel is the *surprise*, which is the point the desk copy makes too.
    expect(
      guidancePreview({
        observation: observation(70, 4),
        announcedRate: 4,
        commitment: 'conditional_path',
        meetingIndex: 0,
      }).pricedPathMove,
    ).toBe(0)
    expect(
      guidancePreview({
        observation: observation(70, 5),
        announcedRate: 4,
        commitment: 'conditional_path',
        meetingIndex: 0,
      }).pricedPathMove,
    ).toBeLessThan(0)
  })

  it('names the meeting a promise comes due', () => {
    const preview = guidancePreview({
      observation: observation(70, 3),
      announcedRate: 4,
      commitment: 'conditional_path',
      meetingIndex: 5,
    })
    expect(preview.judgedAtMeeting).toBeGreaterThan(5)
  })

  it('predicts what the engine actually does on the day', () => {
    const config = createRunConfig({
      institution: 'fed',
      difficulty: 'easy',
      seed: 'guidance-preview',
      simulationVersion: SIMULATION_VERSION,
    })
    const state = createInitialState(config, { openingEvent: false })
    const published = generateObservation(state, {
      meetingIndex: 0,
      newswire: [],
      clues: [],
    })

    const signal = 100
    const announcedRate = state.stance.targetRate + signal / 100
    const preview = guidancePreview({
      observation: published,
      announcedRate,
      commitment: 'conditional_path',
      meetingIndex: 0,
    })

    const applied = applyPolicyPackage(state, {
      actions: [{ instrument: 'forward_guidance', magnitude: signal }],
      communication: {
        tone: 'hawkish',
        emphasis: 'inflation',
        commitment: 'conditional_path',
        channel: 'statement',
      },
    })
    expect(applied.ok).toBe(true)
    if (!applied.ok) return

    const actual =
      applied.state.latent.marketExpectedRate - state.latent.marketExpectedRate

    // Both point the same way and are the same order of magnitude. Not exact,
    // and deliberately so: the preview reads the *published* credibility survey
    // and priced path, which carry their own measurement error, while the
    // engine moves the latent ones. Promising the player an exact number off
    // noisy inputs would be the same dishonesty as a plain-language headline
    // calling a gap inside its own error bar a distance.
    expect(Math.sign(preview.pricedPathMove)).toBe(Math.sign(actual))
    expect(Math.abs(preview.pricedPathMove - actual)).toBeLessThan(
      Math.abs(actual) * 0.6 + 0.05,
    )
  })
})
