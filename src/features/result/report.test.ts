// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  SIMULATION_VERSION,
  calculateScore,
  createRunConfig,
  evaluateEndConditions,
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

  it('does not reference a major event on medium, where none fire', () => {
    const { state, outcome, score } = completedSession('report-medium', 'medium')
    expect(state.eventLog.some((record) => record.meetingIndex === 0)).toBe(false)

    const report = buildMandateReport(state, outcome, score)
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
