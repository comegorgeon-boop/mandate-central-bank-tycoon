// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  SIMULATION_VERSION,
  createRunConfig,
  startRun,
  submitMeeting,
  type Difficulty,
  type Institution,
} from '../../simulation/index.ts'
import { toolkitPackage } from '../../simulation/policy/toolkitRule.ts'
import { readOrder } from './order.ts'

/**
 * The rule the player asked to be made executable:
 *
 * > "RÈGLE VÉRIFIABLE, écris le test : à chaque réunion cette ligne contient
 * > un verbe adressé au joueur et un chiffre à refermer. Aucune réunion ne
 * > peut ne présenter qu'une description."
 *
 * Which is the whole difference between a PDF and a game, stated as something
 * a machine can check. A description can be written by accident; an
 * instruction cannot. So every meeting of every mandate, at every difficulty
 * and both institutions, is walked and its order line is held to three tests:
 *
 *  1. it begins with an **imperative verb** from a closed list
 *  2. it carries a **number** the player is being asked to close
 *  3. it is addressed to a person — second person or imperative, never a
 *     tally of states
 *
 * The closed verb list is the point rather than a convenience. An open test —
 * "does it contain a verb" — passes on *"Inflation is rising"*, which is the
 * exact sentence this rule exists to forbid.
 */

/**
 * Every verb an order may open with.
 *
 * Adding one is a design decision and should be deliberate, which is why the
 * list lives in the test rather than in the module it checks: if `order.ts`
 * exported it, the module could widen its own test by widening itself.
 */
const IMPERATIVES = [
  'Bring',
  'Get',
  'Put',
  'Take',
  'Hold',
  'Keep',
  'Stop',
  'Let',
  'Raise',
  'Cut',
]

const INSTITUTIONS: readonly Institution[] = ['fed', 'ecb']
const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard']

describe('every meeting opens with an order, never a description', () => {
  for (const institution of INSTITUTIONS) {
    for (const difficulty of DIFFICULTIES) {
      it(`commands rather than describes on ${institution}/${difficulty}`, () => {
        let checked = 0

        for (let seed = 0; seed < 4; seed += 1) {
          const config = createRunConfig({
            institution,
            difficulty,
            seed: `order-${seed}`,
            simulationVersion: SIMULATION_VERSION,
          })
          let session = startRun(config)

          for (let meeting = 0; meeting < 40; meeting += 1) {
            const order = readOrder(session)
            checked += 1
            const where = `${institution}/${difficulty} seed ${seed} meeting ${meeting}`

            // 1. An imperative verb, first word.
            const firstWord = order.command.split(/\s+/)[0]
            expect(
              IMPERATIVES,
              `${where}: order opened with "${firstWord}" — ${JSON.stringify(order.command)}`,
            ).toContain(firstWord)

            // 2. A number to close, somewhere in the line.
            const line = `${order.command} ${order.detail}`
            expect(
              /\d/.test(line),
              `${where}: no number in ${JSON.stringify(line)}`,
            ).toBe(true)

            // 3. It ends as a sentence, so it reads as an instruction rather
            //    than a label.
            expect(order.command.endsWith('.'), `${where}: ${order.command}`).toBe(true)

            const result = submitMeeting(
              session,
              toolkitPackage(session, institution, difficulty),
            )
            if (!result.ok) break
            session = result.session
            if (session.outcome.status !== 'active') break
          }
        }

        // The walk has to have actually happened. A test that silently
        // examined nothing is the third blind spot in this project's history
        // and it is not going to be the fourth.
        expect(checked).toBeGreaterThan(20)
      })
    }
  }

  it('never produces a bare tally of states', () => {
    // The sentence this rule was written against, verbatim.
    const config = createRunConfig({
      institution: 'fed',
      difficulty: 'medium',
      seed: 'order-tally',
      simulationVersion: SIMULATION_VERSION,
    })
    let session = startRun(config)
    for (let meeting = 0; meeting < 20; meeting += 1) {
      const order = readOrder(session)
      expect(order.command).not.toMatch(/going right|going wrong/)
      expect(order.detail).not.toMatch(/going right|going wrong/)
      const result = submitMeeting(session, toolkitPackage(session, 'fed', 'medium'))
      if (!result.ok) break
      session = result.session
      if (session.outcome.status !== 'active') break
    }
  })

  it('warns in the FIRST sentence when the rate cannot close the gap', () => {
    /*
     * The thing the engine always knew and never said — and it has to be in
     * the **first** sentence, not the second.
     *
     * `dev/orderOnly.ts` found out why. The quick surface shows one sentence
     * to stay inside its word budget, and the warning was in the second one,
     * so the screen that shows a single sentence was showing the single
     * sentence without the warning in it. A reader with only that line
     * tightened into a cost-push shock the rate could not touch and broke the
     * banking system in nine of forty easy mandates. Moving the clause took
     * that to zero and the easy criterion from 78 % to 100 %.
     *
     * So this asserts the wording *and*, by taking the first sentence the way
     * `firstSentence` does, that it survives the compaction.
     */
    const config = createRunConfig({
      institution: 'fed',
      difficulty: 'hard',
      seed: 'order-energy',
      simulationVersion: SIMULATION_VERSION,
    })
    let session = startRun(config)
    let sawIt = false
    for (let meeting = 0; meeting < 40; meeting += 1) {
      // The wording moved into the first sentence, so the quick surface — which
      // shows only that sentence — carries the warning too. See `order.ts`.
      if (readOrder(session).detail.includes('will not answer to the rate')) sawIt = true
      const result = submitMeeting(session, toolkitPackage(session, 'fed', 'hard'))
      if (!result.ok) break
      session = result.session
      if (session.outcome.status !== 'active') break
    }
    expect(sawIt).toBe(true)
  })

  it('keeps the unreachable warning inside the compacted first sentence', () => {
    const config = createRunConfig({
      institution: 'fed',
      difficulty: 'hard',
      seed: 'order-energy',
      simulationVersion: SIMULATION_VERSION,
    })
    let session = startRun(config)
    let sawIt = false
    for (let meeting = 0; meeting < 40; meeting += 1) {
      const { detail } = readOrder(session)
      // The same rule `OrderBanner` applies in compact mode: everything up to
      // the first period that is followed by a space and a capital.
      const first = detail.match(/^.*?\.(?=\s+[A-Z]|\s*$)/)?.[0] ?? detail
      if (first.includes('will not answer to the rate')) sawIt = true
      const result = submitMeeting(session, toolkitPackage(session, 'fed', 'hard'))
      if (!result.ok) break
      session = result.session
      if (session.outcome.status !== 'active') break
    }
    expect(sawIt).toBe(true)
  })
})
