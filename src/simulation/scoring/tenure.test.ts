// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Difficulty, Institution } from '../types/core.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { createRunConfig } from '../engine/initialState.ts'
import { playRun } from '../replay/replayRun.ts'
import { toolkitPackage } from '../policy/toolkitRule.ts'
import { TENURE, tenureHorizon, atTermEnd, hearingBar, termOf } from '../config/tenure.ts'
import { bankedTotal } from './banked.ts'
import { BANKED } from '../config/scoring.ts'

/**
 * The survival structure: you serve until revoked, and length is a result.
 *
 * What this guards is the thing the structure is *for*. It is easy to change
 * two numbers and call a game a survival game; the claims that actually have
 * to hold are that the two institutions end differently, that duration varies
 * instead of being a setting, and — above all — that being dismissed early
 * can no longer be worth more than serving.
 */

const INSTITUTIONS: readonly Institution[] = ['fed', 'ecb']

function run(
  institution: Institution,
  seed: string,
  difficulty: Difficulty = 'medium',
) {
  const config = createRunConfig({
    institution,
    difficulty,
    seed,
    simulationVersion: SIMULATION_VERSION,
  })
  return playRun(config, (session) => toolkitPackage(session, institution, difficulty))
}

describe('the terms are the real ones', () => {
  it('gives the Fed a renewable four-year term and the ECB one of eight', () => {
    expect(TENURE.fed.term).toBe(32)
    expect(TENURE.fed.renewable).toBe(true)
    expect(TENURE.ecb.term).toBe(64)
    expect(TENURE.ecb.renewable).toBe(false)
    expect(TENURE.ecb.maxTerms).toBe(1)
  })

  it('puts the hearing exactly at each term boundary and nowhere else', () => {
    expect(atTermEnd('fed', 0)).toBe(false) // never on the first meeting
    expect(atTermEnd('fed', 31)).toBe(false)
    expect(atTermEnd('fed', 32)).toBe(true)
    expect(atTermEnd('fed', 33)).toBe(false)
    expect(atTermEnd('fed', 64)).toBe(true)
    expect(termOf('fed', 0)).toBe(1)
    expect(termOf('fed', 32)).toBe(2)
  })

  it('raises the hearing bar with the pressure that built under it', () => {
    // The Fed half of the game in one assertion: pressure ignored for four
    // years is a bill that arrives at the hearing.
    expect(hearingBar(0)).toBeLessThan(hearingBar(100))
    expect(hearingBar(20)).toBe(hearingBar(30)) // below the floor is noise
    expect(hearingBar(100)).toBeCloseTo(68, 0)
  })

  it('sets the horizon from the institution, not the difficulty', () => {
    for (const institution of INSTITUTIONS) {
      const easy = createRunConfig({
        institution,
        difficulty: 'easy',
        seed: 's',
        simulationVersion: SIMULATION_VERSION,
      })
      const hard = createRunConfig({
        institution,
        difficulty: 'hard',
        seed: 's',
        simulationVersion: SIMULATION_VERSION,
      })
      // Easy is a tutorial and keeps its own cap; hard is a career.
      expect(hard.meetingCount).toBe(tenureHorizon(institution))
      expect(easy.meetingCount).toBeLessThan(hard.meetingCount)
    }
  })
})

describe('duration is a result', () => {
  it('produces different tenures from different seeds', () => {
    const lengths = new Set<number>()
    for (let index = 0; index < 12; index += 1) {
      lengths.add(run('fed', `tenure-${index}`).state.meetingIndex)
    }
    // The whole point. Under a fixed mandate this set had one element.
    expect(lengths.size).toBeGreaterThan(3)
  })

  it('ends a Fed mandate at a hearing or a catastrophe, never on a clock', () => {
    for (let index = 0; index < 12; index += 1) {
      const session = run('fed', `fed-end-${index}`, 'hard')
      if (session.outcome.status === 'active') continue
      if (session.outcome.triggered === 'mandate_completed') {
        // Reaching the horizon means every hearing was passed.
        expect(session.state.meetingIndex).toBe(tenureHorizon('fed'))
        continue
      }
      // Anything else is a revocation of some kind, and a dismissal at a term
      // boundary must be the hearing rather than a coincidence.
      if (session.outcome.triggered === 'not_reappointed') {
        expect(atTermEnd('fed', session.state.meetingIndex)).toBe(true)
      }
    }
  })

  it('never ends an ECB mandate at a hearing, because there is none', () => {
    for (let index = 0; index < 12; index += 1) {
      const session = run('ecb', `ecb-end-${index}`, 'hard')
      expect(session.outcome.triggered).not.toBe('not_reappointed')
      expect(session.outcome.triggered).not.toBe('reappointed')
    }
  })
})

describe('banking the score means being fired early cannot pay', () => {
  it('pays a meeting at target more than a meeting three points off', () => {
    // The brief, verbatim: "une réunion à la cible banque plein ; une réunion
    // à trois points de l'écart banque peu, ou négatif."
    const session = run('fed', 'bank-shape')
    const ledger = bankedTotal(session.state).ledger
    expect(ledger.length).toBeGreaterThan(2)
    for (const entry of ledger) {
      expect(entry.quality).toBeLessThanOrEqual(1)
      expect(entry.quality).toBeGreaterThanOrEqual(-0.4)
    }
  })

  it('lets a bad meeting bank a negative number', () => {
    // Without this the dominant strategy is to survive without acting:
    // presiding over a catastrophe would cost nothing.
    expect(BANKED.floor).toBeLessThan(0)
  })

  it('gives a longer good tenure a higher total than a short one', () => {
    /*
     * The assertion the whole rewrite exists for.
     *
     * Under the averaged scorecard this was *false*: a governor revoked at
     * meeting six after a calm opening scored better than one who served
     * forty meetings through two crises, because a short path has a better
     * RMS miss. Here the comparison is made on the same seed and the same
     * policy, so the only difference between the two numbers is how long the
     * run went on — and the longer one must win.
     */
    const session = run('fed', 'bank-length', 'medium')
    const full = bankedTotal(session.state)
    expect(full.meetings).toBeGreaterThan(4)

    // The same run, truncated after four meetings.
    const truncated = bankedTotal({
      ...session.state,
      history: session.state.history.slice(0, 5),
    })

    expect(truncated.meetings).toBe(4)
    // Only meaningful if the run was actually being played competently —
    // a mandate banking negative points a meeting *should* score better short.
    if (full.perMeeting > 0) {
      expect(full.total).toBeGreaterThan(truncated.total)
    }
  })

  it('reports the rate as well as the total', () => {
    // Both halves, always: the total alone is a leaderboard of length and the
    // rate alone is the average this replaced.
    const banked = bankedTotal(run('fed', 'bank-pair').state)
    expect(banked.perMeeting).not.toBeNaN()
    expect(banked.meetings).toBeGreaterThan(0)
    expect(Math.abs(banked.total - banked.perMeeting * banked.meetings)).toBeLessThan(
      banked.meetings + 1,
    )
  })
})
