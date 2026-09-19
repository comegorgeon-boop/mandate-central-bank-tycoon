// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { ResolvedEventRecord } from '../types/events.ts'
import type { SimulationState } from '../types/state.ts'
import { EXPECTATIONS } from '../config/model.ts'
import { EVENT_CATALOG } from '../events/catalog.ts'
import { createInitialState } from '../engine/initialState.ts'
import { generateObservation } from '../observation/generateObservation.ts'
import { testConfig } from '../testing/harness.ts'
import { applyMemberShocks } from '../events/memberShocks.ts'
import { FILLER } from './filler.ts'
import { buildPressPage, type PressPage } from './pressPage.ts'

/**
 * One page, with a hierarchy.
 *
 * The news used to arrive in three channels that did not rank each other — a
 * banner, a flat wire list, a separate clue line — so a sovereign crisis and a
 * routine release carried the same weight, and the player stopped reading. The
 * properties below are what makes a page a page rather than a list: exactly
 * one lead, the biggest thing in the world holding it, and chaff that is
 * printed but can never take a prominent slot.
 */

function pageAt(
  seed: string,
  overrides: Partial<SimulationState['latent']> = {},
  majorEvent: ResolvedEventRecord | null = null,
  newswire: readonly string[] = [],
): PressPage {
  const base = createInitialState(testConfig('fed', 'medium', seed), {
    openingEvent: false,
    tutorialDamage: false,
  })
  const state: SimulationState = { ...base, latent: { ...base.latent, ...overrides } }
  return buildPressPage({
    state,
    observation: generateObservation(state, {
      meetingIndex: state.meetingIndex,
      newswire,
      clues: [],
    }),
    newswire,
    majorEvent,
  })
}

function recordFor(eventId: string): ResolvedEventRecord {
  const event = EVENT_CATALOG.find((entry) => entry.id === eventId)!
  return {
    eventId: event.id,
    family: event.family,
    meetingIndex: 0,
    title: event.title,
    newswire: event.newswire,
    immediate: [],
    delayedStepDelays: [],
  }
}

describe('the page has a hierarchy', () => {
  it('runs exactly one lead', () => {
    for (let index = 0; index < 8; index += 1) {
      const page = pageAt(`press-${index}`)
      const leads = page.stories.filter((story) => story.prominence === 'lead')
      expect(leads.length, `seed ${index}`).toBeLessThanOrEqual(1)
    }
  })

  it('gives the lead to a major event over anything the data did', () => {
    const page = pageAt('press-lead', {}, recordFor('banking_failure'))
    const lead = page.stories.find((story) => story.prominence === 'lead')
    expect(lead?.headline).toBe(
      EVENT_CATALOG.find((event) => event.id === 'banking_failure')!.title,
    )
  })

  it('leads on the data when nothing has happened', () => {
    const page = pageAt('press-quiet')
    const lead = page.stories.find((story) => story.prominence === 'lead')
    expect(lead).toBeDefined()
    expect(lead!.material).toBe(true)
  })

  it('ranks by weight, so prominence never runs backwards', () => {
    const order = ['lead', 'major', 'minor', 'brief']
    const page = pageAt('press-order', {}, recordFor('supply_rupture'), [
      'A wire line about something else entirely. It has a second sentence.',
    ])
    const material = page.stories.filter((story) => story.material)
    for (let index = 1; index < material.length; index += 1) {
      expect(order.indexOf(material[index].prominence)).toBeGreaterThanOrEqual(
        order.indexOf(material[index - 1].prominence),
      )
      expect(material[index].weight).toBeLessThanOrEqual(material[index - 1].weight)
    }
  })
})

describe('the chaff is chaff', () => {
  it('prints some, and never lets it take a prominent slot', () => {
    const headlines = new Set(FILLER.map((item) => item.headline))
    let seenAny = false
    for (let index = 0; index < 10; index += 1) {
      const page = pageAt(`chaff-${index}`)
      for (const story of page.stories) {
        if (!headlines.has(story.headline)) continue
        seenAny = true
        expect(story.material).toBe(false)
        expect(story.prominence).toBe('brief')
      }
    }
    expect(seenAny).toBe(true)
  })

  it('never invents a measurement', () => {
    // A filler headline quoting a figure would be an indicator invented in
    // prose: unmoored from the model, impossible to act on, and indistinguish-
    // able from a real release at a glance. Everything in the bank describes
    // activity, never a number.
    for (const item of FILLER) {
      expect(item.headline, item.headline).not.toMatch(/\d/)
      expect(item.headline, item.headline).not.toMatch(/ per cent|%|\bbp\b/)
    }
  })
})

