// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Institution } from '../types/core.ts'
import type { GameEvent } from '../types/events.ts'
import type { SimulationState } from '../types/state.ts'
import { clampLatentState } from '../config/bounds.ts'
import { getDifficulty } from '../config/difficulty.ts'
import { applyEffects } from '../engine/advanceTrueState.ts'
import { advanceTrueState } from '../engine/advanceTrueState.ts'
import { applyPolicyPackage } from '../engine/applyPolicyPackage.ts'
import { createInitialState } from '../engine/initialState.ts'
import { generateObservation } from '../observation/generateObservation.ts'
import { toolkitPackage } from '../policy/toolkitRule.ts'
import { HOLD, testConfig } from '../testing/harness.ts'
import { EVENT_CATALOG } from './catalog.ts'
import { buildEventContext, scaleEffects } from './resolveEvent.ts'

/**
 * No decoration.
 *
 * Every entry in the catalog must change what a competent committee would put
 * on the table. An event that only prints a headline is worse than no event:
 * it teaches the player that headlines are noise, which is the opposite of the
 * habit this game is trying to build, and it costs them the attention they
 * should have spent on the ones that matter.
 *
 * How it is measured: fire the event by hand at meeting three of a run with
 * **no other draws at all**, and compare the whole package `toolkitRule` would
 * choose at each of the next twelve meetings against the same run without it.
 * Events must be off in both arms or the comparison is worthless — the event
 * draw depends on the state, so the moment the forced event moves anything the
 * two runs start drawing *different* later events, and what gets measured is
 * downstream chaos rather than the event under test. An earlier version of
 * this measurement left them on and reported every event as consequential,
 * including one that changes nothing at all.
 *
 * The *whole package*, not the rate: a banking failure is answered with a
 * liquidity facility and not with a basis point, and a rule that only reports
 * a rate move cannot see that the committee did anything. Read on the rate
 * alone, `bank_funding_scare` scores zero and `banking_failure` — which shifts
 * banking stress by nearly 60 points — scores 9 out of 120.
 *
 * This test found two genuine failures, both since rebuilt:
 *
 *   - `communication_leak` changed **nothing, ever**, across every seed and
 *     every meeting. It moved credibility by 4 and volatility by 6, which the
 *     dynamics absorb inside a quarter.
 *   - `domestic_political_shock` put 45 points into `politicalPressure`, a
 *     variable the entire engine wrote to and never once read. A player
 *     reported, in as many words, that the government losing its majority
 *     seemed to have no economic consequence. It did not.
 */

const FIRE_AT = 3
const HORIZON = 12
const SEEDS = 4
const SAMPLE = SEEDS * HORIZON

/**
 * The bar: one meeting in twelve.
 *
 * Deliberately low, because it is a floor against decoration rather than a
 * target. Most of the catalog clears it several times over — the energy pair
 * and the supply ruptures change the package in five meetings out of six —
 * and the ones that sit near it are the ones that *should*: the exchange-rate
 * pair genuinely is a second-order channel for a large economy, and saying so
 * is more honest than inflating it until it measures well.
 */
const MINIMUM_SHARE = 1 / 12

/** Applies one event's effects to a state, bypassing the draw entirely. */
function forceEvent(state: SimulationState, event: GameEvent): SimulationState {
  const difficulty = getDifficulty(state.config.difficulty)
  const ctx = buildEventContext(state)
  const immediate = scaleEffects(event.immediate(ctx), difficulty.eventSeverityScale)
  const latent = clampLatentState(
    applyEffects(state.latent, immediate),
    state.stepIndex,
    [],
  )
  const pending = event.delayed(ctx).map((spec) => ({
    eventId: event.id,
    fireAtStep: state.stepIndex + spec.delaySteps,
    effects: scaleEffects(spec.effects, difficulty.eventSeverityScale),
  }))
  return { ...state, latent, pendingEffects: [...state.pendingEffects, ...pending] }
}

