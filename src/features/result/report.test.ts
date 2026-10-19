// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  SIMULATION_VERSION,
  calculateScore,
  createInitialState,
  createRunConfig,
  evaluateEndConditions,
  isMajorEvent,
  playRun,
  type EndConditionResult,
} from '../../simulation/index.ts'
import { buildMandateReport } from './report.ts'

/**
 * The written postmortem is assembled from a finished session's own data —
 * `eventLog`, `score.components`' existing `explanation` prose, the
 * guidance ledger, `outcome` — so these tests play real sessions rather than
 * hand-rolling fixtures wherever a real one is easy to produce.
 */

function completedSession(seed: string, difficulty: 'easy' | 'medium' = 'easy') {
  const config = createRunConfig({
    institution: 'fed',
    difficulty,
    seed,
    simulationVersion: SIMULATION_VERSION,
  })
  const session = playRun(config, () => ({ actions: [], communication: null }))
  return {
    state: session.state,
    outcome: session.outcome,
    score: calculateScore(session.state, session.outcome),
  }
}

function nonEmpty(paragraphs: readonly string[]): void {
  expect(paragraphs.length).toBeGreaterThan(0)
  for (const paragraph of paragraphs) {
    expect(paragraph.length).toBeGreaterThan(0)
    expect(paragraph).not.toMatch(/undefined|NaN|\[object/)
  }
}

describe('the mandate report', () => {
  it('is deterministic: the same finished session always produces the same report', () => {
    const { state, outcome, score } = completedSession('report-determinism')
    const a = buildMandateReport(state, outcome, score)
    const b = buildMandateReport(state, outcome, score)
    expect(a).toEqual(b)
  })

  it('every section is non-empty, readable prose, on a completed easy mandate', () => {
    const { state, outcome, score } = completedSession('report-easy')
    const report = buildMandateReport(state, outcome, score)
    nonEmpty(report.whatHappened)
    nonEmpty(report.whatWentWell)
    nonEmpty(report.whatWentWrong)
    nonEmpty(report.whyThisScore)
  })

  it('names the opening major event by title, on easy', () => {
    const { state, outcome, score } = completedSession('report-opener')
    const opener = state.eventLog.find((record) => record.meetingIndex === 0)
    expect(opener).toBeDefined()
    if (opener === undefined) return

    const report = buildMandateReport(state, outcome, score)
    expect(report.whatHappened.join(' ')).toContain(opener.title)
  })

  it('opens with no scripted crisis on medium, where the mandate is not handed a culprit', () => {
    // Read off the *initial* state, not off a finished run. `resolveEvent`
    // runs between meetings and stamps whatever fires before the second
    // meeting with `meetingIndex: 0` too, so a played mandate cannot tell a
    // scripted opener apart from an ordinary early firing. This assertion used
    // to be made against a finished run and passed only because the seed it
    // happened to use drew nothing in that window.
    const config = createRunConfig({
      institution: 'fed',
      difficulty: 'medium',
      seed: 'report-medium',
      simulationVersion: SIMULATION_VERSION,
    })
    expect(createInitialState(config).eventLog).toHaveLength(0)
  })

  it('falls back to the smaller developments when no major event ever fired', () => {
    // **Constructed, not searched for.** This used to hunt forty seeds for a
    // mandate that happened not to draw a major, which worked while majors
    // were a rare draw and stopped working the day the generator was made to
    // produce three or four a mandate — the search ran out of seeds and the
    // test failed over a change that was entirely intentional.
    //
    // A report with no majors in its log is a perfectly ordinary thing to
    // ask the report builder for: it is what a mandate that ended in its
    // third meeting looks like. So it is handed one, rather than the suite
    // depending on the event generator staying quiet enough to find one.
    const { state, outcome, score } = completedSession('report-quiet', 'medium')
    const quiet = {
      ...state,
      eventLog: state.eventLog.filter((record) => !isMajorEvent(record.eventId)),
    }

    const report = buildMandateReport(quiet, outcome, score)
    nonEmpty(report.whatHappened)
    expect(report.whatHappened.join(' ')).toMatch(/quiet|smaller development/)
  })

  it('omits the promise-ledger callouts when nothing was ever announced', () => {
    const { state, outcome, score } = completedSession('report-silent')
    expect(state.guidance.brokenPromises).toBe(0)
    expect(state.guidance.keptPromises).toBe(0)

    const report = buildMandateReport(state, outcome, score)
    expect(report.whatWentWell.join(' ')).not.toMatch(/kept promise/)
    expect(report.whatWentWrong.join(' ')).not.toMatch(/broken/)
  })

  it('weaves the failure summary and leading cause into what happened, on a failed mandate', () => {
    const { state, score } = completedSession('report-failed')
    const failed: EndConditionResult = {
      status: 'failed',
      triggered: 'banking_crisis',
      label: 'Systemic banking crisis',
      summary: 'Stress in the banking system passed the point of self-correction.',
      causalChain: [
        { label: 'Speed of tightening', contribution: 0.6, detail: 'Rapid tightening imposed duration losses.' },
        { label: 'Liquidity support', contribution: 0.4, detail: 'Emergency facilities were not escalated.' },
      ],
      warnings: [],
      breachCounters: {},
    }

    const report = buildMandateReport(state, failed, score)
    const text = report.whatHappened.join(' ')
    expect(text).toContain(failed.summary)
    expect(text).toContain('Rapid tightening imposed duration losses.')
  })

  it('leads "why this score" with conduct when the conduct gate is the dominant story', () => {
    const config = createRunConfig({
      institution: 'fed',
      difficulty: 'easy',
      seed: 'report-sabotage',
      simulationVersion: SIMULATION_VERSION,
    })
    // Alternating +/-100bp, announcing the opposite of the move each time —
    // the same pattern events/openingCrisis.test.ts and this session's
    // diagnostic work used to falsify the score-discrimination fix.
    const session = playRun(config, (current) => {
      const meetingIndex = current.state.meetingIndex
      const up = meetingIndex % 2 === 0
      const moveBp = up ? 100 : -100
      const signalBp = up ? -100 : 100
      return {
        actions: [
          { instrument: 'policy_rate', magnitude: moveBp },
          { instrument: 'forward_guidance', magnitude: signalBp },
        ],
        communication: {
          tone: signalBp > 0 ? 'hawkish' : 'dovish',
          emphasis: 'inflation',
          commitment: 'weak_bias',
          channel: 'statement',
        },
      }
    })
    const score = calculateScore(session.state, session.outcome)
    expect(score.conductGate).toBeLessThan(0.5)
    expect(session.outcome.status).toBe('failed')

    const report = buildMandateReport(session.state, session.outcome, score)
    const text = report.whyThisScore.join(' ')
    expect(text).toMatch(/conduct/)
    expect(text).toMatch(/reversed direction/)
  })

  it('never claims the full mandate was served when it was not', () => {
    const { state, score } = completedSession('report-early-end')
    const failed: EndConditionResult = {
      ...evaluateEndConditions(state),
      status: 'failed',
      triggered: 'dismissed',
      label: 'Forced resignation',
      summary: 'Institutional credibility collapsed and stayed collapsed.',
      causalChain: [],
    }
    const report = buildMandateReport(state, failed, score)
    expect(report.whatHappened.join(' ')).not.toContain('served to its scheduled end')
  })
})
