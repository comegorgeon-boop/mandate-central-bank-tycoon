// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  SIMULATION_VERSION,
  createRunConfig,
  liveShocks,
  startRun,
  submitMeeting,
  type Difficulty,
  type Institution,
} from '../../simulation/index.ts'
import { toolkitPackage } from '../../simulation/policy/toolkitRule.ts'
import { readOrder } from './order.ts'
import { readDispatches } from './dispatches.ts'

/**
 * The newspaper must be optional, and this is the check that says so.
 *
 * > "LA CAUSE SORT DU JOURNAL et monte en tête. Le journal garde la couleur
 * > et le ton mais ne porte plus aucune information indispensable : on doit
 * > pouvoir ne jamais l'ouvrir et comprendre quand même. Vérifie-le."
 *
 * The defect being closed is precise. A shock's whole life used to be in the
 * newswire — a headline when it landed, then nothing, while its effects went
 * on arriving for eight meetings through a lag kernel nobody could see. The
 * cause was in a newspaper, the consequence was in a chart, and nothing
 * joined them. So the player either read the press every meeting (too much
 * work) or played without knowing why anything was happening (which is what
 * actually happened, and is the complaint that started this).
 *
 * "Verify it" is the operative instruction, so the test is written as the
 * strongest form of the claim I can make executable: **every shock that is
 * still arriving is named outside the press.** If a shock can be live and
 * reach the player only through a newspaper headline, the press is still
 * compulsory and this fails.
 */

const INSTITUTIONS: readonly Institution[] = ['fed', 'ecb']
const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard']

describe('a player who never opens the press still understands', () => {
  for (const institution of INSTITUTIONS) {
    for (const difficulty of DIFFICULTIES) {
      it(`names every live shock outside the newswire on ${institution}/${difficulty}`, () => {
        let shocksSeen = 0

        for (let seed = 0; seed < 3; seed += 1) {
          const config = createRunConfig({
            institution,
            difficulty,
            seed: `press-${seed}`,
            simulationVersion: SIMULATION_VERSION,
          })
          let session = startRun(config)

          for (let meeting = 0; meeting < 30; meeting += 1) {
            const shocks = liveShocks(session.state)

            for (const shock of shocks) {
              shocksSeen += 1
              // Its name, what it is doing to both figures, how long it has
              // left and how to treat it — all of it available without
              // opening a single page of the press.
              expect(shock.title.length).toBeGreaterThan(0)
              expect(shock.treatment.length).toBeGreaterThan(20)
              expect(shock.meetingsLeft).toBeGreaterThan(0)
              expect(Number.isFinite(shock.onInflation)).toBe(true)
              expect(Number.isFinite(shock.onJobs)).toBe(true)
            }

            // And the order line always says what to do about the economy
            // those shocks are producing, whatever the press happens to be
            // running that week.
            const order = readOrder(session)
            expect(order.command.length).toBeGreaterThan(0)
            expect(/\d/.test(`${order.command} ${order.detail}`)).toBe(true)

            const result = submitMeeting(
              session,
              toolkitPackage(session, institution, difficulty),
            )
            if (!result.ok) break
            session = result.session
            if (session.outcome.status !== 'active') break
          }
        }

        // The walk has to have met some shocks, or it proved nothing at all.
        expect(shocksSeen).toBeGreaterThan(5)
      })
    }
  }

  it('guides the first three meetings and then stops, at every difficulty', () => {
    for (const difficulty of DIFFICULTIES) {
      const config = createRunConfig({
        institution: 'fed',
        difficulty,
        seed: 'guide-stops',
        simulationVersion: SIMULATION_VERSION,
      })
      let session = startRun(config)
      const guided: boolean[] = []

      for (let meeting = 0; meeting < 8; meeting += 1) {
        guided.push(readDispatches(session).some((d) => d.kind === 'guide'))
        const result = submitMeeting(session, toolkitPackage(session, 'fed', difficulty))
        if (!result.ok) break
        session = result.session
        if (session.outcome.status !== 'active') break
      }

      // Three, then silence. The silence is as deliberate as the guidance: a
      // tutorial that never stops is a game that never starts.
      expect(guided.slice(0, 3), difficulty).toEqual([true, true, true])
      expect(guided.slice(3).some(Boolean), difficulty).toBe(false)
    }
  })
})
