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
import { MAX_SCORE } from '../config/scoring.ts'
import { calculateScore } from '../scoring/calculateScore.ts'
import { evaluateEndConditions } from '../scoring/endConditions.ts'
import { HOLD, testConfig } from '../testing/harness.ts'
import { EVENT_CATALOG } from './catalog.ts'
import { applyMemberShocks } from './memberShocks.ts'
import { buildEventContext, scaleEffects } from './resolveEvent.ts'

/**
 * No decoration.
 *
 * Every entry in the catalog must change either what a competent committee
 * would put on the table, or what that committee is judged on. An event that
 * does neither is worse than no event: it teaches the player that headlines
 * are noise, which is the opposite of the habit this game is trying to build,
 * and it costs them the attention they should have spent on the ones that
 * matter.
 *
 * The *second* criterion was added for the currency-area events, and the
 * reason is worth stating because it is a limitation of the first rather than
 * a relaxation of the standard. `toolkitRule` is a rate rule with facility
 * rules attached; it reads area-wide inflation, unemployment, stress and
 * spreads. An asymmetric shock that pushes one large member into a slump moves
 * the aggregate very little *by construction* — that is the entire mechanic —
 * so the package it recommends can be unchanged while the area comes visibly
 * apart underneath it. What such an event changes is cohesion, which the ECB's
 * scorecard weights directly. An event that changes what you are judged on is
 * not scenery, and a test that called it scenery would be measuring the
 * benchmark rule's blind spot rather than the event.
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

/**
 * The alternative bar: two percent of the final score.
 *
 * Two hundred points on a ten-thousand-point scale, which is larger than the
 * gap between competent and passive play on several buckets. An event that
 * moves this much has changed the mandate whether or not the benchmark rule
 * noticed.
 */
const MINIMUM_SCORE_SHIFT = 0.02

/**
 * Applies one event's effects to a state, bypassing the draw entirely.
 *
 * Including the asymmetric half. An earlier version of this replayed only
 * `immediate` and `delayed`, so every currency-area event measured as changing
 * literally nothing — which was true of the harness and false of the events.
 * `regional_labour_shock` has no area-wide immediate effects at all, by
 * design: everything it does, it does to one member.
 */
function forceEvent(state: SimulationState, event: GameEvent): SimulationState {
  const difficulty = getDifficulty(state.config.difficulty)
  const ctx = buildEventContext(state)
  const immediate = scaleEffects(event.immediate(ctx), difficulty.eventSeverityScale)
  const asymmetric = applyMemberShocks(
    state.members,
    event.memberEffects?.(ctx) ?? [],
    difficulty.eventSeverityScale,
  )
  const latent = clampLatentState(
    applyEffects(applyEffects(state.latent, asymmetric.aggregate), immediate),
    state.stepIndex,
    [],
  )
  const pending = event.delayed(ctx).map((spec) => ({
    eventId: event.id,
    fireAtStep: state.stepIndex + spec.delaySteps,
    effects: scaleEffects(spec.effects, difficulty.eventSeverityScale),
  }))
  return {
    ...state,
    latent,
    members: asymmetric.members,
    pendingEffects: [...state.pendingEffects, ...pending],
  }
}

/** What a competent committee would do, and what it would be judged on. */
function packagesAfter(
  institution: Institution,
  event: GameEvent | null,
  seed: string,
): { readonly packages: readonly string[]; readonly score: number } {
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

  return {
    packages,
    score: calculateScore(state, evaluateEndConditions(state)).score,
  }
}

interface Consequence {
  /** Meetings, out of `SAMPLE`, where this event changed the package. */
  readonly changed: number
  /** Largest share of the final score this event moved, across seeds. */
  readonly scoreShift: number
}

function consequenceOf(event: GameEvent, institution: Institution): Consequence {
  let changed = 0
  let scoreShift = 0
  for (let index = 0; index < SEEDS; index += 1) {
    const seed = `consequence-${index}`
    const control = packagesAfter(institution, null, seed)
    const treated = packagesAfter(institution, event, seed)
    const shared = Math.min(control.packages.length, treated.packages.length)
    for (let meeting = 0; meeting < shared; meeting += 1) {
      if (control.packages[meeting] !== treated.packages[meeting]) changed += 1
    }
    scoreShift = Math.max(
      scoreShift,
      Math.abs(treated.score - control.score) / MAX_SCORE,
    )
  }
  return { changed, scoreShift }
}

describe('every event changes a decision', () => {
  for (const event of EVENT_CATALOG) {
    it(`${event.id} is not decoration`, () => {
      // Judged on the institution it is written for. The exchange-rate pair
      // carries an explicit euro-area multiplier and a fragmentation channel
      // the Fed does not have, so measuring it on the Fed alone would condemn
      // an event for being correctly smaller where it should be smaller.
      const results = event.institutions.map((institution) =>
        consequenceOf(event, institution),
      )
      const changed = Math.max(...results.map((result) => result.changed))
      const shift = Math.max(...results.map((result) => result.scoreShift))

      const consequential =
        changed / SAMPLE > MINIMUM_SHARE || shift >= MINIMUM_SCORE_SHIFT
      expect(
        consequential,
        `${event.id}: changed ${changed}/${SAMPLE} meetings, ` +
          `moved ${(shift * 100).toFixed(1)} % of the score`,
      ).toBe(true)
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
