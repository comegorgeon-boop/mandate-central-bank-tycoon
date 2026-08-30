// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { BANKING, EXCHANGE, SPREADS, VOLATILITY } from '../config/model.ts'
import { STRESS_PENALTY_FLOOR } from '../config/scoring.ts'
import { THRESHOLDS } from '../config/thresholds.ts'
import { INSTITUTIONS } from '../config/institutions.ts'
import { SERIES } from './series.ts'

/**
 * Indicator copy must not become a second source of truth.
 *
 * The banking stress indicator told players "above 50 the system is impaired.
 * This is the fastest route to ending a mandate early." No part of the engine
 * has ever known a threshold at 50: the real bar on easy is 95, held for three
 * consecutive meetings, with a supervisory warning at 79.75 and the score
 * penalty starting at 25. A player in the phase-3 playthrough stopped
 * tightening at a reading of 43 because they believed they were approaching a
 * cliff, and they were 52 points and three meetings away from one.
 *
 * Nothing type-checks a sentence, so the only defence is to make every number
 * in player-facing copy come from the constant the engine uses, and to fail
 * here on any number that no constant accounts for.
 */

/**
 * Numbers the engine genuinely knows, gathered from config.
 *
 * Anything quoted to the player has to be one of these. Adding a value here
 * without also using it in the engine defeats the point of the test, so the
 * list holds references to constants rather than literals.
 */
function knownValues(): Set<number> {
  const values = new Set<number>()

  const add = (value: number): void => {
    values.add(value)
  }

  add(VOLATILITY.base)
  add(BANKING.base)
  add(EXCHANGE.baseline)
  add(EXCHANGE.foreignRealRate)
  add(SPREADS.base)
  add(STRESS_PENALTY_FLOOR)

  for (const family of Object.values(THRESHOLDS)) {
    for (const value of Object.values(family)) {
      if (typeof value === 'number') add(value)
    }
  }

  for (const institution of Object.values(INSTITUTIONS)) {
    add(institution.inflationTarget)
    add(institution.initial.neutralRealRate)
  }

  // Structural constants of the indicator scales themselves: a 0-100 index,
  // its midpoint, and fair value on a deviation measure.
  add(0)
  add(50)
  add(100)

  return values
}

/**
 * Numbers that are units or plain English rather than thresholds.
 *
 * Kept deliberately short. "Inflation expectations, 5 years" names a horizon;
 * it does not assert anything the engine could contradict.
 */
const HORIZON_WORDS = /\b\d+(?:\.\d+)?\s+(?:year|years|month|months|quarter|quarters|meeting|meetings|decimal|decimals)\b/g

function numbersIn(text: string): number[] {
  const withoutHorizons = text.replace(HORIZON_WORDS, ' ')
  return [...withoutHorizons.matchAll(/(?<![\w.])(\d+(?:\.\d+)?)/g)].map((match) =>
    Number(match[1]),
  )
}

describe('indicator copy quotes no threshold the engine does not hold', () => {
  const known = knownValues()

  for (const series of SERIES) {
    it(`quotes only engine constants in ${series.id}`, () => {
      for (const field of ['definition', 'meaning'] as const) {
        for (const value of numbersIn(series[field])) {
          expect(
            known.has(value),
            `${series.id}.${field} tells the player about "${value}", which no ` +
              `engine constant accounts for. Interpolate the constant the engine ` +
              `actually uses instead of writing the number out. See ` +
              `docs/BALANCE.md on the invented banking stress threshold.`,
          ).toBe(true)
        }
      }
    })
  }
})

describe('the banking stress copy matches the engine it describes', () => {
  const stress = SERIES.find((series) => series.id === 'bank_stress_proxy')

  it('exists', () => {
    expect(stress).toBeDefined()
  })

  it('quotes the score penalty floor and the crisis threshold', () => {
    expect(stress!.meaning).toContain(String(STRESS_PENALTY_FLOOR))
    expect(stress!.meaning).toContain(String(THRESHOLDS.bankingCrisis.failStress))
  })

  it('no longer claims the system is impaired at 50', () => {
    // The specific regression. 50 remains a legal number elsewhere — it is the
    // midpoint of the confidence survey — so this pins the claim, not the digit.
    expect(stress!.meaning).not.toMatch(/above 50/i)
  })

  it('says the bars move with difficulty rather than fixing them', () => {
    // Every one of these thresholds is scaled by `thresholdLeniency`, so copy
    // that states a single number is wrong at two difficulties out of three.
    expect(stress!.meaning).toMatch(/difficult/i)
  })
})
