// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { SIMULATION_VERSION } from '../version.ts'
import { SUBSTEPS_PER_MEETING, YEARS_PER_MEETING } from '../config/time.ts'
import { createRunConfig } from '../engine/initialState.ts'
import { advanceTrueState, advanceTrueStateTraced } from '../engine/advanceTrueState.ts'
import { applyPolicyPackage } from '../engine/applyPolicyPackage.ts'
import { createInitialState } from '../engine/initialState.ts'
import { startRun, submitMeeting } from '../replay/replayRun.ts'
import { getSeries } from './series.ts'
import { LIVE_SERIES, calendarLabel } from './interval.ts'

/**
 * The interval the player watches must be the interval the engine ran.
 *
 * The brief was explicit: "everything shown must be what the engine actually
 * calculated — no decorative animation". The two ways to break that are
 * interpolating between meetings, and letting a *statistic* into the
 * animation — inflation ticking upward through a quarter would teach the
 * player that statistics are live, which is the opposite of the lag this whole
 * game is built on. Both are pinned here.
 */

function freshState() {
  const config = createRunConfig({
    institution: 'fed',
    difficulty: 'easy',
    seed: 'interval',
    simulationVersion: SIMULATION_VERSION,
  })
  return createInitialState(config, { openingEvent: false })
}

describe('the traced advance', () => {
  it('is the same advance, with the sub-steps kept', () => {
    const state = freshState()
    // The untraced call must be exactly the traced one with the trace thrown
    // away, or the animation and the simulation are two different things.
    expect(advanceTrueState(state)).toEqual(advanceTrueStateTraced(state).state)
  })

  it('keeps one frame per internal sub-step', () => {
    const { steps } = advanceTrueStateTraced(freshState())
    expect(steps).toHaveLength(SUBSTEPS_PER_MEETING)
  })

  it('ends on exactly the state the meeting opens with', () => {
    const { state, steps } = advanceTrueStateTraced(freshState())
    // Not "close to": the last frame IS the next meeting's latent state, so
    // the animation cannot drift away from the numbers that follow it.
    expect(steps[steps.length - 1].latent).toEqual(state.latent)
    expect(steps[steps.length - 1].stepIndex).toBe(state.stepIndex)
  })
})

describe('what the player may watch', () => {
  it('animates only prices that are exact, immediate and never revised', () => {
    expect(LIVE_SERIES.length).toBeGreaterThan(0)
    for (const id of LIVE_SERIES) {
      const series = getSeries(id)
      expect(series, id).toBeDefined()
      if (series === undefined) continue
      expect(series.category, id).toBe('market_data')
      expect(series.publicationLagMeetings, id).toBe(0)
      expect(series.revisionLagMeetings, id).toBe(0)
      expect(series.baseNoiseSd, id).toBe(0)
    }
  })

  it('never animates a statistic', () => {
    // The load-bearing exclusion. If one of these ever appears in a frame, the
    // interval is telling the player that inflation is observable in real time.
    for (const id of ['headline_inflation', 'core_inflation', 'unemployment', 'output_gap_estimate'] as const) {
      expect(LIVE_SERIES).not.toContain(id)
    }
  })

  it('carries readings that match the series definitions exactly', () => {
    const session = startRun(
      createRunConfig({
        institution: 'fed',
        difficulty: 'easy',
        seed: 'interval-frames',
        simulationVersion: SIMULATION_VERSION,
      }),
    )
    const result = submitMeeting(session, {
      actions: [{ instrument: 'policy_rate', magnitude: 50 }],
      communication: null,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const frames = result.session.interval
    expect(frames).toHaveLength(SUBSTEPS_PER_MEETING)

    // The last frame's readings must equal what the meeting itself publishes
    // for those series, because both are exact reads of the same state.
    const last = frames[frames.length - 1]
    for (const id of LIVE_SERIES) {
      const published = result.session.observation.indicators[id]?.value
      if (published === undefined || published === null) continue
      const decimals = getSeries(id)?.decimals ?? 2
      expect(Number(last.markets[id]?.toFixed(decimals)), id).toBeCloseTo(
        published,
        decimals,
      )
    }
  })

  it('advances the clock by exactly one meeting across the interval', () => {
    const session = startRun(
      createRunConfig({
        institution: 'ecb',
        difficulty: 'medium',
        seed: 'interval-clock',
        simulationVersion: SIMULATION_VERSION,
      }),
    )
    const result = submitMeeting(session, { actions: [], communication: null })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const frames = result.session.interval
    expect(frames[frames.length - 1].timeYears - frames[0].timeYears).toBeCloseTo(
      YEARS_PER_MEETING - YEARS_PER_MEETING / SUBSTEPS_PER_MEETING,
      10,
    )
    expect(frames[frames.length - 1].progress).toBe(1)
  })

  it('has no interval to play at the very first meeting', () => {
    const session = startRun(
      createRunConfig({
        institution: 'fed',
        difficulty: 'easy',
        seed: 'interval-first',
        simulationVersion: SIMULATION_VERSION,
      }),
    )
    expect(session.interval).toHaveLength(0)
  })

  it('reports a consequence at the sub-step it actually landed', () => {
    // A delayed effect queued three sub-steps out must be announced on that
    // frame and not before, or the wire is telling the player about something
    // that has not happened yet.
    const state = freshState()
    const applied = applyPolicyPackage(state, { actions: [], communication: null })
    expect(applied.ok).toBe(true)
    if (!applied.ok) return

    const queued = {
      ...applied.state,
      pendingEffects: [
        {
          eventId: 'energy_price_spike',
          fireAtStep: applied.state.stepIndex + 2,
          effects: [{ variable: 'supplyShock' as const, delta: 1 }],
        },
      ],
    }
    const { steps } = advanceTrueStateTraced(queued)
    const landedAt = steps.findIndex((step) => step.landedEventIds.length > 0)
    expect(landedAt).toBe(2)
  })
})

describe('the mandate calendar', () => {
  it('counts from the mandate opening rather than naming a real year', () => {
    // A fictional simulation pinned to a real year invites being read as a
    // forecast of it.
    expect(calendarLabel(0)).toBe('January, year 1')
    expect(calendarLabel(1)).toBe('January, year 2')
    expect(calendarLabel(0.5)).toBe('July, year 1')
  })

  it('advances visibly across a mandate', () => {
    const labels = new Set(
      Array.from({ length: 12 }, (_, meeting) => calendarLabel(meeting * YEARS_PER_MEETING)),
    )
    // Eight meetings a year over twelve meetings must not read as one date.
    expect(labels.size).toBeGreaterThan(6)
  })
})
