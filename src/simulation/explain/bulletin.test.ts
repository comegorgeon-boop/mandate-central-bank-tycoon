import { describe, expect, it } from 'vitest'
import type { Difficulty, Institution } from '../types/core.ts'
import type { PolicyPackage } from '../types/policy.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { createRunConfig } from '../engine/initialState.ts'
import { startRun, submitMeeting, type RunSession } from '../replay/replayRun.ts'
import { toolkitPackage } from '../policy/toolkitRule.ts'

/**
 * **The interruption must stay rare, and it must be able to happen.**
 *
 * Both halves, because this feature has exactly two ways to be worthless and
 * they are opposite. The player named the first:
 *
 * > "Si ça surgit tout le temps, ça devient du papier peint en trois réunions
 * > et j'aurai perdu l'outil au moment précis où j'en ai besoin."
 *
 * And the second is this project's most repeated defect — content that cannot
 * fire, which every test asking what a mechanic *does* passes straight over.
 * `council_lost` was dead for as long as it existed while two documents
 * asserted it worked.
 *
 * The first version of the cap leaked, and it is worth recording how: it was
 * recomputed from `state.history` and `state.eventLog`, which cannot see
 * `post_at_risk` because that kind fires off the end conditions and a history
 * snapshot carries only the economy. Measured, the worst mandates showed five
 * and six against a cap of four. The count now lives on the session, where
 * every bulletin passes through it.
 */

const SEEDS = 12

function play(
  institution: Institution,
  difficulty: Difficulty,
  seed: string,
  passive: boolean,
): { readonly shown: number; readonly kinds: Set<string>; readonly meetings: number } {
  const config = createRunConfig({
    institution,
    difficulty,
    seed,
    simulationVersion: SIMULATION_VERSION,
  })
  let session = startRun(config)
  let shown = 0
  let meetings = 0
  const kinds = new Set<string>()

  while (session.outcome.status === 'active') {
    const pkg: PolicyPackage = passive
      ? { actions: [], communication: null }
      : toolkitPackage(session as RunSession, institution, difficulty)
    const result = submitMeeting(session, pkg)
    if (!result.ok) break
    session = result.session
    meetings += 1
    if (session.bulletin !== null) {
      shown += 1
      kinds.add(session.bulletin.kind)
    }
  }

  return { shown, kinds, meetings }
}

describe('the bulletin that takes the screen', () => {
  it('never exceeds its per-mandate allowance, on any seed', () => {
    // The allowance is not imported: the test states the number the player was
    // promised, so raising the constant does not silently raise the promise.
    const ALLOWANCE = 4

    for (const institution of ['fed', 'ecb'] as const) {
      for (const difficulty of ['easy', 'medium', 'hard'] as const) {
        for (const passive of [false, true]) {
          for (let seed = 0; seed < SEEDS; seed += 1) {
            const run = play(institution, difficulty, `bulletin-test-${seed}`, passive)
            expect(
              run.shown,
              `${institution}/${difficulty} ${passive ? 'passive' : 'competent'} seed ` +
                `${seed} showed ${run.shown} bulletins over ${run.meetings} meetings. ` +
                'The allowance is the whole feature: an interruption is a currency, ' +
                'and every one spent on something ordinary devalues the next. Measure ' +
                'with dev/bulletinRate.ts before touching it.',
            ).toBeLessThanOrEqual(ALLOWANCE)
          }
        }
      }
    }
  }, 120_000)

  it('can actually fire, and on more than one kind of thing', () => {
    const kinds = new Set<string>()
    let anyShown = 0

    for (const [institution, difficulty] of [
      ['fed', 'medium'],
      ['ecb', 'hard'],
    ] as const) {
      for (const passive of [false, true]) {
        for (let seed = 0; seed < SEEDS; seed += 1) {
          const run = play(institution, difficulty, `bulletin-test-${seed}`, passive)
          anyShown += run.shown
          for (const kind of run.kinds) kinds.add(kind)
        }
      }
    }

    expect(
      anyShown,
      'No bulletin fired anywhere. A takeover nobody ever sees is the other way ' +
        'this feature is worthless, and it is the failure this project keeps ' +
        'shipping — see `scoring/reachable.test.ts`.',
    ).toBeGreaterThan(0)

    // More than one kind, because a gate that only ever admits majors would
    // mean the three critical cases the player defined are decoration.
    expect(
      [...kinds].sort(),
      `only these kinds ever fired: ${[...kinds].join(', ')}. The player defined ` +
        'critical as "a target coming badly adrift, a guard being broken, or the ' +
        'post approaching revocation" — a bulletin that only ever reports market ' +
        'news is not that.',
    ).not.toHaveLength(1)
  }, 120_000)

  it('says what happened, what it did to the numbers, and what it means', () => {
    // The three fields the player asked for, on a real bulletin rather than a
    // constructed one: "ce qui s'est passé, ce que ça fait à mes trois
    // chiffres, et ce que ça veut dire concrètement — en mots, pas en indices".
    let checked = 0
    for (let seed = 0; seed < SEEDS && checked === 0; seed += 1) {
      const config = createRunConfig({
        institution: 'fed',
        difficulty: 'medium',
        seed: `bulletin-shape-${seed}`,
        simulationVersion: SIMULATION_VERSION,
      })
      let session = startRun(config)
      while (session.outcome.status === 'active') {
        const result = submitMeeting(
          session,
          toolkitPackage(session as RunSession, 'fed', 'medium'),
        )
        if (!result.ok) break
        session = result.session
        const bulletin = session.bulletin
        if (bulletin === null) continue

        expect(bulletin.headline.length, 'the headline says nothing').toBeGreaterThan(10)
        expect(bulletin.meaning.length, 'the meaning is not a sentence').toBeGreaterThan(40)
        // Three readings, each with a before and an after. The point of the
        // middle block is that it is a *change*, not a snapshot.
        expect(bulletin.readings.length).toBe(3)
        for (const reading of bulletin.readings) {
          expect(reading.before).toMatch(/\d/)
          expect(reading.after).toMatch(/\d/)
        }
        checked += 1
        break
      }
    }
    expect(checked, 'no bulletin was produced to inspect').toBe(1)
  }, 60_000)
})
