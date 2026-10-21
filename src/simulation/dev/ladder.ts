/**
 * How long does the difficulty ladder last?
 *
 * > "Tu m'as écrit que le mode difficile ouvre à trois lectures cassées mais
 * > n'en a plus que deux dès la réunion suivante, et que tu l'as rattrapé par
 * > une coupe dans la croissance tendancielle. Mesure-le proprement et
 * > donne-moi le chiffre : sur combien de réunions l'échelle tient-elle, en
 * > facile, en moyen et en difficile ? Si elle s'effondre au bout de trois
 * > réunions, elle ne décrit que l'écran d'accueil et pas le jeu."
 *
 * The invariant in `initialState.test.ts` is checked at **meeting zero**, on
 * every seed, and it holds there: one broken reading on easy, two in
 * opposition on medium, three on hard. That is a claim about the opening
 * screen and the player is right that it is not a claim about the game.
 *
 * So this walks the mandate and counts the broken readings at *every* meeting,
 * against the same `BROKEN` thresholds the test uses — imported rather than
 * restated, because a threshold written twice is a threshold that will
 * eventually disagree with itself, and this project has shipped that twice.
 *
 * ## The third reading is a guard, and a guard is not measured as a level
 *
 * Counting all three readings together gives the answer the player feared and
 * it is the wrong answer. `explain/mandate.ts` declares two of the three a
 * **target** and the third a **guard**:
 *
 *   > growth — "Not a target — the cost of reaching the other two. Breaking
 *   > the economy to hit the objective is losing, not winning."
 *
 * A guard that is broken for thirty consecutive meetings is not a guard, it is
 * a third target; and a guard whose whole job is to be intact until you push
 * too hard *should* heal when nobody pushes. Measured under passivity against
 * a level, hard's guard closes at meeting 1 — and reading that as the ladder
 * collapsing is reading a guard as a target.
 *
 * So three questions, with three different shapes:
 *
 *   **Targets** — do the two targets stay further out at hard than at medium,
 *   and at medium than at easy? This is the ladder proper, it is a comparison,
 *   and it is measured as a *distance* rather than a count, because two
 *   readings both nominally "broken" can be one point out or six.
 *
 *   **Guard** — how often is it broken, as a share of meetings? A guard's
 *   ladder is a frequency, not a level.
 *
 *   **Opening** — the count of all three, by meeting, which is what
 *   `initialState.test.ts` asserts at meeting zero and what the player asked
 *   to see extended. Reported because it is the question as asked, with the
 *   caveat above attached to it.
 *
 * Measured under **passive** play for the first two and under both for the
 * guard. The question is what the mode presents, not what a good player can
 * repair — except for the guard, where the whole claim is that *pushing* at
 * hard breaks it and pushing at medium does not, so passivity cannot see it.
 *
 * Run with: npx tsx src/simulation/dev/ladder.ts
 */

import type { Difficulty, Institution } from '../types/core.ts'
import type { LatentState } from '../types/state.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { getInstitution } from '../config/institutions.ts'
import { BROKEN, createRunConfig } from '../engine/initialState.ts'
import { startRun, submitMeeting } from '../replay/replayRun.ts'
import { toolkitPackage } from '../policy/toolkitRule.ts'

const SEEDS = 40

/** How far to walk. Long enough that a Fed term is covered end to end. */
const HORIZON = 32

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard']
const INSTITUTIONS: readonly Institution[] = ['fed', 'ecb']

type Play = 'passive' | 'competent'

/** Is one reading broken, on `initialState.test.ts`'s own definition? */
function brokenInflation(latent: LatentState, target: number): boolean {
  return Math.abs(latent.inflationHeadline - target) > BROKEN.inflation
}
function brokenUnemployment(latent: LatentState): boolean {
  return Math.abs(latent.unemployment - latent.naturalUnemployment) > BROKEN.unemployment
}
function brokenGuard(latent: LatentState): boolean {
  return latent.realGrowth < BROKEN.growth
}

/**
 * **How far out the two targets are, in points.**
 *
 * A count cannot carry a ladder: inflation one point above target and
 * inflation six points above target are both "broken", and the difference
 * between them is most of what separates the modes. So the ladder is measured
 * as the distance still to close, normalised by each reading's own threshold
 * so the two are commensurable and 1.0 means "exactly at the edge of broken".
 */
function targetDistance(latent: LatentState, target: number): number {
  return (
    Math.abs(latent.inflationHeadline - target) / BROKEN.inflation +
    Math.abs(latent.unemployment - latent.naturalUnemployment) / BROKEN.unemployment
  )
}

interface Walk {
  /** Mean count of all three broken readings, by meeting. */
  readonly count: readonly number[]
  /** Mean normalised distance of the two targets, by meeting. */
  readonly distance: readonly number[]
  /** Share of meetings on which the growth guard was broken. */
  readonly guardBroken: number
  /** Mean meetings served. */
  readonly tenure: number
}

