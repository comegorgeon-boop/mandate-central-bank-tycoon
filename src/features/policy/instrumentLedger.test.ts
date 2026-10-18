// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  SIMULATION_VERSION,
  createRunConfig,
  startRun,
  submitMeeting,
  type PolicyPackage,
  type RunSession,
} from '../../simulation/index.ts'
import {
  pruneLedger,
  realiseDue,
  recordInstruments,
  type LedgerEntry,
} from './instrumentLedger.ts'

/**
 * A projection recorded at a decision must actually come back.
 *
 * The failure this guards is silent by construction: a ledger whose entries
 * are never due, or are pruned a meeting early, shows nothing — and "nothing
 * on screen" is exactly what the panel looks like when there is genuinely
 * nothing to report. The browser walk that first covered this screen could not
 * tell the two apart either, and reported a clean pass over a panel it had
 * never once rendered.
 */

const HOLD: PolicyPackage = { actions: [], communication: null }

const RAISE_PURCHASES: PolicyPackage = {
  actions: [{ instrument: 'asset_purchases', magnitude: 2 }],
  communication: null,
}

/** Plays meetings, keeping the ledger exactly as `RunProvider` does. */
function play(
  packages: readonly PolicyPackage[],
): { session: RunSession; ledger: readonly LedgerEntry[] } {
  let session = startRun(
    createRunConfig({
      institution: 'fed',
      difficulty: 'medium',
      seed: 'ledger',
      simulationVersion: SIMULATION_VERSION,
    }),
  )
  let ledger: readonly LedgerEntry[] = []

  for (const pkg of packages) {
    const recorded = recordInstruments(session, pkg)
    const result = submitMeeting(session, pkg)
    if (!result.ok) throw new Error('package rejected')
    session = result.session
    ledger = pruneLedger([...ledger, ...recorded], session.state.meetingIndex)
  }

  return { session, ledger }
}

describe('the instrument ledger', () => {
  it('records what a moved instrument was projected to do', () => {
    const { ledger } = play([RAISE_PURCHASES])
    expect(ledger).toHaveLength(1)
    const [entry] = ledger
    expect(entry.instrument).toBe('asset_purchases')
    expect(entry.decidedAtMeeting).toBe(0)
    expect(entry.from).toBe(0)
    expect(entry.to).toBe(2)
    expect(entry.lines.length).toBeGreaterThan(0)
    // Every recorded line carries both halves of the later comparison.
    for (const line of entry.lines) {
      expect(Math.abs(line.projectedDelta)).toBeGreaterThan(0)
      expect(line.observedThen).not.toBeNull()
    }
  })

  it('records nothing for a meeting that moved nothing', () => {
    expect(play([HOLD]).ledger).toHaveLength(0)
  })

  it('holds the entry until its own horizon, then reports it exactly once', () => {
    // Asset purchases declare a 1-5 meeting lag, so the entry is due at
    // meeting 5 and at no other meeting.
    const due: number[] = []
    let session = startRun(
      createRunConfig({
        institution: 'fed',
        difficulty: 'medium',
        seed: 'ledger',
        simulationVersion: SIMULATION_VERSION,
      }),
    )
    let ledger: readonly LedgerEntry[] = []
    const recorded = recordInstruments(session, RAISE_PURCHASES)
    expect(recorded).toHaveLength(1)
    const horizon = recorded[0].dueAtMeeting

    for (let meeting = 0; meeting <= horizon + 1; meeting += 1) {
      const pkg = meeting === 0 ? RAISE_PURCHASES : HOLD
      const entries = meeting === 0 ? recorded : recordInstruments(session, pkg)
      const result = submitMeeting(session, pkg)
      if (!result.ok) throw new Error('package rejected')
      session = result.session
      ledger = pruneLedger([...ledger, ...entries], session.state.meetingIndex)
      if (
        realiseDue(ledger, session.state.meetingIndex, session.observation).length > 0
      ) {
        due.push(session.state.meetingIndex)
      }
    }

    expect(due).toEqual([horizon])
  })

  it('reports the contribution beside what the series actually did', () => {
    const { session, ledger } = play([
      RAISE_PURCHASES,
      HOLD,
      HOLD,
      HOLD,
      HOLD,
    ])
    const realised = realiseDue(
      ledger,
      session.state.meetingIndex,
      session.observation,
    )
    expect(realised).toHaveLength(1)
    const [entry] = realised
    expect(entry.meetingsElapsed).toBe(5)
    for (const line of entry.lines) {
      // Both numbers are present, and they are different questions: the first
      // is the counterfactual, the second is everything that happened.
      expect(line.projectedDelta).not.toBe(0)
      expect(line.actualDelta).not.toBeNull()
      expect(line.observedNow).not.toBeNull()
    }
  })

  it('prunes an entry once it has been reported, and never before', () => {
    const { ledger } = play([RAISE_PURCHASES, HOLD, HOLD])
    // Three meetings played, horizon is five: still held.
    expect(ledger).toHaveLength(1)
    expect(pruneLedger(ledger, 5)).toHaveLength(1)
    expect(pruneLedger(ledger, 6)).toHaveLength(0)
  })
})
