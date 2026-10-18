// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Difficulty, Institution } from '../types/core.ts'
import type { InstrumentId } from '../types/policy.ts'
import {
  INSTRUMENTS,
  availableInstruments,
  getInstrument,
  getInstrumentRange,
} from '../config/instruments.ts'
import { createInitialState } from '../engine/initialState.ts'
import { testConfig } from '../testing/harness.ts'
import { projectInstrument } from './instrumentEffect.ts'

/**
 * Every instrument explains itself, and every instrument can be quantified.
 *
 * The complaint these answer, in the player's own words: they raised targeted
 * refinancing by a point and had no idea what it had done. Two separate
 * failures were behind that — the toolkit said what each tool's *mechanism*
 * was and never what it was *for*, and nothing anywhere put a number on what
 * moving one dial would produce.
 */

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard']
const INSTITUTIONS: readonly Institution[] = ['fed', 'ecb']

describe('every instrument explains itself', () => {
  for (const instrument of INSTRUMENTS) {
    describe(instrument.id, () => {
      it('says what it is for in plain language', () => {
        expect(instrument.purpose.length).toBeGreaterThan(40)
        // The purpose is for a reader who has never met the instrument, so it
        // may not lean on the vocabulary that made it opaque in the first
        // place. `description` is where the mechanism belongs.
        expect(instrument.purpose).not.toMatch(
          /term premi|transmission|counterpart|corridor|reserve balances/i,
        )
      })

      it('says how much is a lot, and what happens if it is abused', () => {
        expect(instrument.rangeNote.length).toBeGreaterThan(40)
        expect(instrument.abuseRisk.length).toBeGreaterThan(40)
      })

      it('keeps any stated precedent inside the range it can be set to', () => {
        if (instrument.plausibleMax === undefined) return
        expect(instrument.plausibleMax).toBeGreaterThan(0)
        // A precedent above the ceiling could never be crossed, so the warning
        // built on it would be unreachable copy.
        expect(instrument.plausibleMax).toBeLessThan(instrument.max)
      })
    })
  }
})

describe('the toolkit each difficulty opens', () => {
  /**
   * Medium keeps the four instruments a player reported understanding: the
   * policy rate, purchases, runoff, and the administered deposit rate — plus
   * guidance, which is the second axis rather than a facility. Everything
   * else moved to hard. A mode whose toolkit a player cannot read is not a
   * harder mode, it is a wider one.
   */
  const MEDIUM: Readonly<Record<Institution, readonly InstrumentId[]>> = {
    fed: [
      'policy_rate',
      'asset_purchases',
      'balance_sheet_runoff',
      'forward_guidance',
      'iorb_spread',
    ],
    ecb: [
      'policy_rate',
      'asset_purchases',
      'balance_sheet_runoff',
      'forward_guidance',
      'deposit_facility_spread',
    ],
  }

  for (const institution of INSTITUTIONS) {
    it(`gives ${institution} exactly the readable four, plus guidance, at medium`, () => {
      const ids = availableInstruments(institution, 'medium').map((i) => i.id)
      expect([...ids].sort()).toEqual([...MEDIUM[institution]].sort())
    })

    it(`keeps the exotic facilities out of ${institution}'s medium mandate`, () => {
      const ids = availableInstruments(institution, 'medium').map((i) => i.id)
      for (const exotic of [
        'targeted_refinancing',
        'discount_window',
        'reverse_repo',
        'swap_lines',
        'minimum_reserves',
        'transmission_protection',
      ] as const) {
        expect(ids, exotic).not.toContain(exotic)
      }
    })

    it(`still reaches everything ${institution} has at hard`, () => {
      const ids = availableInstruments(institution, 'hard').map((i) => i.id)
      const all = INSTRUMENTS.filter((i) => i.availableTo.includes(institution))
      expect(ids).toHaveLength(all.length)
    })
  }
})

describe('what one instrument, on its own, is expected to do', () => {
  for (const institution of INSTITUTIONS) {
    for (const difficulty of DIFFICULTIES) {
      it(`quantifies every instrument reachable at ${institution}/${difficulty}`, () => {
        const state = createInitialState(testConfig(institution, difficulty, 'effect'))
        for (const instrument of availableInstruments(institution, difficulty)) {
          // Guidance is judged on whether it was kept rather than projected;
          // it acts through the credibility mechanics, not through a dial.
          if (instrument.id === 'forward_guidance') continue
          const range = getInstrumentRange(instrument, difficulty)
          // One step inside the range. The deposit facility spread runs from
          // −50 to 0, so a step *up* from zero is outside its own bounds.
          const magnitude =
            range.max >= range.increment
              ? range.increment
              : range.min + range.increment
          const effect = projectInstrument(
            state,
            { instrument: instrument.id, magnitude },
            0,
          )
          expect(effect, instrument.id).not.toBeNull()
          // Both halves of the mandate are always reported, whatever channels
          // the instrument declares.
          const reported = effect!.lines.map((line) => line.seriesId)
          expect(reported, instrument.id).toContain('headline_inflation')
          expect(reported, instrument.id).toContain('unemployment')
        }
      })
    }
  }

  it('is a counterfactual, not a forecast: holding produces nothing', () => {
    const state = createInitialState(testConfig('fed', 'medium', 'effect'))
    const held = projectInstrument(
      state,
      { instrument: 'asset_purchases', magnitude: state.stance.assetPurchasePace },
      state.stance.assetPurchasePace,
    )
    expect(held).not.toBeNull()
    expect(held!.negligible).toBe(true)
  })

  it('gives a bigger move a bigger effect', () => {
    const state = createInitialState(testConfig('fed', 'medium', 'effect'))
    const inflationOf = (magnitude: number): number => {
      const effect = projectInstrument(
        state,
        { instrument: 'policy_rate', magnitude },
        0,
      )
      const line = effect!.lines.find((l) => l.seriesId === 'headline_inflation')!
      return line.delta
    }
    // Both tighten, so both should push inflation down, and 100 bp harder.
    expect(inflationOf(100)).toBeLessThan(inflationOf(25))
    expect(inflationOf(25)).toBeLessThan(0)
  })

  it('never touches the run it is projecting from', () => {
    const state = createInitialState(testConfig('fed', 'medium', 'effect'))
    const before = JSON.stringify(state)
    projectInstrument(state, { instrument: 'policy_rate', magnitude: 50 }, 0)
    projectInstrument(state, { instrument: 'asset_purchases', magnitude: 2 }, 0)
    expect(JSON.stringify(state)).toBe(before)
  })

  it('reports an unknown instrument as no projection at all', () => {
    const state = createInitialState(testConfig('fed', 'medium', 'effect'))
    expect(getInstrument('policy_rate')).toBeDefined()
    const effect = projectInstrument(
      state,
      { instrument: 'not_an_instrument' as InstrumentId, magnitude: 1 },
      0,
    )
    expect(effect).toBeNull()
  })
})
