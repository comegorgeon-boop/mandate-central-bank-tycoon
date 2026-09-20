// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { PolicyPackage } from '../types/policy.ts'
import type { RunSession } from '../replay/replayRun.ts'
import { applyPolicyPackage } from '../engine/applyPolicyPackage.ts'
import { createInitialState, createRunConfig } from '../engine/initialState.ts'
import { generateObservation } from '../observation/generateObservation.ts'
import { playRun, startRun, submitMeeting } from '../replay/replayRun.ts'
import { calculateScore } from '../scoring/calculateScore.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { VOLCKER_1979 } from './volcker.ts'

/**
 * The mechanics a historical scenario adds, tested where they bite.
 *
 * `volcker.test.ts` locks the figures against the document. This file tests
 * that the figures *do* something: that the measurement bias reaches the table
 * the player reads, that tightening really does raise the index the committee
 * is judged on, that the instruments of 2008 are not available in 1979, and
 * that the scenario can be both won and lost in the ways it says.
 */

const CONFIG = () =>
  createRunConfig({
    institution: 'fed',
    difficulty: 'hard',
    seed: 'MECHANICS',
    simulationVersion: SIMULATION_VERSION,
    scenario: 'volcker_1979',
  })

const HOLD: PolicyPackage = { actions: [], communication: null }

function observed(state: ReturnType<typeof createInitialState>) {
  return generateObservation(state, {
    meetingIndex: state.meetingIndex,
    newswire: [],
    clues: [],
  })
}

describe('what was known in 1979', () => {
  it('publishes an output gap that is wrong in one direction', () => {
    // Orphanides: real-time misperceptions averaged -3.6 points after
    // mid-1979. Not noise — noise averages out and a player can learn to
    // discount it. This is a bias, and nobody at the time knows its size.
    const bias = VOLCKER_1979.measurement.seriesBias.output_gap_estimate ?? 0
    expect(bias).toBe(-3.6)

    // Advanced until the estimate has actually been published: it carries a
    // publication lag, so at the opening meeting there is nothing to read.
    let session = startRun(CONFIG())
    let reading: number | null = null
    for (let meeting = 0; meeting < 8; meeting += 1) {
      const value = session.observation.indicators.output_gap_estimate?.value
      if (value != null) {
        reading = value
        break
      }
      const next = submitMeeting(session, HOLD)
      if (!next.ok) break
      session = next.session
    }
    expect(reading, 'the gap estimate never published').not.toBeNull()

    // Wrong, and wrong downward: the bias is several times the series' own
    // first-print error, so the direction survives the noise.
    expect(reading as number).toBeLessThan(session.state.latent.outputGap - 1.5)
  })

  it('makes the rule of thumb read the published table, not the truth', () => {
    // The whole point of the bias: the Taylor ghost on the rate slider is
    // computed from what the player can see. A ghost computed from the latent
    // state would make the argument invisible.
    const state = createInitialState(CONFIG())
    const published = observed(state).taylorBenchmark
    const bias = VOLCKER_1979.measurement.seriesBias.output_gap_estimate ?? 0
    // The gap enters the rule with a positive weight, so a gap read too low
    // pulls the prescribed rate down.
    expect(published).toBeLessThan(
      state.latent.neutralRealRate +
        state.latent.inflationHeadline +
        1.5 * (state.latent.inflationCore - 2),
    )
    expect(bias).toBeLessThan(0)
  })

  it('makes tightening raise the inflation the committee is judged on', () => {
    // The CPI included mortgage interest costs until January 1983, so policy
    // fed straight into the index. You could make your own number worse by
    // doing your job, and for three years you could not see which part of the
    // print was that.
    let tight = startRun(CONFIG())
    let easy = startRun(CONFIG())
    for (let meeting = 0; meeting < 9; meeting += 1) {
      const up = submitMeeting(tight, {
        actions: [{ instrument: 'policy_rate', magnitude: 200 }],
        communication: null,
      })
      const flat = submitMeeting(easy, HOLD)
      if (!up.ok || !flat.ok) break
      tight = up.session
      easy = flat.session
    }

    const gap =
      tight.state.latent.policyRate - tight.state.history[1].latent.policyRate
    expect(gap, 'the tightening arm did not tighten').toBeGreaterThan(4)

    // Compared on the *published* print against the latent truth in the same
    // world, which isolates the measurement effect from the economics: the
    // tightening arm's published headline stands above its own latent value.
    const printed = observed(tight.state).indicators.headline_inflation?.value
    expect(printed).toBeDefined()
    expect(printed as number).toBeGreaterThan(tight.state.latent.inflationHeadline)

    // And the easing arm's does not.
    const flatPrint = observed(easy.state).indicators.headline_inflation?.value
    expect(flatPrint as number).toBeLessThan(
      easy.state.latent.inflationHeadline + 1,
    )
  })

  it('ends the distortion when the methodology changed', () => {
    expect(VOLCKER_1979.measurement.ratePassThroughEndsAt).toBe(28)
    expect(VOLCKER_1979.calendar[28].date).toBe('1983-02-08')
  })
})

