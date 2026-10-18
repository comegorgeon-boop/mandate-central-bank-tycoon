// @vitest-environment node
import { describe, expect, it } from 'vitest'
// The document itself, not a copy of its numbers. See the note below.
import DOC from '../../../docs/SCENARIOS.md?raw'
import { createInitialState, createRunConfig } from '../engine/initialState.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { VOLCKER_1979 } from './volcker.ts'

/**
 * What is true of the Volcker scenario and of nothing else.
 *
 * The opening table, the calendar, the dates and the no-quotation rule are
 * checked for **all six** scenarios by `sourced.test.ts`, generically, against
 * the same document. What stays here is the handful of claims that are
 * peculiar to 1979-83: its one marked approximation, the two quantities it
 * derives out of the engine's own identity, and the fact that a historical
 * mandate takes its institution, rules and length from the scenario rather
 * than from a chooser.
 *
 * The original note is kept below because the principle is the project's, not
 * this file's.
 *
 * ---
 *
 * The documented table is the authority.
 *
 * The player's condition for this chantier, and it is not negotiable: *sourced
 * opening states and dates, not invented; record the sources in docs/ and mark
 * explicitly what is approximated; a test that locks the opening figures
 * against the documented table.*
 *
 * So this test **parses `docs/SCENARIOS.md`** and compares it to the code, row
 * by row. Not a copy of the numbers — a copy would drift silently the first
 * time somebody edited one side, which is the failure this is here to prevent.
 * Edit either and the other fails.
 *
 * It follows the same principle as the test that forbids invented brand names
 * and the one that confronts a claim of a null effect with the engine's own
 * arithmetic: a claim the game makes about the world is checked against
 * something outside the sentence that makes it.
 */

describe("the Volcker scenario's own claims", () => {
  it('marks its one approximation as an approximation, in both places', () => {
    // It has no source, and the document has to say so where a reader looking
    // for the source would look.
    expect(DOC).toMatch(/Long-run inflation\s+expectations: 7\.0 %/)
    expect(DOC).toMatch(/One approximation, marked as such/)
    expect(VOLCKER_1979.opening.expectedInflationLong).toBe(7.0)
  })

  it('documents the two quantities it derives rather than observes', () => {
    // Not measurements, and not free parameters either: they are solved out of
    // the engine's own identity from the sourced headline and core prints.
    expect(DOC).toMatch(/supply shock of 0\.74/)
    expect(DOC).toMatch(/import price inflation of 1\.48 %/)
    expect(VOLCKER_1979.opening.supplyShock).toBe(0.74)
    expect(VOLCKER_1979.opening.importPriceInflation).toBe(1.48)
  })
})

describe('the Volcker scenario opens the economy it documents', () => {
  const state = createInitialState(
    createRunConfig({
      institution: 'fed',
      difficulty: 'hard',
      seed: 'VOLCKER-TEST',
      simulationVersion: SIMULATION_VERSION,
      scenario: 'volcker_1979',
    }),
  )

  it('starts at the sourced numbers rather than at a seeded draw', () => {
    expect(state.latent.inflationHeadline).toBe(VOLCKER_1979.opening.inflationHeadline)
    expect(state.latent.inflationCore).toBe(VOLCKER_1979.opening.inflationCore)
    expect(state.latent.unemployment).toBe(VOLCKER_1979.opening.unemployment)
    expect(state.latent.naturalUnemployment).toBe(
      VOLCKER_1979.opening.naturalUnemployment,
    )
    expect(state.latent.outputGap).toBe(VOLCKER_1979.opening.outputGap)
    expect(state.stance.targetRate).toBe(VOLCKER_1979.opening.policyRate)
  })

  it('opens the same way on any seed, because the opening is history', () => {
    const other = createInitialState(
      createRunConfig({
        institution: 'fed',
        difficulty: 'hard',
        seed: 'A-DIFFERENT-SEED',
        simulationVersion: SIMULATION_VERSION,
        scenario: 'volcker_1979',
      }),
    )
    expect(other.latent.inflationHeadline).toBe(state.latent.inflationHeadline)
    expect(other.latent.unemployment).toBe(state.latent.unemployment)
    expect(other.stance.targetRate).toBe(state.stance.targetRate)
  })

  it('takes its institution, rules and length from the scenario', () => {
    expect(state.config.institution).toBe('fed')
    expect(state.config.difficulty).toBe('hard')
    expect(state.config.mode).toBe('historical')
    expect(state.config.meetingCount).toBe(32)
    expect(state.config.scenario).toBe('volcker_1979')
  })

  it('gets no drawn opening crisis: the history is the opening', () => {
    expect(state.eventLog).toHaveLength(0)
  })
})
