// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  DOCTRINES,
  SIMULATION_VERSION,
  theScore,
  createRunConfig,
  playRun,
  type Difficulty,
  type Institution,
  type PolicyPackage,
  type RunSession,
} from '../../simulation/index.ts'
import { compareMandates } from './doctrineMandates.ts'

/**
 * Ten alternative mandates, and they have to be real ones.
 *
 * The end of the doctrines: *"at the end, my mandate against the ten
 * doctrines, same seed"*. The claim the table makes is strong — not "the hawk
 * would probably have done worse" but "the hawk finished on 1,132" — so it is
 * only worth making if the runs behind it are the same world with one thing
 * changed and nothing else.
 *
 * What that means, and what is tested here: the same seed, the same opening
 * state, the same shocks in the same order; every meeting decided by one
 * school's own rule; no package the engine would reject, because a mandate
 * that ended on a rejected package would be a fact about the validator rather
 * than about the school.
 */

const HOLD: PolicyPackage = { actions: [], communication: null }

function playerRun(
  institution: Institution,
  difficulty: Difficulty,
  seed: string,
  choose: (session: RunSession) => PolicyPackage = () => HOLD,
): RunSession {
  return playRun(
    createRunConfig({
      institution,
      difficulty,
      seed,
      simulationVersion: SIMULATION_VERSION,
    }),
    choose,
  )
}

function compare(
  institution: Institution,
  difficulty: Difficulty,
  seed: string,
) {
  const session = playerRun(institution, difficulty, seed)
  return compareMandates(session)
}

describe('the ten mandates', () => {
  it('plays every school without the engine rejecting a package', () => {
    // `playRun` throws on a rejected package, so this is the assertion: a
    // school that wanted to cut 150 bp from a rate 25 bp above the floor must
    // have been held at the floor rather than have ended its own mandate on a
    // validation error.
    const cases: readonly [Institution, Difficulty, string][] = [
      ['ecb', 'medium', '8RAW-LUHT'],
      ['ecb', 'hard', 'FLOOR-TEST'],
      ['fed', 'medium', 'ZLB-RUN'],
      ['fed', 'hard', 'DEEP-CUT'],
      ['fed', 'easy', 'TUTORIAL'],
    ]
    for (const [institution, difficulty, seed] of cases) {
      const comparison = compare(institution, difficulty, seed)
      expect(comparison.mandates, `${institution}/${difficulty}`).toHaveLength(
        DOCTRINES.length,
      )
    }
  })

  it('is exact rather than estimated: the same seed gives the same table', () => {
    const first = compare('ecb', 'medium', '8RAW-LUHT')
    const second = compare('ecb', 'medium', '8RAW-LUHT')
    expect(second.mandates.map((entry) => entry.banked)).toEqual(
      first.mandates.map((entry) => entry.banked),
    )
  })

  it('runs each school on the mandate that was actually played', () => {
    // Not a fresh economy: the institution, the difficulty and the seed are
    // the player's, which is the only reason the two columns are comparable.
    const session = playerRun('ecb', 'hard', 'SAME-WORLD')
    const comparison = compareMandates(session)
    expect(comparison.player).toBe(theScore(session.state).total)
    for (const entry of comparison.mandates) {
      expect(entry.meetings, entry.doctrine.id).toBeGreaterThan(0)
    }

    // And it is the player's seed rather than a fixed one: change the world
    // the player was in and the ten mandates change with it.
    const elsewhere = compare('ecb', 'hard', 'ANOTHER-WORLD')
    expect(elsewhere.mandates.map((entry) => entry.banked)).not.toEqual(
      comparison.mandates.map((entry) => entry.banked),
    )
  })

  it('separates the schools rather than producing ten identical numbers', () => {
    const comparison = compare('ecb', 'medium', '8RAW-LUHT')
    const scores = comparison.mandates.map((entry) => entry.banked)
    // If every rule landed in the same place the table would be decoration.
    expect(Math.max(...scores) - Math.min(...scores)).toBeGreaterThan(500)
  })

  it('tells the reader when a conditional school never had standing', () => {
    // The two conditional schools spend most mandates silent, and a silent
    // school scores what a chair who never moved scores. Without `spoke` the
    // table would show that number and leave it looking like a policy.
    const comparison = compare('ecb', 'medium', '8RAW-LUHT')
    const holding = playerRun('ecb', 'medium', '8RAW-LUHT')
    const holdingScore = theScore(holding.state).total
    for (const entry of comparison.mandates) {
      if (entry.spoke > 0) continue
      expect(entry.banked, entry.doctrine.id).toBe(holdingScore)
    }
    expect(comparison.mandates.some((entry) => entry.spoke > 0)).toBe(true)
  })

  it('counts how many schools finished ahead of the player', () => {
    const comparison = compare('fed', 'medium', 'AHEAD-OF-ME')
    const ahead = comparison.mandates.filter(
      (entry) => entry.banked > comparison.player,
    ).length
    expect(comparison.beatenBy).toBe(ahead)
  })

  it('orders the table best first', () => {
    const scores = compare('fed', 'medium', 'AHEAD-OF-ME').mandates.map(
      (entry) => entry.banked,
    )
    for (let i = 1; i < scores.length; i += 1) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1])
    }
  })

  it('never claims a school reached the end when it did not', () => {
    for (const seed of ['FAIL-ONE', 'FAIL-TWO', 'FAIL-THREE']) {
      for (const entry of compare('fed', 'hard', seed).mandates) {
        if (!entry.completed) {
          // A mandate that ended early has to say so in words the result
          // screen can print, or the column would read "served N meetings"
          // about a run that was stopped.
          expect(entry.endedAs.length, entry.doctrine.id).toBeGreaterThan(0)
        }
      }
    }
  })
})