describe('the Fed of 1979 is not the Fed of today', () => {
  const state = createInitialState(CONFIG())

  for (const instrument of [
    'iorb_spread',
    'asset_purchases',
    'balance_sheet_runoff',
    'reverse_repo',
    'forward_guidance',
  ] as const) {
    it(`refuses ${instrument}, which did not exist yet`, () => {
      const result = applyPolicyPackage(state, {
        actions: [{ instrument, magnitude: 1 }],
        communication: null,
      })
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.validation.rejections.map((entry) => entry.code)).toContain(
        'unavailable_in_scenario',
      )
    })
  }

  it('refuses a binding promise from a committee that announces nothing', () => {
    // The FOMC did not announce its policy decisions until 1994, and after
    // October 1979 it was not targeting the rate it would have been
    // announcing. Talking is still allowed; promising is not.
    const result = applyPolicyPackage(state, {
      actions: [],
      communication: {
        tone: 'hawkish',
        emphasis: 'inflation',
        commitment: 'strong_commitment',
        channel: 'press_conference',
      },
    })
    expect(result.ok).toBe(false)
  })

  it('still allows the committee to speak', () => {
    const result = applyPolicyPackage(state, {
      actions: [],
      communication: {
        tone: 'hawkish',
        emphasis: 'inflation',
        commitment: 'weak_bias',
        channel: 'press_conference',
      },
    })
    expect(result.ok).toBe(true)
  })

  it('lets the rate move further than a modern desk allows', () => {
    // The effective funds rate moved by more than 200 bp between consecutive
    // labelled meetings ten times in this period, and by 621 bp once, so a
    // player capped at 200 could not reach the path the standard compares them
    // with.
    const result = applyPolicyPackage(state, {
      actions: [{ instrument: 'policy_rate', magnitude: 275 }],
      communication: null,
    })
    expect(result.ok).toBe(true)
  })
})

describe('the October 1979 decision', () => {
  it('is offered at the meeting that offered it, and nowhere else', () => {
    const opening = createInitialState(CONFIG())
    expect(VOLCKER_1979.procedureChoiceAt).toBe(1)

    const tooEarly = applyPolicyPackage(opening, {
      actions: [],
      communication: null,
      procedure: 'reserve_target',
    })
    expect(tooEarly.ok, 'accepted at meeting 0').toBe(false)

    const first = submitMeeting(startRun(CONFIG()), HOLD)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const onTheDay = applyPolicyPackage(first.session.state, {
      actions: [],
      communication: null,
      procedure: 'reserve_target',
    })
    expect(onTheDay.ok, 'refused at the meeting that offers it').toBe(true)
  })

  it('turns the dial into a midpoint the market moves away from', () => {
    // Under reserve targeting the rate is an outcome, which is how it reached
    // 19 % without anybody voting for 19 %.
    let session = startRun(CONFIG())
    const first = submitMeeting(session, HOLD)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    session = first.session

    const switched = submitMeeting(session, {
      actions: [],
      communication: null,
      procedure: 'reserve_target',
    })
    expect(switched.ok).toBe(true)
    if (!switched.ok) return

    expect(switched.session.state.stance.operatingProcedure).toBe('reserve_target')
    const voted = switched.session.state.stance.targetRate
    const prevailed = switched.session.state.history.at(-1)!.latent.policyRate
    expect(Math.abs(prevailed - voted), 'the rate did not leave the midpoint')
      .toBeGreaterThan(0.05)
  })

  it('leaves an ordinary mandate voting a rate, with nothing to choose', () => {
    const fictional = createInitialState(
      createRunConfig({
        institution: 'fed',
        difficulty: 'hard',
        seed: 'MECHANICS',
        simulationVersion: SIMULATION_VERSION,
      }),
    )
    expect(fictional.stance.operatingProcedure).toBe('rate_target')
    const result = applyPolicyPackage(fictional, {
      actions: [],
      communication: null,
      procedure: 'reserve_target',
    })
    expect(result.ok).toBe(false)
  })
})

