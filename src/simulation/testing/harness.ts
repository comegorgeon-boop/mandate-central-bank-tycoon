import type { Difficulty, Institution, RunConfig } from '../types/core.ts'
import type { PolicyPackage } from '../types/policy.ts'
import type { LatentState, SimulationState } from '../types/state.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { advanceTrueState } from '../engine/advanceTrueState.ts'
import { applyPolicyPackage } from '../engine/applyPolicyPackage.ts'
import { createInitialState, createRunConfig } from '../engine/initialState.ts'

/**
 * Shared helpers for the simulation test suite.
 *
 * Not imported by application code and not part of the shipped bundle.
 *
 * The important helper here is `playWithoutEvents`. Every sub-step consumes a
 * fixed number of random draws regardless of what the player did, so two runs
 * that share a seed and skip event resolution see *identical* shock
 * sequences. Differencing a treatment run against a control run therefore
 * isolates the effect of policy exactly, with no noise left over — which is
 * what makes the lag and shock-response tests sharp rather than statistical.
 */

/** A meeting at which the committee changes nothing and says nothing. */
export const HOLD: PolicyPackage = { actions: [], communication: null }

export function testConfig(
  institution: Institution,
  difficulty: Difficulty,
  seed: string,
): RunConfig {
  return createRunConfig({
    institution,
    difficulty,
    seed,
    simulationVersion: SIMULATION_VERSION,
  })
}

/** A package that moves the policy rate by `basisPoints` and nothing else. */
export function rateMove(basisPoints: number): PolicyPackage {
  return {
    actions: [{ instrument: 'policy_rate', magnitude: basisPoints }],
    communication: null,
  }
}

/** `count` consecutive meetings of holding. */
export function holds(count: number): PolicyPackage[] {
  return Array.from({ length: count }, () => HOLD)
}

/**
 * Plays a scripted sequence of meetings with procedural events switched off.
 *
 * Deliberately bypasses `submitMeeting`: event selection depends on the state,
 * so leaving events on would let a treatment run and its control diverge for
 * reasons unrelated to the mechanism under test.
 */
export function playWithoutEvents(
  config: RunConfig,
  packages: readonly PolicyPackage[],
  seedState?: (latent: LatentState) => LatentState,
): SimulationState {
  const initial = createInitialState(config)
  let state = seedState
    ? {
        ...initial,
        latent: seedState(initial.latent),
        history: [
          {
            meetingIndex: 0,
            timeYears: 0,
            latent: seedState(initial.latent),
          },
        ],
      }
    : initial

  for (const pkg of packages) {
    const applied = applyPolicyPackage(state, pkg)
    if (!applied.ok) {
      throw new Error(
        `Test package rejected at meeting ${state.meetingIndex}: ` +
          applied.validation.rejections.map((r) => r.message).join(' '),
      )
    }
    state = advanceTrueState(applied.state)
  }

  return state
}

/** The latent value of one field at each meeting of a finished run. */
export function pathOf(
  state: SimulationState,
  field: keyof LatentState,
): number[] {
  return state.history.map((snapshot) => snapshot.latent[field])
}

/** Element-wise difference between a treatment path and its control. */
export function difference(
  treatment: readonly number[],
  control: readonly number[],
): number[] {
  return treatment.map((value, index) => value - control[index])
}