describe('the paper is deterministic', () => {
  it('prints the same page twice from the same state', () => {
    const first = pageAt('press-determinism')
    const second = pageAt('press-determinism')
    expect(second).toEqual(first)
  })

  it('prints a different paper on a different seed', () => {
    const a = pageAt('press-seed-a')
    const b = pageAt('press-seed-b')
    expect(JSON.stringify(a.stories)).not.toBe(JSON.stringify(b.stories))
  })
})

describe('an asymmetric event names who it hit', () => {
  // An event that fell on two economies out of six, reported as though it fell
  // on the area, is worse than no report: two thirds of the area did not
  // experience it, and noticing who did is the whole skill the mechanic
  // exercises. The aggregate will barely move — that is by construction — so
  // if the paper does not say, nothing will.
  function ecbPage(eventId: string): PressPage {
    const base = createInitialState(testConfig('ecb', 'medium', 'asymmetric'), {
      openingEvent: false,
      tutorialDamage: false,
    })
    const event = EVENT_CATALOG.find((entry) => entry.id === eventId)!
    const shocks = event.memberEffects?.({
      latent: base.latent,
      members: base.members,
      institution: 'ecb',
      difficulty: 'medium',
      meetingIndex: 0,
      meetingCount: base.config.meetingCount,
      stepIndex: 0,
      occurrences: {},
      lastOccurrence: {},
      unlockedFollowUps: [],
    }) ?? []
    const applied = applyMemberShocks(base.members, shocks, 1)
    const record: ResolvedEventRecord = {
      ...recordFor(eventId),
      members: applied.hit,
    }
    return buildPressPage({
      state: { ...base, members: applied.members },
      observation: generateObservation(base, {
        meetingIndex: 0,
        newswire: [record.newswire],
        clues: [],
      }),
      newswire: [record.newswire],
      majorEvent: null,
      minorEvents: [record],
    })
  }

  it('names the member a sovereign repricing found, and its share', () => {
    const page = ecbPage('sovereign_repricing')
    const text = page.stories.map((story) => story.standfirst ?? '').join(' ')
    // Resolved by structure: the most indebted member, which is Italy.
    expect(text).toContain('Italy')
    expect(text).toMatch(/% of the area/)
  })

  it('names both members a two-country shock found', () => {
    const page = ecbPage('gas_supply_interruption')
    const text = page.stories.map((story) => story.standfirst ?? '').join(' ')
    expect(text).toMatch(/ and /)
    expect(text).toMatch(/% of the area/)
  })

  it('says nothing about members for an area-wide event', () => {
    const page = pageAt('press-symmetric', {}, null, [
      'An area-wide story with no member effects at all. It has a second sentence.',
    ])
    const text = page.stories.map((story) => story.standfirst ?? '').join(' ')
    expect(text).not.toMatch(/% of the area/)
  })
})

describe('the bank is a subject, not only a reader', () => {
  it('reports a threat to the institution when there is one', () => {
    // The visible half of `anchoringIndependence`. The mechanic exists because
    // political pressure had no reader; a mechanic the player cannot see is
    // one they will report as absent, which is exactly what happened before.
    const quiet = pageAt('press-institution', { politicalPressure: 25 })
    const besieged = pageAt('press-institution', {
      politicalPressure: EXPECTATIONS.independenceTolerance + 30,
    })

    const has = (page: PressPage): boolean =>
      page.stories.some((story) => story.id === 'institution-independence')

    expect(has(quiet)).toBe(false)
    expect(has(besieged)).toBe(true)
  })

  it('reads nothing into the ordinary criticism of doing the job', () => {
    const working = pageAt('press-institution', {
      politicalPressure: EXPECTATIONS.independenceTolerance - 10,
    })
    expect(
      working.stories.some((story) => story.id === 'institution-independence'),
    ).toBe(false)
  })
})
