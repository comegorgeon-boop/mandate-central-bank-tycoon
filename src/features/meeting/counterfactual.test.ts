// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  SIMULATION_VERSION,
  advanceArm,
  attribute,
  createRunConfig,
  getInstitution,
  startRun,
  submitMeeting,
  withoutGroup,
  type FrozenSet,
  type PolicyPackage,
  type RunSession,
  type SimulationState,
} from '../../simulation/index.ts'
import { regimeObjective } from './objective.ts'
import { closingLine } from './mascotLine.ts'
import { counterfactualLine } from './counterfactualLine.ts'

/**
 * No line may tell the player their instrument does nothing.
 *
 * The complaint, on seed `8RAW-LUHT`: *"the game tells me I can do nothing
 * about inflation and that I would do better to change objective. I raise
 * rates, inflation falls. It confuses 'you cannot reach the target' with 'your
 * action has no effect'. The first may be true, the second is false."*
 *
 * They were right, and the engine can settle it. Replayed with the rate frozen
 * and every shock applied verbatim, inflation under their tightening ran below
 * the frozen path from meeting 3 and the gap widened monotonically to 0.29
 * percentage points. The copy was wrong for sixteen meetings.
 *
 * So this test does what the invented-names test does for labels: it confronts
 * a *claim* with what the engine actually delivers. Any player-facing line
 * asserting a null effect is generated in a state where the counterfactual is
 * computed, and fails if the counterfactual finds one.
 */

/** Phrases that assert the instrument is inert, as opposed to the target being out of reach. */
const CLAIMS_NO_EFFECT = [
  /no instrument[^.]*reaches/i,
  /no rate[^.]*would have removed/i,
  /nothing (?:you|the desk) can do/i,
  /your (?:action|decisions?)[^.]*(?:no|without) effect/i,
  /cannot be (?:affected|reached) by (?:any )?policy/i,
]

const ARMS: readonly FrozenSet[] = ['everything', 'policy_rate']

/**
 * Plays a mandate, carrying the counterfactual arms alongside it.
 *
 * The same lockstep the interface runs: each arm advanced one meeting with the
 * real run's own events applied verbatim, so the only difference between the
 * paths is the package.
 */
function playWithArms(
  seed: string,
  meetings: number,
  choose: (session: RunSession) => PolicyPackage,
) {
  const config = createRunConfig({
    institution: 'ecb',
    difficulty: 'medium',
    seed,
    simulationVersion: SIMULATION_VERSION,
  })
  let session = startRun(config)
  let arms: Partial<Record<FrozenSet, SimulationState>> = Object.fromEntries(
    ARMS.map((frozen) => [frozen, session.state]),
  )

  const path: { readonly actual: number; readonly frozen: number }[] = []

  for (let meeting = 0; meeting < meetings; meeting += 1) {
    if (session.outcome.status !== 'active') break
    const before = session
    const pkg = choose(session)
    const result = submitMeeting(session, pkg)
    if (!result.ok) break
    session = result.session

    const events = session.state.eventLog.filter(
      (record) => record.meetingIndex === before.state.meetingIndex,
    )
    const next: Partial<Record<FrozenSet, SimulationState>> = {}
    for (const frozen of ARMS) {
      next[frozen] = advanceArm(arms[frozen]!, withoutGroup(pkg, frozen), events)
    }
    arms = next

    path.push({
      actual: session.state.latent.inflationHeadline,
      frozen: arms.everything!.latent.inflationHeadline,
    })
  }

  return { session, arms, path }
}

/** Tightens steadily, which is what the player did. */
const TIGHTEN = (): PolicyPackage => ({
  actions: [{ instrument: 'policy_rate', magnitude: 25 }],
  communication: null,
})

