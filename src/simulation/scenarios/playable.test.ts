// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { PolicyPackage } from '../types/policy.ts'
import type { Scenario } from '../types/scenario.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { availableInstruments, getInstrumentRange, getInstrument } from '../config/instruments.ts'
import { createRunConfig } from '../engine/initialState.ts'
import { playRun } from '../replay/replayRun.ts'
import { calculateScore } from '../scoring/calculateScore.ts'
import { buildTheStandard } from '../../features/result/theStandard.ts'
import { compareMandates } from '../../features/result/doctrineMandates.ts'
import { buildMandateReport } from '../../features/result/report.ts'
import { SCENARIOS, instrumentRangesFor } from './scenarios.ts'

/**
 * Every scenario can be played to its end, and the end screen can be built.
 *
 * This test exists because of a specific failure, and the failure is the one
 * this project keeps having: **952 tests were green over a blank white
 * screen.**
 *
 * `features/result/theStandard.ts` replays the historical rate path to answer
 * "what if I had done what they did", and its replay rule reached for the
 * discount window. The European Central Bank has no discount window, so the
 * replay threw — inside a `useMemo` on the result page, which took the *entire
 * report* down with it. Every euro-area scenario ended on a page with nothing
 * on it. Nothing in the suite noticed, because nothing in the suite had ever
 * finished one of those mandates and then asked for its report.
 *
 * So this plays all six to the end and builds all three of the expensive
 * result-screen computations. It is slower than every other test in the
 * project and it is worth it: the three things it calls are the three that run
 * only once per mandate, in a React render, where a throw is invisible and
 * total.
 */

/** A deliberately dull policy: follow the benchmark path, lend into stress. */
function followHistory(scenario: Scenario) {
  const config = createRunConfig({
    institution: scenario.institution,
    difficulty: scenario.rules,
    seed: 'playable',
    simulationVersion: SIMULATION_VERSION,
    scenario: scenario.id,
  })
  const instrument = getInstrument('policy_rate')
  const range =
    instrument === undefined
      ? { min: -300, max: 300, increment: 25 }
      : getInstrumentRange(instrument, config.difficulty, instrumentRangesFor(config))
  const lendsAtWindow =
    !scenario.withheldInstruments.includes('discount_window') &&
    availableInstruments(scenario.institution, scenario.rules).some(
      (entry) => entry.id === 'discount_window',
    )
  return { config, range, lendsAtWindow }
}

describe.each(SCENARIOS.map((scenario) => [scenario.id, scenario] as const))(
  '%s plays to its end and reports on itself',
  (id, scenario) => {
    const { config, range, lendsAtWindow } = followHistory(scenario)

    const session = playRun(config, (current): PolicyPackage => {
      const index = Math.min(current.state.meetingIndex, scenario.calendar.length - 1)
      const want = scenario.calendar[index].benchmarkRate
      const now = current.state.stance.targetRate
      const raw = Math.round(((want - now) * 100) / range.increment) * range.increment
      const move = Math.max(-range.max, Math.min(range.max, raw))
      const stress = current.state.latent.bankingStress
      const level = stress > 40 ? 3 : stress > 28 ? 2 : stress > 20 ? 1 : 0
      return {
        actions: [
          ...(move === 0 ? [] : [{ instrument: 'policy_rate' as const, magnitude: move }]),
          ...(level === current.state.stance.discountWindowLevel || !lendsAtWindow
            ? []
            : [{ instrument: 'discount_window' as const, magnitude: level }]),
        ],
        communication: null,
      }
    })
    const score = calculateScore(session.state, session.outcome)

    it('reaches an ending rather than throwing', () => {
      expect(session.state.meetingIndex, `${id} served no meetings`).toBeGreaterThan(0)
      expect(['completed', 'failed']).toContain(session.outcome.status)
    })

    it('builds the standard it is compared against', () => {
      // The one that broke. `buildTheStandard` returns null outside a
      // scenario; inside one it must return a comparison, not throw.
      const standard = buildTheStandard(session, score)
      expect(standard, `${id} built no standard`).not.toBeNull()
      expect(standard?.meetings).toHaveLength(scenario.meetingCount)
    })

    it('builds the doctrine comparison', () => {
      // Ten complete alternative mandates on the player's own seed, also in a
      // `useMemo` on the result screen.
      const comparison = compareMandates(session, score)
      expect(comparison.mandates.length, `${id} compared nothing`).toBeGreaterThan(0)
      for (const mandate of comparison.mandates) {
        expect(Number.isFinite(mandate.score.score), mandate.doctrine.id).toBe(true)
      }
    })

    it('builds the written report', () => {
      const report = buildMandateReport(session.state, session.outcome, score)
      // The account is in four sections. "What happened" and "why this score"
      // are always populated; the other two may legitimately be empty when a
      // mandate did nothing notably well or notably badly.
      expect(report.whatHappened.length, `${id} has no account`).toBeGreaterThan(0)
      expect(report.whyThisScore.length, `${id} explains no score`).toBeGreaterThan(0)
      const all = [
        ...report.whatHappened,
        ...report.whatWentWell,
        ...report.whatWentWrong,
        ...report.whyThisScore,
      ]
      for (const sentence of all) {
        expect(sentence.trim().length, `${id} empty sentence`).toBeGreaterThan(0)
        // A template that lost one of its substitutions prints "undefined" or
        // "NaN" into the player's report, which is the shape this kind of
        // prose fails in.
        expect(sentence, sentence.slice(0, 50)).not.toMatch(/undefined|NaN|\[object/)
      }
    })

    it('counts its scripted crises as crises', () => {
      // The written report opened the euro-area mandate with "without a single
      // major crisis to answer" over the Greek programme, the Irish banking
      // collapse, the Italian spread and the announcement of September 2012 —
      // because the majors were counted from the procedural catalogue, which
      // knows nothing about a scenario's own dated events.
      const majors = scenario.events.filter((event) => event.major)
      if (majors.length === 0) return
      const fired = session.state.eventLog.filter((record) =>
        majors.some((event) => event.id === record.eventId),
      )
      // Only the ones whose meeting the mandate actually reached.
      const reachable = majors.filter(
        (event) => event.meetingIndex < session.state.meetingIndex,
      )
      expect(fired.length, `${id} fired none of its scripted majors`).toBe(
        reachable.length,
      )
      if (reachable.length > 0) {
        const report = buildMandateReport(session.state, session.outcome, score)
        expect(report.whatHappened.join(' '), id).not.toContain(
          'without a single major crisis',
        )
      }
    })

    it('scores inside the range the scorecard promises', () => {
      expect(score.score).toBeGreaterThanOrEqual(0)
      expect(score.score).toBeLessThanOrEqual(10_000)
      for (const component of score.components) {
        expect(Number.isFinite(component.raw), component.id).toBe(true)
      }
    })
  },
)
