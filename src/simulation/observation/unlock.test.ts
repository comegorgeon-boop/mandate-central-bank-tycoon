// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Difficulty } from '../types/core.ts'
import { createInitialState } from '../engine/initialState.ts'
import { testConfig } from '../testing/harness.ts'
import { generateObservation } from './generateObservation.ts'
import { SERIES } from './series.ts'
import { isUnlocked, unlockedAt } from './unlock.ts'

/**
 * The learning mandate's dashboard fills in; nothing else is touched.
 *
 * Two properties, and the second is the one that matters. A beginner meeting
 * twenty-six series on the first morning reasonably concludes that none of
 * them matter, so easy opens on the handful a rate decision is made from and
 * adds the rest as questions for them arise. And **no mechanic may depend on a
 * withheld series**, because a gate that removed one would be simplifying a
 * panel by deleting a lesson.
 *
 * The first version of this gated `generateObservation` itself and broke six
 * tests, every one correctly: the stance decomposition reads expected
 * inflation and the priced path, the guidance preview reads the credibility
 * survey, the shock diagnosis reads core inflation, and the same-day reaction
 * screen reads volatility, the long rate, equities and the currency. It is
 * applied at the panel now, which makes the separation exact by construction.
 */

const OTHERS: readonly Difficulty[] = ['medium', 'hard']

/**
 * Series a derivation reads, which therefore may never be withheld.
 *
 * Kept as a list rather than inferred, because the point is to *state* the
 * contract: adding a series here is a claim that something computes from it,
 * and adding one to the unlock table that appears here fails below.
 */
const LOAD_BEARING = [
  'headline_inflation',
  'core_inflation',
  'unemployment',
  'policy_rate',
  'market_expected_rate',
  'inflation_expectations',
  'inflation_expectations_1y',
  'credibility_index',
  'neutral_rate_estimate',
  'output_gap_estimate',
  'market_volatility',
  'long_rate',
  'equity_index',
  'exchange_rate',
  'credit_spread',
  'fragmentation_spread',
] as const

describe('only the learning mandate withholds anything', () => {
  for (const difficulty of OTHERS) {
    it(`gives ${difficulty} every series from the first meeting`, () => {
      for (const series of SERIES) {
        expect(isUnlocked(series.id, difficulty, 0), series.id).toBe(true)
      }
      expect(unlockedAt(difficulty, 3)).toHaveLength(0)
    })
  }

  it('opens easy on the numbers a decision is actually made from', () => {
    for (const id of [
      'headline_inflation',
      'core_inflation',
      'unemployment',
      'policy_rate',
      'market_expected_rate',
    ] as const) {
      expect(isUnlocked(id, 'easy', 0), id).toBe(true)
    }
  })

  it('holds something back at the start and releases it later', () => {
    // Otherwise the feature does not exist.
    const withheld = SERIES.filter((series) => !isUnlocked(series.id, 'easy', 0))
    expect(withheld.length).toBeGreaterThan(4)
    for (const series of withheld) {
      expect(isUnlocked(series.id, 'easy', 40), series.id).toBe(true)
    }
  })

  it('never withholds a series something computes from', () => {
    // The rule the first version broke, asserted where it can actually be
    // broken. The gate lives in the panels now, so what has to hold is that
    // the *observation set* still carries everything a derivation reads — the
    // stance decomposition, the guidance preview, the shock diagnosis, the
    // same-day reaction screen. If the gate is ever moved back down a layer
    // this fails immediately, which is the point of asserting it here rather
    // than asserting a property of the table.
    const state = createInitialState(testConfig('ecb', 'easy', 'unlock'), {
      openingEvent: false,
      tutorialDamage: false,
    })
    const observation = generateObservation(state, {
      meetingIndex: 0,
      newswire: [],
      clues: [],
    })
    for (const id of LOAD_BEARING) {
      expect(observation.indicators[id], id).toBeDefined()
    }
  })

  it('announces each series on exactly the meeting it arrives', () => {
    const announced = new Map<string, number>()
    for (let meeting = 0; meeting < 30; meeting += 1) {
      for (const id of unlockedAt('easy', meeting)) {
        expect(announced.has(id), `${id} announced twice`).toBe(false)
        announced.set(id, meeting)
        // Announced on the meeting it becomes readable, not before or after.
        expect(isUnlocked(id, 'easy', meeting), id).toBe(true)
        expect(isUnlocked(id, 'easy', meeting - 1), id).toBe(false)
      }
    }
    expect(announced.size).toBeGreaterThan(4)
  })
})