describe('the counterfactual is exact, not an estimate', () => {
  it('reproduces the run when nothing is frozen', () => {
    // An arm handed the *whole* package and the same events must land exactly
    // where the real run did. If this drifts, every difference measured
    // against it is measuring the replay rather than the policy.
    const config = createRunConfig({
      institution: 'ecb',
      difficulty: 'medium',
      seed: '8RAW-LUHT',
      simulationVersion: SIMULATION_VERSION,
    })
    let session = startRun(config)
    let mirror: SimulationState = session.state

    for (let meeting = 0; meeting < 8; meeting += 1) {
      const before = session
      const pkg = TIGHTEN()
      const result = submitMeeting(session, pkg)
      if (!result.ok) break
      session = result.session
      const events = session.state.eventLog.filter(
        (record) => record.meetingIndex === before.state.meetingIndex,
      )
      mirror = advanceArm(mirror, pkg, events)

      expect(mirror.latent.inflationHeadline, `meeting ${meeting}`).toBeCloseTo(
        session.state.latent.inflationHeadline,
        9,
      )
      expect(mirror.latent.unemployment, `meeting ${meeting}`).toBeCloseTo(
        session.state.latent.unemployment,
        9,
      )
    }
  })

  it('holds the frozen arm at no policy at all', () => {
    const { arms } = playWithArms('8RAW-LUHT', 6, TIGHTEN)
    const opening = startRun(
      createRunConfig({
        institution: 'ecb',
        difficulty: 'medium',
        seed: '8RAW-LUHT',
        simulationVersion: SIMULATION_VERSION,
      }),
    ).state.stance.targetRate
    expect(arms.everything!.stance.targetRate).toBeCloseTo(opening, 9)
  })
})

describe('on the seed that prompted this, tightening works', () => {
  it('holds inflation below the path it would otherwise have taken', () => {
    const { path } = playWithArms('8RAW-LUHT', 12, TIGHTEN)
    const arrived = path.filter((step) => step.actual < step.frozen)
    // Not a coin flip: once the lag has run, every meeting is below.
    expect(arrived.length).toBeGreaterThan(path.length / 2)
    const last = path[path.length - 1]
    expect(last.frozen - last.actual).toBeGreaterThan(0.1)
  })

  it('widens the gap as the lag runs, rather than oscillating', () => {
    const { path } = playWithArms('8RAW-LUHT', 12, TIGHTEN)
    const gaps = path.map((step) => step.frozen - step.actual)
    // The effect builds. A policy whose contribution wandered around zero
    // would be indistinguishable from noise, and the line would be lying.
    expect(gaps[gaps.length - 1]).toBeGreaterThan(gaps[2])
  })
})

describe('no line claims a null effect where the engine finds one', () => {
  it('never says the instrument is inert', () => {
    // Every player-facing line generated in the state that used to produce the
    // false claim: a cost-push regime with the wedge wide open.
    const { session, arms } = playWithArms('8RAW-LUHT', 6, TIGHTEN)
    const target = getInstitution('ecb').inflationTarget

    const lines = [
      regimeObjective(session.observation, target).goal,
      regimeObjective(session.observation, target).reason,
      closingLine({
        completed: true,
        score: 5000,
        maxScore: 10000,
        conductGate: 1,
        supplyRegimeShare: 0.8,
      }),
      counterfactualLine(
        attribute(session.state, arms, ['headline_inflation', 'unemployment']),
        session.state.meetingIndex,
      )?.detail ?? '',
    ]

    const delivered = attribute(session.state, arms, ['headline_inflation'])[0]
    const effect = Math.abs(delivered?.total ?? 0)

    for (const line of lines) {
      for (const claim of CLAIMS_NO_EFFECT) {
        expect(
          claim.test(line),
          `line claims a null effect while the engine delivers ${effect.toFixed(3)} pp: "${line.slice(0, 90)}"`,
        ).toBe(false)
      }
    }
  })

  it('and the engine does find one, so the test has something to catch', () => {
    // A guard on the guard. If the counterfactual ever returned zero here the
    // test above would pass vacuously, which is the failure mode of every
    // assertion written as "never says X".
    const { session, arms } = playWithArms('8RAW-LUHT', 8, TIGHTEN)
    const delivered = attribute(session.state, arms, ['headline_inflation'])[0]
    expect(Math.abs(delivered.total)).toBeGreaterThan(0.05)
  })
})

describe('the line says what happened, and what has not yet', () => {
  it('reports the lag honestly before anything has arrived', () => {
    const { session, arms } = playWithArms('8RAW-LUHT', 1, TIGHTEN)
    const line = counterfactualLine(
      attribute(session.state, arms, ['headline_inflation', 'unemployment']),
      session.state.meetingIndex,
    )
    expect(line?.arrived).toBe(false)
    expect(line?.detail).toMatch(/lag/)
  })

  it('names the lever once the policy has delivered', () => {
    const { session, arms } = playWithArms('8RAW-LUHT', 10, TIGHTEN)
    const line = counterfactualLine(
      attribute(session.state, arms, ['headline_inflation', 'unemployment']),
      session.state.meetingIndex,
    )
    expect(line?.arrived).toBe(true)
    expect(line?.detail).toMatch(/exactly what your decisions have delivered/)
  })
})