/** Walks the mandate, passive or competent, and summarises the three claims. */
function walk(institution: Institution, difficulty: Difficulty, play: Play): Walk {
  const target = getInstitution(institution).inflationTarget
  const countSums = new Array<number>(HORIZON).fill(0)
  const distanceSums = new Array<number>(HORIZON).fill(0)
  const counts = new Array<number>(HORIZON).fill(0)
  let guardMeetings = 0
  let allMeetings = 0
  let tenure = 0

  for (let seed = 0; seed < SEEDS; seed += 1) {
    const config = createRunConfig({
      institution,
      difficulty,
      seed: `ladder-${seed}`,
      simulationVersion: SIMULATION_VERSION,
    })
    let session = startRun(config)
    for (let meeting = 0; meeting < HORIZON; meeting += 1) {
      const { latent } = session.state
      const broken =
        (brokenInflation(latent, target) ? 1 : 0) +
        (brokenUnemployment(latent) ? 1 : 0) +
        (brokenGuard(latent) ? 1 : 0)
      countSums[meeting] += broken
      distanceSums[meeting] += targetDistance(latent, target)
      counts[meeting] += 1
      if (brokenGuard(latent)) guardMeetings += 1
      allMeetings += 1
      tenure += 1

      const pkg =
        play === 'passive'
          ? { actions: [], communication: null }
          : toolkitPackage(session, institution, difficulty)
      const result = submitMeeting(session, pkg)
      if (!result.ok) break
      session = result.session
      if (session.outcome.status !== 'active') break
    }
  }

  const mean = (sums: readonly number[]): readonly number[] =>
    sums.map((sum, index) => (counts[index] === 0 ? Number.NaN : sum / counts[index]))

  return {
    count: mean(countSums),
    distance: mean(distanceSums),
    guardBroken: allMeetings === 0 ? 0 : guardMeetings / allMeetings,
    tenure: tenure / SEEDS,
  }
}

/** The last meeting up to which a predicate holds at every meeting from zero. */
function holdsThrough(predicate: (meeting: number) => boolean): number {
  let meeting = 0
  while (meeting < HORIZON && predicate(meeting)) meeting += 1
  return meeting
}

const COLUMNS = [...Array.from({ length: 11 }, (_, index) => index), 14, 18, 22, 26, 30]

function series(values: readonly number[], decimals: number): string {
  return COLUMNS.map((meeting) => {
    const value = values[meeting]
    return (Number.isFinite(value) ? value.toFixed(decimals) : '—').padStart(6)
  }).join('')
}

function header(): string {
  return `  ${'meeting'.padEnd(9)}${COLUMNS.map((m) => String(m).padStart(6)).join('')}`
}

function main(): void {
  console.log('')
  console.log(`How long the difficulty ladder lasts — engine ${SIMULATION_VERSION}`)
  console.log(
    `${SEEDS} seeds a bucket, ${HORIZON} meetings. ` +
      `Broken at |infl−target| > ${BROKEN.inflation}, ` +
      `|u−u*| > ${BROKEN.unemployment}, growth < ${BROKEN.growth}.`,
  )
  console.log('='.repeat(108))

  for (const institution of INSTITUTIONS) {
    const passive = new Map<Difficulty, Walk>(
      DIFFICULTIES.map((difficulty) => [difficulty, walk(institution, difficulty, 'passive')]),
    )
    const competent = new Map<Difficulty, Walk>(
      DIFFICULTIES.map((difficulty) => [
        difficulty,
        walk(institution, difficulty, 'competent'),
      ]),
    )

    console.log('')
    console.log(
      `${institution} — THE LADDER: distance still to close on the two targets, passive`,
    )
    console.log(header())
    for (const difficulty of DIFFICULTIES) {
      console.log(
        `  ${difficulty.padEnd(9)}${series(passive.get(difficulty)?.distance ?? [], 1)}`,
      )
    }

    /*
     * The ordering claim, with a margin. "hard ≥ medium" passes on a tie, and
     * a ladder whose rungs touch is not a ladder. A quarter of one threshold —
     * 0.25 points of inflation, or of unemployment — is about the smallest
     * difference a player reading the gauges could notice.
     */
    const MARGIN = 0.25
    const distanceOf = (difficulty: Difficulty): readonly number[] =>
      passive.get(difficulty)?.distance ?? []
    const [easy, medium, hard] = (['easy', 'medium', 'hard'] as const).map(distanceOf)
    const ordered = holdsThrough(
      (meeting) =>
        Number.isFinite(hard[meeting]) &&
        Number.isFinite(medium[meeting]) &&
        Number.isFinite(easy[meeting]) &&
        hard[meeting] >= medium[meeting] + MARGIN &&
        medium[meeting] >= easy[meeting] + MARGIN,
    )
    console.log(
      `  >> ORDERING holds through meeting ` +
        `${ordered >= HORIZON ? `${HORIZON}+ (the whole walk)` : ordered}` +
        `, hard > medium > easy by ${MARGIN} at every meeting up to it`,
    )

    console.log('')
    console.log(`${institution} — THE GUARD: share of meetings with growth below the floor`)
    for (const difficulty of DIFFICULTIES) {
      const quiet = passive.get(difficulty)
      const pushing = competent.get(difficulty)
      console.log(
        `  ${difficulty.padEnd(9)}` +
          ` passive ${((quiet?.guardBroken ?? 0) * 100).toFixed(0).padStart(3)} %` +
          ` over ${(quiet?.tenure ?? 0).toFixed(1).padStart(4)} meetings` +
          `    pushing ${((pushing?.guardBroken ?? 0) * 100).toFixed(0).padStart(3)} %` +
          ` over ${(pushing?.tenure ?? 0).toFixed(1).padStart(4)} meetings`,
      )
    }

    console.log('')
    console.log(`${institution} — AS ASKED: count of all three broken readings, passive`)
    console.log(header())
    for (const difficulty of DIFFICULTIES) {
      console.log(
        `  ${difficulty.padEnd(9)}${series(passive.get(difficulty)?.count ?? [], 1)}`,
      )
    }
  }

  console.log('')
  console.log('='.repeat(108))
  console.log('ORDERING is the ladder: the two targets, as a distance, mode against mode.')
  console.log('THE GUARD is a frequency, because a guard broken for thirty meetings is a')
  console.log('third target. The count of three is the opening screen, and it decays by')
  console.log('identity: a deep gap implies fast measured growth while it closes.')
  console.log('')
}

main()
