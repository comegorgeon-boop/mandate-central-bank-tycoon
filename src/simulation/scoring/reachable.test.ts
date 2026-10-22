import { describe, expect, it } from 'vitest'
import type { Difficulty, Institution } from '../types/core.ts'
import type { EndConditionId } from '../types/scoring.ts'
import type { PolicyPackage } from '../types/policy.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { createRunConfig } from '../engine/initialState.ts'
import { playRun, type RunSession } from '../replay/replayRun.ts'
import { toolkitPackage } from '../policy/toolkitRule.ts'

/**
 * **Every ending the game can announce must be an ending the game can reach.**
 *
 * The guardrail that did not exist, for any end condition, and whose absence
 * cost this project its most consequential piece of unreachable content:
 * `council_lost` — the *only* way a fictional ECB presidency ends short of a
 * catastrophe, the whole structural difference between the two institutions,
 * written up in DIRECTION as a design decision and asserted as fact in REPRISE
 * — could not fire. It asked for member inflation dispersion at 2.4 points and
 * area fragmentation at 290 basis points *at once*, and the two quantities
 * peak under opposite conditions: 0.0 % of meetings over 360 mandates, 0
 * endings in 60 in every cell. Meanwhile the game told the player, in as many
 * words, "You can lose the room."
 *
 * `dev/gateProbe.ts` was written two passes earlier because three hand-set
 * *event* gates were wrong, two of them unable to fire. Nothing probed the
 * **end conditions**, which are the gates that decide whether a mandate ends
 * at all. A check that covers one family of hand-set thresholds and not the
 * other is the same shape as a rule nobody runs.
 *
 * ## What this does and does not prove
 *
 * It plays a spread of mandates under three deliberately different rules and
 * requires each listed ending to occur at least once. That is a weak claim by
 * design — it says *reachable*, not *correctly tuned*, and tuning is what
 * `dev/councilProbe.ts` and the balance sweep are for. A weak claim that fails
 * loudly on zero beats a strong one nobody wrote.
 *
 * Deliberately excluded, each with its reason, because an exclusion without
 * one is how a dead condition hides in a green test.
 */

/** Endings that must occur somewhere in the sample below. */
const MUST_BE_REACHABLE: readonly EndConditionId[] = [
  'mandate_completed',
  'objective_met',
  'objective_missed',
  'inflation_spiral',
  'banking_crisis',
  'dismissed',
  // The one this file exists for.
  'council_lost',
]

/**
 * Endings this sample cannot produce, and why each is out rather than broken.
 *
 * - `gave_in` and the gold-standard endings are **scenario only**: they need a
 *   historical calendar and an inherited anchor, and this walk plays fictional
 *   mandates. `scenarios/playable.test.ts` reaches them.
 * - `deflation_spiral` and `depression` need an economy driven hard in the
 *   *other* direction for years. Reachable — 1929-33 is built on them — but
 *   not by any rule a fictional mandate would plausibly run, so demanding them
 *   here would mean writing a rule whose only purpose is to satisfy this test.
 * - `fragmentation_crisis`, `currency_dysfunction` and
 *   `loss_of_monetary_control` fire in the tail rather than the median and do
 *   appear in `npm run sim:sweep`'s outcome tallies; a bound on them at this
 *   sample size would be a coin that fails the build.
 */
const NOT_IN_THIS_SAMPLE: readonly EndConditionId[] = [
  'gave_in',
  'deflation_spiral',
  'depression',
  'fragmentation_crisis',
  'currency_dysfunction',
  'loss_of_monetary_control',
]

/** A chair who holds one coherent stance and never revisits it. */
function stubborn(): PolicyPackage {
  return { actions: [{ instrument: 'policy_rate', magnitude: 50 }], communication: null }
}

const RULES: readonly {
  readonly name: string
  readonly choose: (
    session: RunSession,
    institution: Institution,
    difficulty: Difficulty,
  ) => PolicyPackage
}[] = [
  { name: 'competent', choose: (s, i, d) => toolkitPackage(s, i, d) },
  { name: 'passive', choose: () => ({ actions: [], communication: null }) },
  { name: 'stubborn', choose: () => stubborn() },
]

describe('every ending the game announces can actually happen', () => {
  it('reaches each of them in a spread of fictional mandates', () => {
    const seen = new Map<string, string[]>()

    for (const institution of ['fed', 'ecb'] as const) {
      for (const difficulty of ['easy', 'medium', 'hard'] as const) {
        for (const rule of RULES) {
          for (let seed = 0; seed < 6; seed += 1) {
            const config = createRunConfig({
              institution,
              difficulty,
              seed: `reach-${seed}`,
              simulationVersion: SIMULATION_VERSION,
            })
            const session = playRun(config, (current) =>
              rule.choose(current, institution, difficulty),
            )
            const id = session.outcome.triggered ?? 'mandate_completed'
            const where = `${institution}/${difficulty} ${rule.name}`
            seen.set(id, [...(seen.get(id) ?? []), where])
          }
        }
      }
    }

    const unreachable = MUST_BE_REACHABLE.filter((id) => !seen.has(id))
    expect(
      unreachable,
      `These endings are in the catalogue, are shown to the player as ` +
        `possible, and did not occur once in ${2 * 3 * RULES.length * 6} mandates:\n` +
        `  ${unreachable.join(', ')}\n\n` +
        'An ending the game cannot reach is worse than one it does not have, ' +
        'because the game says it can. If one of these is genuinely out of ' +
        'this sample rather than broken, move it to NOT_IN_THIS_SAMPLE **with ' +
        'the reason** — an exclusion without one is how a dead condition hides ' +
        'in a green test.\n\n' +
        `Reached: ${[...seen.keys()].sort().join(', ')}`,
    ).toEqual([])

    // And the exclusions must stay honest: if one starts occurring, it belongs
    // in the list above rather than quietly in both.
    const nowReachable = NOT_IN_THIS_SAMPLE.filter((id) => seen.has(id))
    if (nowReachable.length > 0) {
      // Not a failure — a condition becoming reachable is good news. It is a
      // message, so the list does not drift into fiction.
      console.log(
        `endConditions now reachable in this sample and excluded from it: ${nowReachable.join(', ')}`,
      )
    }
  }, 120_000)
})