describe('the mandate can be won, and lost the way it says', () => {
  /**
   * A chair who holds the real rate positive and lends while doing it.
   *
   * Both halves matter and the second is the one a player discovers late:
   * tightening this hard without supporting the banks ends the mandate in a
   * banking crisis, which is the period's own lesson and very nearly its
   * history. Measured over twenty seeds, this rule serves the full term about
   * half the time; the rest end in a banking crisis or an inflation spiral,
   * which are the two ways this economy actually breaks.
   */
  function resolute(session: RunSession): PolicyPackage {
    const latent = session.state.latent
    const want = latent.inflationHeadline + 2 + 0.5 * (latent.inflationCore - 2)
    const raw = Math.round(((want - session.state.stance.targetRate) * 100) / 25) * 25
    let move = Math.max(-100, Math.min(100, raw))
    if (session.state.stance.targetRate + move / 100 < 0) {
      move = -Math.floor(session.state.stance.targetRate * 4) * 25
    }
    const stress = latent.bankingStress
    const window = stress > 34 ? 3 : stress > 24 ? 2 : stress > 14 ? 1 : 0
    const swaps = stress > 29 ? 2 : stress > 19 ? 1 : 0
    return {
      actions: [
        ...(move === 0 ? [] : [{ instrument: 'policy_rate' as const, magnitude: move }]),
        ...(window === session.state.stance.discountWindowLevel
          ? []
          : [{ instrument: 'discount_window' as const, magnitude: window }]),
        ...(swaps === session.state.stance.swapLinesLevel
          ? []
          : [{ instrument: 'swap_lines' as const, magnitude: swaps }]),
      ],
      communication: null,
    }
  }

  /** A seed this rule wins on. Named, because the claim has to be checkable. */
  const WON = createRunConfig({
    institution: 'fed',
    difficulty: 'hard',
    seed: 'DISINFLATION',
    simulationVersion: SIMULATION_VERSION,
    scenario: 'volcker_1979',
  })

  it('is winnable: resolve brings inflation down and serves the term', () => {
    const session = playRun(WON, resolute)
    expect(session.state.meetingIndex, session.outcome.label ?? '').toBe(32)
    const opened = session.state.history[0].latent.inflationHeadline
    const closed = session.state.history.at(-1)!.latent.inflationHeadline
    expect(opened).toBeGreaterThan(11)
    expect(closed, 'the disinflation never happened').toBeLessThan(opened - 6)
  })

  it('costs what it costs: the recession is visible', () => {
    // The whole point of the scenario. A disinflation that arrived free would
    // be teaching the opposite of the sacrifice ratio.
    const session = playRun(WON, resolute)
    const worst = session.state.history.reduce(
      (highest, snapshot) => Math.max(highest, snapshot.latent.unemployment),
      0,
    )
    const opening = session.state.history[0].latent.unemployment
    expect(worst - opening).toBeGreaterThan(1.5)
    const trough = session.state.history.reduce(
      (lowest, snapshot) => Math.min(lowest, snapshot.latent.outputGap),
      0,
    )
    expect(trough).toBeLessThan(-3)
  })

  it('is lost by giving in, not by being hated', () => {
    // Cut hard and early, and keep the rate under the inflation rate: the
    // trap of 1980. Political pressure alone never ends this mandate —
    // dismissal is out of reach by design, because the person who actually
    // held this office through it was reappointed.
    const session = playRun(CONFIG(), (current) => {
      const target = current.state.stance.targetRate
      const move = target > 3 ? -300 : 0
      return {
        actions: move === 0 ? [] : [{ instrument: 'policy_rate', magnitude: move }],
        communication: null,
      }
    })
    expect(session.outcome.triggered).toBe('gave_in')
    expect(session.state.latent.politicalPressure).toBeGreaterThan(0)
    expect(calculateScore(session.state, session.outcome).score).toBeLessThan(6000)
  })

  it('cannot be lost by dismissal, which is the historical fact', () => {
    expect(VOLCKER_1979.thresholds.dismissal?.failCredibility).toBe(0)
  })
})
