import { describe, expect, it } from 'vitest'
import { SIMULATION_VERSION } from '../version.ts'
import { createRunConfig } from '../engine/initialState.ts'
import { startRun, submitMeeting } from '../replay/replayRun.ts'
import { readTempo } from './tempo.ts'
import { settleCall, callTerms, CALL_HORIZON } from '../policy/forecastCall.ts'
import type { PolicyPackage } from '../types/policy.ts'

/**
 * The two mechanics that answer "the game has only one kind of turn".
 *
 * Both are engine-side and both have a failure mode that produces a perfectly
 * playable game teaching the wrong thing, which is why they are tested here
 * rather than left to the screen to get right.
 *
 * **The tempo must not latch.** Its first version tested *states* — "a demand
 * exists", "a supply shock is running" — and a state is true for as long as it
 * lasts, so 79 % of the 2021-23 mandates' meetings came back "full" and the
 * split bought nothing. A thing true at every meeting is weather, not an event.
 *
 * **A wager must be able to settle.** Its first version accepted a new call
 * every meeting, which replaced the outstanding one before it could mature —
 * so no call ever came due, the credibility never moved, and the reveal was
 * unreachable code in a feature that looked finished.
 */

const HOLD: PolicyPackage = { actions: [], communication: null }

function openRun(difficulty: 'easy' | 'medium' | 'hard' = 'medium') {
  return startRun(
    createRunConfig({
      institution: 'fed',
      difficulty,
      seed: 'TEMPO-TEST',
      simulationVersion: SIMULATION_VERSION,
    }),
  )
}

describe('not every meeting is a meeting', () => {
  it('opens the whole room at the first meeting, always', () => {
    // The one where a player learns what a meeting is, and the one the
    // first-meeting guide points at — it names the tab strip and the confirm
    // step, neither of which a quick meeting has.
    expect(readTempo(openRun()).tempo).toBe('full')
  })

  it('makes most meetings quick', () => {
    let session = openRun()
    const tempos: string[] = []
    for (let meeting = 0; meeting < 16; meeting += 1) {
      tempos.push(readTempo(session).tempo)
      const result = submitMeeting(session, HOLD)
      if (!result.ok) break
      session = result.session
      if (session.outcome.status !== 'active') break
    }
    const quick = tempos.filter((tempo) => tempo === 'quick').length
    expect(
      quick / tempos.length,
      `only ${quick} of ${tempos.length} meetings were quick`,
    ).toBeGreaterThan(0.5)
  })

  it('does not latch on a condition that stays true', () => {
    // The failure the first version had. Whatever is going on, a run must not
    // report "full" at every meeting — if it does, the tempo is reading a
    // state rather than a change.
    let session = openRun('hard')
    let fullRun = 0
    let worst = 0
    for (let meeting = 0; meeting < 20; meeting += 1) {
      const { tempo } = readTempo(session)
      fullRun = tempo === 'full' ? fullRun + 1 : 0
      worst = Math.max(worst, fullRun)
      const result = submitMeeting(session, HOLD)
      if (!result.ok) break
      session = result.session
      if (session.outcome.status !== 'active') break
    }
    expect(worst, `${worst} consecutive full meetings`).toBeLessThan(5)
  })

  it('names what a full meeting is for', () => {
    // A full meeting that cannot say why it is open should have been quick.
    let session = openRun('hard')
    for (let meeting = 0; meeting < 20; meeting += 1) {
      const reading = readTempo(session)
      if (reading.tempo === 'full') {
        expect(reading.because, 'a full meeting with no reason').not.toBeNull()
        expect((reading.because ?? '').length).toBeGreaterThan(8)
      }
      const result = submitMeeting(session, HOLD)
      if (!result.ok) break
      session = result.session
      if (session.outcome.status !== 'active') break
    }
  })
})

describe('the published forecast', () => {
  it('settles, which the first version never did', () => {
    let session = openRun()
    const printed = session.observation.indicators.headline_inflation?.value ?? 2
    // A call every meeting. The engine must keep the first and refuse the
    // rest until it has matured, or nothing ever comes due.
    let settled = 0
    for (let meeting = 0; meeting < 8; meeting += 1) {
      const result = submitMeeting(session, {
        ...HOLD,
        call: { centre: Math.round(printed * 10) / 10, band: 'tight' },
      })
      if (!result.ok) break
      session = result.session
      if (session.call !== null) settled += 1
      if (session.outcome.status !== 'active') break
    }
    expect(settled, 'no call ever came due').toBeGreaterThan(0)
  })

  it('does not let a standing call be replaced', () => {
    let session = openRun()
    const first = submitMeeting(session, { ...HOLD, call: { centre: 2, band: 'wide' } })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    session = first.session
    const issued = session.state.call?.issuedAtMeeting
    expect(issued).toBe(0)

    const second = submitMeeting(session, { ...HOLD, call: { centre: 9, band: 'tight' } })
    expect(second.ok).toBe(true)
    if (!second.ok) return
    // Still the first call: a wager you can revise is not a wager.
    expect(second.session.state.call?.centre).toBe(2)
    expect(second.session.state.call?.issuedAtMeeting).toBe(0)
  })

  it('costs more than it pays, at every band', () => {
    // A forecast is a promise, and the asymmetry between keeping and breaking
    // one is the whole mechanism. Symmetric odds would make the tightest band
    // free expected value and the trade would stop being a trade.
    for (const band of ['wide', 'even', 'tight'] as const) {
      const terms = callTerms(band)
      expect(terms.cost, band).toBeGreaterThan(terms.reward)
    }
    // And a tighter band is worth more and costs more than a wider one.
    expect(callTerms('tight').reward).toBeGreaterThan(callTerms('wide').reward)
    expect(callTerms('tight').cost).toBeGreaterThan(callTerms('wide').cost)
    expect(callTerms('tight').halfWidth).toBeLessThan(callTerms('wide').halfWidth)
  })

  it('judges on the published figure, and charges nothing for a missing one', () => {
    const session = openRun()
    const call = { centre: 2, band: 'even' as const, issuedAtMeeting: 0 }
    const state = { ...session.state, meetingIndex: CALL_HORIZON }

    expect(settleCall(state, call, 2.1)?.won).toBe(true)
    expect(settleCall(state, call, 4.0)?.won).toBe(false)
    // A release that did not arrive is the world failing to report, not the
    // committee failing. It costs nothing.
    expect(settleCall(state, call, null)?.credibility).toBe(0)
    // And nothing settles before it is due.
    expect(settleCall({ ...session.state, meetingIndex: 1 }, call, 2.1)).toBeNull()
  })
})
