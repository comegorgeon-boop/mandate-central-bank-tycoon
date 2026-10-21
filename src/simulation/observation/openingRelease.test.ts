// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { SIMULATION_VERSION } from '../version.ts'
import { createRunConfig } from '../engine/initialState.ts'
import { startRun, submitMeeting } from '../replay/replayRun.ts'
import type { Difficulty, Institution } from '../types/core.ts'

/**
 * The first meetings always have the two figures the mandate is about.
 *
 * > "À chaque début de partie on me dit « this release did not arrive in time
 * > for the meeting ». Du coup je ne comprends même pas l'économie dont
 * > j'hérite, et ça ajoute du flou là où il en faut le moins."
 *
 * A missing release is a good mechanic in the wrong place. Later it is one of
 * the best moments the game has — the meeting where the figure you needed is
 * the one that did not arrive. At the opening it is only a player who cannot
 * read the board they were handed.
 *
 * Two separate causes had to be fixed, and the second was the real one:
 *
 *  1. the difficulty's `missingObservationProbability` could drop it;
 *  2. with a publication lag, `meetingIndex − lag` is **negative** at meeting
 *     zero, so the figure had never been published at all. The grace period
 *     alone did nothing about that, and the symptom was identical.
 *
 * A committee inherits a published history. It does not take office in a
 * statistical vacuum.
 */

const SEEDS = 25
const GRACE = 3
const ESSENTIAL = ['headline_inflation', 'unemployment'] as const

describe('the opening meetings publish the mandate', () => {
  for (const institution of ['fed', 'ecb'] as Institution[]) {
    for (const difficulty of ['easy', 'medium', 'hard'] as Difficulty[]) {
      it(`always has inflation and unemployment on ${institution}/${difficulty}`, () => {
        const absent: string[] = []

        for (let seed = 0; seed < SEEDS; seed += 1) {
          const config = createRunConfig({
            institution,
            difficulty,
            seed: `opening-release-${seed}`,
            simulationVersion: SIMULATION_VERSION,
          })
          let session = startRun(config)

          for (let meeting = 0; meeting < GRACE; meeting += 1) {
            for (const id of ESSENTIAL) {
              if (session.observation.indicators[id]?.value == null) {
                absent.push(`seed ${seed} meeting ${meeting}: ${id}`)
              }
            }
            const result = submitMeeting(session, { actions: [], communication: null })
            if (!result.ok) break
            session = result.session
            if (session.outcome.status !== 'active') break
          }
        }

        expect(
          absent,
          `a player cannot read the economy they inherited: ${absent.slice(0, 5).join('; ')}`,
        ).toEqual([])
      })
    }
  }

  it('still lets a release go missing once the mandate is under way', () => {
    // The mechanic is kept, and it is kept for a reason — this asserts the
    // grace period did not quietly disable it everywhere.
    let seenMissing = false
    for (let seed = 0; seed < 30 && !seenMissing; seed += 1) {
      const config = createRunConfig({
        institution: 'fed',
        difficulty: 'hard',
        seed: `late-missing-${seed}`,
        simulationVersion: SIMULATION_VERSION,
      })
      let session = startRun(config)
      for (let meeting = 0; meeting < 20; meeting += 1) {
        if (meeting >= GRACE) {
          for (const row of Object.values(session.observation.indicators)) {
            if (row?.missing === true) seenMissing = true
          }
        }
        const result = submitMeeting(session, { actions: [], communication: null })
        if (!result.ok) break
        session = result.session
        if (session.outcome.status !== 'active') break
      }
    }
    expect(seenMissing).toBe(true)
  })
})
