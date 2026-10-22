/**
 * How often does the bulletin take the screen?
 *
 * The one measurement this feature lives or dies on, and the player named the
 * failure mode rather than the target:
 *
 * > "RÉSERVÉE AUX MAJEURS ET AU CRITIQUE, jamais à la routine, avec un plafond
 * > par mandat. Si ça surgit tout le temps, ça devient du papier peint en
 * > trois réunions et j'aurai perdu l'outil au moment précis où j'en ai
 * > besoin."
 *
 * **The number to read is `worst`, not `of mtgs`.** That took a correction.
 * The share of meetings interrupted looks like the wallpaper metric and is
 * not: a hard mandate that ends at meeting five after three things went
 * critical reports 60 %, and three interruptions in a five-meeting catastrophe
 * is not wallpaper, it is a catastrophe. What trains a player to dismiss on
 * reflex is *volume over a career*, which the per-mandate allowance bounds
 * directly — so the claim is that `worst` never exceeds `PER_MANDATE_CAP`, and
 * `median` says what an ordinary mandate actually sees.
 *
 * The share is still printed, because a *long* mandate with a high share would
 * be the real thing going wrong.
 *
 * Measured under competent *and* passive play, because the two produce very
 * different weather and a rate that is fine for one can be wallpaper for the
 * other — a passive chair breaks the guard and drifts from both targets, which
 * is three of the four kinds.
 *
 * Run with: npx tsx src/simulation/dev/bulletinRate.ts
 */

import type { Difficulty, Institution } from '../types/core.ts'
import type { PolicyPackage } from '../types/policy.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { createRunConfig } from '../engine/initialState.ts'
import { startRun, submitMeeting, type RunSession } from '../replay/replayRun.ts'
import { toolkitPackage } from '../policy/toolkitRule.ts'
import type { BulletinKind } from '../explain/bulletin.ts'

const RUNS = 40

const BUCKETS: readonly (readonly [Institution, Difficulty])[] = [
  ['fed', 'easy'],
  ['fed', 'medium'],
  ['fed', 'hard'],
  ['ecb', 'medium'],
  ['ecb', 'hard'],
]

type Play = 'competent' | 'passive'

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

interface Reading {
  readonly share: number
  readonly medianPerMandate: number
  readonly worst: number
  readonly byKind: Readonly<Record<BulletinKind, number>>
  readonly meetings: number
}

function measure(
  institution: Institution,
  difficulty: Difficulty,
  play: Play,
): Reading {
  let shown = 0
  let meetings = 0
  const perMandate: number[] = []
  const byKind: Record<BulletinKind, number> = {
    major_event: 0,
    post_at_risk: 0,
    guard_broken: 0,
    target_adrift: 0,
  }

  for (let index = 0; index < RUNS; index += 1) {
    const config = createRunConfig({
      institution,
      difficulty,
      seed: `bulletin-${index}`,
      simulationVersion: SIMULATION_VERSION,
    })
    let session = startRun(config)
    let here = 0

    while (session.outcome.status === 'active') {
      const pkg: PolicyPackage =
        play === 'passive'
          ? { actions: [], communication: null }
          : toolkitPackage(session as RunSession, institution, difficulty)
      const result = submitMeeting(session, pkg)
      if (!result.ok) break
      session = result.session
      meetings += 1

      // Read off the session rather than recomputed: the run loop decides it
      // now, which is what makes the per-mandate allowance exact. A harness
      // that recomputed it would be measuring a second implementation.
      const bulletin = session.bulletin
      if (bulletin !== null) {
        shown += 1
        here += 1
        byKind[bulletin.kind] += 1
      }
    }
    perMandate.push(here)
  }

  return {
    share: meetings === 0 ? 0 : shown / meetings,
    medianPerMandate: median(perMandate),
    worst: Math.max(...perMandate),
    byKind,
    meetings,
  }
}

function main(): void {
  console.log('')
  console.log(`How often the bulletin interrupts — engine ${SIMULATION_VERSION}`)
  console.log(`${RUNS} mandates a cell. The failure mode is wallpaper, not noise.`)
  console.log('='.repeat(108))
  console.log(
    [
      'bucket'.padEnd(22),
      'of mtgs'.padEnd(9),
      'median'.padEnd(8),
      'worst'.padEnd(7),
      'major'.padEnd(7),
      'post'.padEnd(7),
      'guard'.padEnd(7),
      'adrift',
    ].join(' '),
  )
  console.log('-'.repeat(108))

  for (const [institution, difficulty] of BUCKETS) {
    for (const play of ['competent', 'passive'] as const) {
      const reading = measure(institution, difficulty, play)
      console.log(
        [
          `${institution}/${difficulty} ${play}`.padEnd(22),
          `${(reading.share * 100).toFixed(1)}%`.padEnd(9),
          `${reading.medianPerMandate}`.padEnd(8),
          `${reading.worst}`.padEnd(7),
          `${reading.byKind.major_event}`.padEnd(7),
          `${reading.byKind.post_at_risk}`.padEnd(7),
          `${reading.byKind.guard_broken}`.padEnd(7),
          `${reading.byKind.target_adrift}`,
        ].join(' '),
      )
    }
    console.log('-'.repeat(108))
  }

  console.log('')
  console.log('`worst` is the claim: no mandate may exceed the allowance, because what')
  console.log('trains a player to dismiss on reflex is volume over a career. A high share')
  console.log('on a SHORT mandate is a catastrophe, not wallpaper — read `median` beside it.')
  console.log('')
}

main()
