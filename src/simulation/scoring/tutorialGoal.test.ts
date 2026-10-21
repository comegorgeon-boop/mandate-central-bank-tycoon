// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Institution } from '../types/core.ts'
import type { SimulationState } from '../types/state.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { getDifficulty } from '../config/difficulty.ts'
import { getInstitution } from '../config/institutions.ts'
import { createInitialState, createRunConfig } from '../engine/initialState.ts'
import { playRun } from '../replay/replayRun.ts'
import { toolkitPackage } from '../policy/toolkitRule.ts'
import { evaluateEndConditions } from './endConditions.ts'
import { tutorialProgress } from './tutorialGoal.ts'

/**
 * Easy is a tutorial, and a tutorial has a purpose rather than a duration.
 *
 * It used to run twelve meetings because that was the number the transmission
 * calibration needed to make a rate move legible — a good reason for a
 * *mandate* and no reason at all for a lesson. Played, the flaw was plain: the
 * opening crisis was repaired by the third meeting and the remaining nine had
 * nothing in them.
 *
 * So it now opens on a visibly broken economy, states its goal in two numbers,
 * and ends the moment those two have been held. What these tests protect is
 * that the goal is *reachable*, that it is not reached by accident, and that
 * the two institutions are asked the same thing rather than the same numbers.
 */

const INSTITUTIONS: readonly Institution[] = ['fed', 'ecb']

function fresh(institution: Institution, seed = 'tutorial') {
  return createInitialState(
    createRunConfig({
      institution,
      difficulty: 'easy',
      seed,
      simulationVersion: SIMULATION_VERSION,
    }),
  )
}

/** Forces a state onto or off the objective, without touching anything else. */
function at(
  state: SimulationState,
  inflation: number,
  unemployment: number,
  meetings: number,
): SimulationState {
  const latent = { ...state.latent, inflationHeadline: inflation, unemployment }
  return {
    ...state,
    latent,
    meetingIndex: meetings,
    history: Array.from({ length: meetings + 1 }, (_, index) => ({
      meetingIndex: index,
      timeYears: index / 8,
      latent,
      members: [],
    })),
  }
}

