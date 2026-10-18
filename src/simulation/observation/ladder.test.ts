// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Difficulty } from '../types/core.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { getDifficulty } from '../config/difficulty.ts'
import { createInitialState, createRunConfig } from '../engine/initialState.ts'
import { committeeAgrees, committeeViews, staffRecommendation } from '../policy/staffRule.ts'
import { startRun, submitMeeting } from '../replay/replayRun.ts'
import { generateObservation } from './generateObservation.ts'

/**
 * The information ladder, as a property of the build rather than of a table in
 * a document.
 *
 * docs/BALANCE.md settled this in phase 3 and the code did not implement it:
 * the whole diagnosis was gated on `namesShocks` alone, so medium — recorded
 * as "shock not named, evidence still shown" — was in fact getting neither.
 * The ordering is the point, and it is the reverse of the obvious one. **The
 * evidence is what persists down the ladder; the name is what gets withdrawn.**
 * A player taught only the label learns to obey a label; a player taught the
 * reading can still read an economy where nothing is labelled at all.
 */

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard']

function observeAt(difficulty: Difficulty) {
  const config = createRunConfig({
    institution: 'fed',
    difficulty,
    seed: 'ladder',
    simulationVersion: SIMULATION_VERSION,
  })
  const state = createInitialState(config)
  return { state, observation: generateObservation(state, {
    meetingIndex: 0,
    newswire: [],
    clues: [],
  }) }
}

/**
 * A session a few meetings in.
 *
 * The committee cannot be split over numbers nobody has, and core inflation
 * carries a publication lag, so at meeting zero every member correctly returns
 * nothing. Reaching for a later meeting is the point rather than a workaround:
 * it is where a real disagreement can exist.
 */
function sessionAfterHolds(difficulty: Difficulty, meetings: number) {
  const config = createRunConfig({
    institution: 'fed',
    difficulty,
    seed: 'ladder-committee',
    simulationVersion: SIMULATION_VERSION,
  })
  let session = startRun(config)
  for (let index = 0; index < meetings; index += 1) {
    const result = submitMeeting(session, { actions: [], communication: null })
    if (!result.ok) throw new Error('a hold was rejected')
    session = result.session
  }
  return session
}

describe('the information ladder', () => {
  it('names the shock only at easy', () => {
    expect(observeAt('easy').observation.diagnosis?.label).toBeTypeOf('string')
    expect(observeAt('medium').observation.diagnosis?.label).toBeNull()
    expect(observeAt('hard').observation.diagnosis).toBeNull()
  })

  it('keeps the evidence one rung below the name, at medium', () => {
    const diagnosis = observeAt('medium').observation.diagnosis
    expect(diagnosis).not.toBeNull()
    // The name is gone…
    expect(diagnosis?.kind).toBeNull()
    expect(diagnosis?.summary).toBeNull()
    // …and the reading it was drawn from is still on the table.
    expect(diagnosis?.evidence.length).toBeGreaterThan(0)
    for (const tell of diagnosis?.evidence ?? []) {
      expect(tell.length).toBeGreaterThan(0)
    }
  })

  it('never publishes an empty evidence list where it publishes one at all', () => {
    // A named shock arriving with nothing to look up is exactly the bare
    // instruction this mode exists to avoid.
    for (const difficulty of DIFFICULTIES) {
      const diagnosis = observeAt(difficulty).observation.diagnosis
      if (diagnosis === null) continue
      expect(diagnosis.evidence.length, difficulty).toBeGreaterThan(0)
    }
  })

  it('reads nothing for the player at hard', () => {
    expect(observeAt('hard').observation.diagnosis).toBeNull()
    expect(getDifficulty('hard').showsShockEvidence).toBe(false)
  })

  it('withdraws each rung once and never puts one back', () => {
    // The ladder must be monotone: nothing may be shown at a difficulty that
    // is hidden at an easier one, or the modes are not ordered.
    const rungs = DIFFICULTIES.map((id) => getDifficulty(id))
    for (let i = 1; i < rungs.length; i += 1) {
      const easier = rungs[i - 1]
      const harder = rungs[i]
      expect(Number(harder.namesShocks)).toBeLessThanOrEqual(Number(easier.namesShocks))
      expect(Number(harder.showsShockEvidence)).toBeLessThanOrEqual(
        Number(easier.showsShockEvidence),
      )
      expect(Number(harder.showsPolicyHints)).toBeLessThanOrEqual(
        Number(easier.showsPolicyHints),
      )
    }
  })
})

describe('the staff, down the ladder', () => {
  it('advises at easy and at medium, and puts no single recommendation at hard', () => {
    expect(getDifficulty('easy').showsStaffRecommendation).toBe(true)
    // Shown at medium, and fallible for free: `staffRule` reads the same noisy
    // published prints the player does, so at medium's noise scale it is wrong
    // for exactly the reasons the player is wrong. Nothing needs weakening.
    expect(getDifficulty('medium').showsStaffRecommendation).toBe(true)
    expect(getDifficulty('hard').showsStaffRecommendation).toBe(false)
  })

  it('splits the committee only at hard', () => {
    expect(getDifficulty('easy').splitsCommittee).toBe(false)
    expect(getDifficulty('medium').splitsCommittee).toBe(false)
    expect(getDifficulty('hard').splitsCommittee).toBe(true)
  })
})

describe('the divided committee', () => {
  it('brackets the advice the lower difficulties are given', () => {
    const { observation } = sessionAfterHolds('hard', 3)
    const views = committeeViews(observation, 'fed', 'hard')
    const centre = staffRecommendation(observation, 'fed', 'hard')

    expect(views.length).toBeGreaterThanOrEqual(2)
    expect(centre).not.toBeNull()
    if (centre === null) return

    // A player moving up from medium meets the colleague they already know,
    // now flanked — rather than three strangers.
    const moves = views.map((view) => view.basisPoints)
    expect(moves).toContain(centre.basisPoints)
    expect(Math.max(...moves)).toBeGreaterThanOrEqual(centre.basisPoints)
    expect(Math.min(...moves)).toBeLessThanOrEqual(centre.basisPoints)
  })

  it('orders its wings by how hard each leans on the inflation miss', () => {
    const { observation } = sessionAfterHolds('hard', 3)
    const views = committeeViews(observation, 'fed', 'hard')

    for (let i = 1; i < views.length; i += 1) {
      expect(views[i].inflationWeight).toBeLessThan(views[i - 1].inflationWeight)
      // A member who weights the miss less can never advise a tighter move on
      // the same data, or the wings are mislabelled.
      expect(views[i].basisPoints).toBeLessThanOrEqual(views[i - 1].basisPoints)
    }
  })

  it('reports agreement honestly rather than manufacturing an argument', () => {
    const { observation } = sessionAfterHolds('hard', 3)
    const views = committeeViews(observation, 'fed', 'hard')
    const moves = new Set(views.map((view) => view.basisPoints))

    // Whichever it is on this seed, the two must agree with each other: a
    // committee that reads as "divided" while every member advises the same
    // move is noise wearing the costume of difficulty.
    expect(committeeAgrees(views)).toBe(moves.size === 1)
  })

  it('gives every member its own grounds, never a bare number', () => {
    const { observation } = sessionAfterHolds('hard', 3)
    for (const view of committeeViews(observation, 'fed', 'hard')) {
      expect(view.voice.length).toBeGreaterThan(0)
      expect(view.reasoning).toMatch(/recommend/)
      expect(view.reasoning).not.toMatch(/undefined|NaN/)
    }
  })
})
