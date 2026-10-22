/**
 * Does the ECB's own ending ever actually happen?
 *
 * `council_lost` is the only way a fictional ECB presidency ends short of a
 * catastrophe: there is no reappointment to withhold and nobody can remove the
 * president, so the Treaty's answer is that a president who cannot carry the
 * Governing Council is finished anyway. It gates on member inflation
 * dispersion at or above `COUNCIL.fractureDispersion` **and** area
 * fragmentation at or above `COUNCIL.fractureFragmentation`, held for
 * `COUNCIL.meetingsToFail` consecutive meetings.
 *
 * It is also the structure docs/QUESTIONS.md #18 was offered as option (b) —
 * "take cohesion out of the score and put it in the revocation condition" —
 * and the answer given there is that the structure already exists. That answer
 * is worth nothing if the condition cannot fire, which is this project's most
 * repeated defect: a gate authored by hand against a quantity nobody had
 * measured, invisible to every test that asks what a mechanic *does*. Three of
 * the three gates in `dev/gateProbe.ts`'s first run were wrong in exactly that
 * way, one of them because an index sitting near 100 was read as a percentage
 * deviation.
 *
 * So this measures the two quantities against their two bars, rather than
 * asking whether the ending happened to appear in a sample.
 *
 * Run with: npx tsx src/simulation/dev/councilProbe.ts
 */

import type { Difficulty } from '../types/core.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { COUNCIL } from '../config/tenure.ts'
import { createRunConfig } from '../engine/initialState.ts'
import { dispersion } from '../engine/members.ts'
import { playRun, type RunSession } from '../replay/replayRun.ts'
import { toolkitPackage } from '../policy/toolkitRule.ts'

const RUNS = 60

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard']

function quantile(values: readonly number[], fraction: number): number {
  if (values.length === 0) return Number.NaN
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))]
}

function main(): void {
  console.log('')
  console.log(`Can the Council actually be lost? — engine ${SIMULATION_VERSION}`)
  console.log(
    `Bars: dispersion >= ${COUNCIL.fractureDispersion} AND fragmentation >= ` +
      `${COUNCIL.fractureFragmentation}, for ${COUNCIL.meetingsToFail} consecutive meetings.`,
  )
  console.log(`Warning tier at dispersion >= ${COUNCIL.watchDispersion}.`)
  console.log('='.repeat(100))
  console.log(
    [
      'bucket'.padEnd(22),
      'disp p50'.padEnd(9),
      'disp p90'.padEnd(9),
      'disp max'.padEnd(9),
      'frag p90'.padEnd(9),
      'frag max'.padEnd(9),
      'both'.padEnd(6),
      'ended',
    ].join(' '),
  )
  console.log('-'.repeat(100))

  for (const difficulty of DIFFICULTIES) {
    for (const play of ['competent', 'passive'] as const) {
      const dispersions: number[] = []
      const fragmentations: number[] = []
      let bothMet = 0
      let meetings = 0
      let ended = 0

      for (let index = 0; index < RUNS; index += 1) {
        const config = createRunConfig({
          institution: 'ecb',
          difficulty,
          seed: `council-${index}`,
          simulationVersion: SIMULATION_VERSION,
        })
        const session = playRun(config, (current: RunSession) =>
          play === 'competent'
            ? toolkitPackage(current, 'ecb', difficulty)
            : { actions: [], communication: null },
        )
        for (const snapshot of session.state.history) {
          if (snapshot.members.length === 0) continue
          const spread = dispersion(snapshot.members, 'inflationOffset')
          const fragmentation = snapshot.latent.fragmentation
          dispersions.push(spread)
          fragmentations.push(fragmentation)
          meetings += 1
          if (
            spread >= COUNCIL.fractureDispersion &&
            fragmentation >= COUNCIL.fractureFragmentation
          ) {
            bothMet += 1
          }
        }
        if (session.outcome.triggered === 'council_lost') ended += 1
      }

      console.log(
        [
          `ecb/${difficulty} ${play}`.padEnd(22),
          quantile(dispersions, 0.5).toFixed(2).padEnd(9),
          quantile(dispersions, 0.9).toFixed(2).padEnd(9),
          quantile(dispersions, 1).toFixed(2).padEnd(9),
          quantile(fragmentations, 0.9).toFixed(0).padEnd(9),
          quantile(fragmentations, 1).toFixed(0).padEnd(9),
          `${((bothMet / Math.max(1, meetings)) * 100).toFixed(1)}%`.padEnd(6),
          `${ended}/${RUNS}`,
        ].join(' '),
      )
    }
    console.log('-'.repeat(100))
  }

  console.log('')
  console.log('`both` is the share of meetings where BOTH bars are met at once — the')
  console.log('thing the five-meeting counter counts. If it is 0.0 % the ending cannot')
  console.log('happen, and the warning tier above it is a threat the game cannot carry out.')

  candidates()
  console.log('')
}