/** The packages a competent committee would choose, meeting by meeting. */
function packagesAfter(
  institution: Institution,
  event: GameEvent | null,
  seed: string,
): readonly string[] {
  const config = testConfig(institution, 'hard', seed)
  let state = createInitialState(config, {
    openingEvent: false,
    tutorialDamage: false,
  })
  const packages: string[] = []

  for (let meeting = 0; meeting < FIRE_AT + HORIZON; meeting += 1) {
    if (meeting === FIRE_AT && event !== null) state = forceEvent(state, event)
    const applied = applyPolicyPackage(state, HOLD)
    if (!applied.ok) break
    state = advanceTrueState(applied.state)
    if (meeting < FIRE_AT) continue

    const observation = generateObservation(state, {
      meetingIndex: state.meetingIndex,
      newswire: [],
      clues: [],
    })
    // `toolkitPackage` reads only `state` and `observation` off the session.
    const session = { state, observation } as never
    packages.push(
      toolkitPackage(session, institution, 'hard')
        .actions.map((action) => `${action.instrument}:${action.magnitude}`)
        .sort()
        .join('|'),
    )
  }

  return packages
}

/** Meetings, out of `SAMPLE`, where this event changed the package. */
function decisionsChanged(event: GameEvent, institution: Institution): number {
  let changed = 0
  for (let index = 0; index < SEEDS; index += 1) {
    const seed = `consequence-${index}`
    const control = packagesAfter(institution, null, seed)
    const treated = packagesAfter(institution, event, seed)
    const shared = Math.min(control.length, treated.length)
    for (let meeting = 0; meeting < shared; meeting += 1) {
      if (control[meeting] !== treated[meeting]) changed += 1
    }
  }
  return changed
}

describe('every event changes a decision', () => {
  for (const event of EVENT_CATALOG) {
    it(`${event.id} is not decoration`, () => {
      // Judged on the institution it is written for. The exchange-rate pair
      // carries an explicit euro-area multiplier and a fragmentation channel
      // the Fed does not have, so measuring it on the Fed alone would condemn
      // an event for being correctly smaller where it should be smaller.
      const best = Math.max(
        ...event.institutions.map((institution) =>
          decisionsChanged(event, institution),
        ),
      )
      expect(best / SAMPLE, `${event.id}: ${best}/${SAMPLE} meetings`).toBeGreaterThan(
        MINIMUM_SHARE,
      )
    })
  }
})

describe('political pressure is read, not only written', () => {
  // The channel that made `domestic_political_shock` an economic event rather
  // than a headline. Anchoring is the right place for it: an anchor is a
  // belief about what the institution will be *allowed* to do, so a visible
  // threat to its independence weakens it whatever the bank's own record.
  function anchoringAfter(politicalPressure: number): number {
    const base = createInitialState(testConfig('fed', 'medium', 'independence'), {
      openingEvent: false,
      tutorialDamage: false,
    })
    let state: SimulationState = {
      ...base,
      latent: { ...base.latent, politicalPressure },
    }
    for (let meeting = 0; meeting < 4; meeting += 1) {
      const applied = applyPolicyPackage(state, HOLD)
      if (!applied.ok) break
      // Pressure is held, standing in for a political crisis that does not
      // resolve itself while the committee waits.
      state = advanceTrueState(applied.state)
      state = { ...state, latent: { ...state.latent, politicalPressure } }
    }
    return state.latent.anchoring
  }

  it('erodes the anchor when independence is visibly threatened', () => {
    expect(anchoringAfter(85)).toBeLessThan(anchoringAfter(25))
  })

  it('reads nothing into the ordinary criticism every central bank faces', () => {
    // Doing the job attracts pressure — 22 at base, about 40 while tightening
    // into an overshoot. None of that is a threat to independence, and an
    // engine that treated it as one would punish the player for the political
    // cost of being right.
    expect(anchoringAfter(45)).toBeCloseTo(anchoringAfter(25), 6)
  })
})