describe('the tutorial goal', () => {
  it('exists on easy and nowhere else', () => {
    expect(getDifficulty('easy').tutorialGoal).not.toBeNull()
    expect(getDifficulty('medium').tutorialGoal).toBeNull()
    expect(getDifficulty('hard').tutorialGoal).toBeNull()
  })

  it('asks both institutions the same thing rather than the same numbers', () => {
    // The euro area's sustainable unemployment rate is 6.6 %. An absolute
    // "below 5 %" would have asked its player to hold unemployment 1.6 points
    // below full employment for consecutive meetings — not hard, impossible,
    // and impossible in a way only discoverable by failing repeatedly.
    const bars = INSTITUTIONS.map((institution) => {
      const progress = tutorialProgress(fresh(institution))
      expect(progress).not.toBeNull()
      return progress!
    })
    const [fed, ecb] = bars
    expect(fed.unemploymentBelow).toBeLessThan(ecb.unemploymentBelow)
    for (const bar of bars) {
      const natural = bar.unemploymentBelow
      expect(natural).toBeGreaterThan(0)
    }
    // Each bar sits above its own institution's sustainable rate.
    for (const [index, institution] of INSTITUTIONS.entries()) {
      expect(bars[index].unemploymentBelow).toBeGreaterThan(
        getInstitution(institution).initial.naturalUnemployment,
      )
    }
  })

  it('opens with inflation to fix and employment already in hand', () => {
    /*
     * Employment is met at the opening, and that is the rung rather than an
     * oversight.
     *
     * This flipped twice in two passes, which is worth recording. It first
     * asserted employment was already met (the overheating tutorial). Then
     * "on commence dans le mur" broke both halves and it asserted neither
     * was. Then measurement showed a two-problem tutorial is not a tutorial —
     * competent play solved 13 of 30 against passive's 14 — and the ladder
     * became the *number* of broken readings:
     *
     * > "FACILE : UN SEUL hors des clous, les deux autres sains."
     *
     * So it is back to one problem, for a reason this time: the lesson is
     * that the lever works, and a lever that fixes one thing while costing
     * another is the lesson *after* it.
     */
    for (const institution of INSTITUTIONS) {
      const progress = tutorialProgress(fresh(institution))!
      expect(progress.inflation, institution).toBeGreaterThan(progress.inflationBelow)
      expect(progress.unemployment, institution).toBeLessThan(
        progress.unemploymentBelow,
      )
      expect(progress.onTarget, institution).toBe(false)
    }
  })

  it('is not passed by one good meeting', () => {
    // The whole reason for `heldForMeetings`: a lesson passable on a single
    // quarter teaches waiting for a lucky number rather than steering.
    const state = fresh('fed')
    const held = getDifficulty('easy').tutorialGoal!.heldForMeetings
    const oneGoodMeeting: SimulationState = {
      ...state,
      latent: { ...state.latent, inflationHeadline: 2.0, unemployment: 4.0 },
      meetingIndex: 4,
    }
    const progress = tutorialProgress(oneGoodMeeting)!
    expect(progress.onTarget).toBe(true)
    expect(progress.meetingsHeld).toBeLessThan(held)
    expect(progress.passed).toBe(false)
    expect(evaluateEndConditions(oneGoodMeeting).status).toBe('active')
  })

  it('is passed once both have held long enough', () => {
    const held = getDifficulty('easy').tutorialGoal!.heldForMeetings
    const done = at(fresh('fed'), 2.0, 4.0, held + 2)
    expect(tutorialProgress(done)!.passed).toBe(true)

    const outcome = evaluateEndConditions(done)
    expect(outcome.status).toBe('completed')
    expect(outcome.triggered).toBe('objective_met')
    expect(outcome.summary).toMatch(/held/)
  })

  it('is not passed when only one of the two is met', () => {
    const held = getDifficulty('easy').tutorialGoal!.heldForMeetings
    // Inflation fixed, employment broken.
    expect(tutorialProgress(at(fresh('fed'), 2.0, 9.0, held + 2))!.passed).toBe(false)
    // Employment fine, inflation still high.
    expect(tutorialProgress(at(fresh('fed'), 6.0, 4.0, held + 2))!.passed).toBe(false)
  })

  it('ends unfinished rather than running forever', () => {
    const max = getDifficulty('easy').tutorialGoal!.maxMeetings
    const stuck = at(fresh('fed'), 6.0, 4.0, max)
    const outcome = evaluateEndConditions(stuck)
    expect(outcome.status).toBe('completed')
    expect(outcome.triggered).toBe('objective_missed')
    // The summary has to say what was still wrong, not just that time ran out.
    expect(outcome.summary).toMatch(/inflation at/)
  })

  it('lets a catastrophe outrank the objective', () => {
    // Reaching the goal on the meeting the banking system fails is still a
    // failure. This is the same ordering the scheduled endings use.
    const held = getDifficulty('easy').tutorialGoal!.heldForMeetings
    const state = at(fresh('fed'), 2.0, 4.0, held + 2)
    const doomed: SimulationState = {
      ...state,
      latent: { ...state.latent, bankingStress: 99 },
    }
    let counters = evaluateEndConditions(doomed).breachCounters
    for (let i = 0; i < 4; i += 1) {
      counters = evaluateEndConditions(doomed, counters).breachCounters
    }
    expect(evaluateEndConditions(doomed, counters).triggered).toBe('banking_crisis')
  })
})

describe('the tutorial is winnable, and not by doing nothing', () => {
  // Deliberately few seeds: this runs in the ordinary suite and the effects it
  // guards are large. The full measurement is in docs/BALANCE.md.
  /*
   * Thirty, not fourteen.
   *
   * The bar below is "competent play solves more than half", and at fourteen
   * seeds the estimate landed on exactly 7 — a dead heat with the bar, which
   * fails the assertion while telling you nothing. The same policy measured
   * over thirty seeds solves 0.73 of them (`dev/tutorialFit.ts`).
   *
   * A sample that cannot resolve its own threshold is not a weak test, it is
   * a coin flip wearing one, and this project has now been bitten by that
   * twice — see the forty-seed note in `winnability.test.ts`.
   */
  const RUNS = 30

  function solvedRate(
    institution: Institution,
    choose: Parameters<typeof playRun>[1],
  ): number {
    let solved = 0
    for (let index = 0; index < RUNS; index += 1) {
      const config = createRunConfig({
        institution,
        difficulty: 'easy',
        seed: `tutorial-${index}`,
        simulationVersion: SIMULATION_VERSION,
      })
      if (playRun(config, choose).outcome.triggered === 'objective_met') solved += 1
    }
    return solved / RUNS
  }

  for (const institution of INSTITUTIONS) {
    it(`can be solved by competent play on ${institution}`, () => {
      expect(
        solvedRate(institution, (session) =>
          toolkitPackage(session, institution, 'easy'),
        ),
      ).toBeGreaterThan(0.5)
    })

    it(`is solved less often by doing nothing on ${institution}`, () => {
      // The lesson is that the instrument works. A tutorial an idle player
      // passes as often as an active one teaches the opposite — and the first
      // arrangement of this opening, which damaged *both* halves of the
      // mandate, did exactly that: it healed on its own 57-69 % of the time.
      const competent = solvedRate(institution, (session) =>
        toolkitPackage(session, institution, 'easy'),
      )
      const passive = solvedRate(institution, () => ({
        actions: [],
        communication: null,
      }))
      expect(competent).toBeGreaterThan(passive)
    })
  }
})