/**
 * Where the bars belong, if they belong anywhere.
 *
 * `dev/gateProbe.ts`'s lesson, applied: **set a gate from a measurement of two
 * populations, and put it where it bills the pattern rather than the
 * accident.** A bar competent play clears is a tax; a bar neglect never
 * reaches is decoration; the useful bar is between them.
 *
 * Reported as the share of *runs* in which the condition would be held for
 * `COUNCIL.meetingsToFail` consecutive meetings — which is what the counter
 * actually asks, and is not the same as the share of meetings at which both
 * bars happen to be met.
 */
function candidates(): void {
  const DISPERSIONS = [0.6, 0.8, 1.0, 1.2]
  const FRAGMENTATIONS = [250, 300, 350]

  console.log('')
  console.log('Candidate bars — share of runs the condition would be HELD long enough')
  console.log(
    `(${COUNCIL.meetingsToFail} consecutive meetings), competent / passive, ecb/hard then medium`,
  )
  console.log('='.repeat(100))

  for (const difficulty of ['hard', 'medium'] as const) {
    const paths = new Map<string, { readonly spread: number; readonly frag: number }[][]>()
    for (const play of ['competent', 'passive'] as const) {
      const runs: { readonly spread: number; readonly frag: number }[][] = []
      for (let index = 0; index < RUNS; index += 1) {
        const config = createRunConfig({
          institution: 'ecb',
          difficulty,
          seed: `council-${index}`,
          simulationVersion: SIMULATION_VERSION,
        })
        const session = playRun(config, (current: RunSession) =>
          play === 'competent'
            ? toolkitPackage(current, 'ecb', difficulty)
            : { actions: [], communication: null },
        )
        runs.push(
          session.state.history
            .filter((snapshot) => snapshot.members.length > 0)
            .map((snapshot) => ({
              spread: dispersion(snapshot.members, 'inflationOffset'),
              frag: snapshot.latent.fragmentation,
            })),
        )
      }
      paths.set(play, runs)
    }

    const heldShare = (
      runs: { readonly spread: number; readonly frag: number }[][],
      spreadBar: number,
      fragBar: number,
    ): number => {
      let hit = 0
      for (const path of runs) {
        let streak = 0
        let reached = false
        for (const point of path) {
          streak = point.spread >= spreadBar && point.frag >= fragBar ? streak + 1 : 0
          if (streak >= COUNCIL.meetingsToFail) {
            reached = true
            break
          }
        }
        if (reached) hit += 1
      }
      return hit / Math.max(1, runs.length)
    }

    console.log('')
    console.log(`ecb/${difficulty}`)
    console.log(
      `  ${'dispersion'.padEnd(12)}` +
        FRAGMENTATIONS.map((frag) => `frag ${frag}`.padStart(16)).join(''),
    )
    for (const spreadBar of DISPERSIONS) {
      const cells = FRAGMENTATIONS.map((fragBar) => {
        const competent = heldShare(paths.get('competent')!, spreadBar, fragBar)
        const passive = heldShare(paths.get('passive')!, spreadBar, fragBar)
        return `${(competent * 100).toFixed(0)}% / ${(passive * 100).toFixed(0)}%`.padStart(16)
      })
      console.log(`  ${spreadBar.toFixed(1).padEnd(12)}${cells.join('')}`)
    }
  }

  console.log('')
  console.log('Read it as: competent% / passive%. The bar belongs where the first is')
  console.log('near zero and the second is not — a president who steers the area keeps')
  console.log('the room, and one who lets it come apart does not.')
}

main()
