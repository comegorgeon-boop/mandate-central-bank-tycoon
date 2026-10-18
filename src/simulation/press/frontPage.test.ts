// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Institution } from '../types/core.ts'
import type { ObservationSet } from '../types/observation.ts'
import { MEMBERS } from '../config/members.ts'
import { getInstitution } from '../config/institutions.ts'
import { createInitialState } from '../engine/initialState.ts'
import { generateObservation } from '../observation/generateObservation.ts'
import { advanceTrueState } from '../engine/advanceTrueState.ts'
import { applyPolicyPackage } from '../engine/applyPolicyPackage.ts'
import { HOLD as HOLD_PACKAGE, testConfig } from '../testing/harness.ts'
import { decisionFrontPages, type DecisionSummary } from './frontPage.ts'

/**
 * Papers with a view, arguing from figures the reader can check.
 *
 * The point of several mastheads is the disagreement: a decision that reads as
 * obviously correct from the area's aggregate reads as a betrayal from inside
 * the member already in the worst recession in the union, and the difficulty
 * of the job is that both readings are fair.
 *
 * Two things have to hold for that to be worth printing rather than merely
 * decorative. Each paper's line must follow from *its own numbers* — swap two
 * members' figures and the two papers swap lines — and the numbers it is
 * arguing from must be printed underneath it. A paper whose editorial line
 * came from anywhere else would be characterising a country, which this build
 * does not do.
 *
 * The first version of the copy failed the first test in a way worth recording:
 * it told a hostile member that the committee had moved "for an inflation rate
 * this economy does not have", when the member in question had inflation a
 * point and a half *above* the area's and unemployment so much worse that
 * easing still won its argument. A template that denies half of a comparison
 * gets the interesting case backwards.
 */

/**
 * A few meetings in, deliberately.
 *
 * At meeting zero no national statistic has been published — they carry the
 * same lag as the area's — so every member's figures are null and no paper has
 * anything to argue from. That is correct behaviour and the wrong fixture:
 * what is being tested here is what the papers do once they can read.
 */
function observationFor(institution: Institution, seed: string): ObservationSet {
  let state = createInitialState(testConfig(institution, 'medium', seed), {
    openingEvent: false,
    tutorialDamage: false,
  })
  for (let meeting = 0; meeting < 4; meeting += 1) {
    const applied = applyPolicyPackage(state, HOLD_PACKAGE)
    if (!applied.ok) break
    state = advanceTrueState(applied.state)
  }
  return generateObservation(state, {
    meetingIndex: state.meetingIndex,
    newswire: [],
    clues: [],
  })
}

const RAISE: DecisionSummary = { basisPoints: 50, rate: 3.25, committed: false }
const CUT: DecisionSummary = { basisPoints: -50, rate: 2.25, committed: false }
const HOLD: DecisionSummary = { basisPoints: 0, rate: 2.75, committed: true }

describe('the Fed has one paper and the euro area has several', () => {
  it('prints one page for a single sovereign', () => {
    const pages = decisionFrontPages({
      observation: observationFor('fed', 'front'),
      institution: 'fed',
      decision: RAISE,
    })
    expect(pages).toHaveLength(1)
    expect(pages[0].member).toBeNull()
  })

  it('prints the area and the members that disagree with it', () => {
    const pages = decisionFrontPages({
      observation: observationFor('ecb', 'front'),
      institution: 'ecb',
      decision: RAISE,
    })
    expect(pages.length).toBeGreaterThan(1)
    expect(pages[0].member).toBeNull()
    // Never the residual bloc: it is average by construction and has no
    // separate story to tell.
    expect(pages.some((page) => page.member === 'rest')).toBe(false)
  })

  it('puts the two ends of the argument on the page, not two of the same side', () => {
    // A page of two mastheads agreeing is the area paper printed twice.
    const pages = decisionFrontPages({
      observation: observationFor('ecb', 'front'),
      institution: 'ecb',
      decision: RAISE,
    })
    const national = pages.filter((page) => page.member !== null)
    if (national.length < 2) return
    const stances = new Set(national.map((page) => page.stance))
    expect(stances.size).toBeGreaterThan(1)
  })
})

describe('every paper argues from its own published figures', () => {
  it('prints the numbers it is arguing from', () => {
    const observation = observationFor('ecb', 'front')
    const pages = decisionFrontPages({ observation, institution: 'ecb', decision: RAISE })
    for (const page of pages) {
      if (page.member === null) continue
      const member = observation.area!.members.find((m) => m.id === page.member)!
      expect(page.evidence).toContain(
        MEMBERS.find((profile) => profile.id === page.member)!.name,
      )
      if (member.unemployment !== null) {
        expect(page.evidence).toContain(member.unemployment.toFixed(2))
      }
    }
  })

  it('turns hostile only where the member wanted the opposite', () => {
    const observation = observationFor('ecb', 'front')
    const config = getInstitution('ecb')
    const raise = decisionFrontPages({ observation, institution: 'ecb', decision: RAISE })
    const cut = decisionFrontPages({ observation, institution: 'ecb', decision: CUT })

    for (const page of raise) {
      if (page.member === null || page.stance !== 'hostile') continue
      const member = observation.area!.members.find((m) => m.id === page.member)!
      const wanted =
        (member.inflation ?? config.inflationTarget) - config.inflationTarget -
        ((member.unemployment ?? config.initial.naturalUnemployment) -
          config.initial.naturalUnemployment)
      // Hostile to a tightening means its own numbers argued for easing.
      expect(wanted, page.masthead).toBeLessThan(0)
    }

    // And the same member, on the opposite decision, cannot be hostile too.
    for (const page of cut) {
      if (page.member === null) continue
      const opposite = raise.find((entry) => entry.member === page.member)
      if (opposite === undefined) continue
      expect(
        page.stance === 'hostile' && opposite.stance === 'hostile',
        `${page.masthead} is hostile to both directions`,
      ).toBe(false)
    }
  })

  it('never claims a member lacks a problem it has', () => {
    // The defect the first version shipped with. If a paper's argument is that
    // prices are the issue, the member's inflation must actually be the larger
    // of its two gaps — and vice versa.
    const observation = observationFor('ecb', 'front')
    const config = getInstitution('ecb')
    for (const decision of [RAISE, CUT, HOLD]) {
      const pages = decisionFrontPages({ observation, institution: 'ecb', decision })
      for (const page of pages) {
        if (page.member === null) continue
        const member = observation.area!.members.find((m) => m.id === page.member)!
        const inflationGap =
          (member.inflation ?? config.inflationTarget) - config.inflationTarget
        const unemploymentGap =
          (member.unemployment ?? config.initial.naturalUnemployment) -
          config.initial.naturalUnemployment
        const arguesPrices = page.standfirst.includes('prices here')
        const arguesJobs = page.standfirst.includes('unemployment here')
        if (arguesPrices) {
          expect(inflationGap, page.masthead).toBeGreaterThan(unemploymentGap)
        }
        if (arguesJobs) {
          expect(unemploymentGap, page.masthead).toBeGreaterThanOrEqual(inflationGap)
        }
      }
    }
  })
})

describe('the papers are deterministic and name nobody real', () => {
  it('prints the same pages twice from the same state', () => {
    const observation = observationFor('ecb', 'front')
    expect(
      decisionFrontPages({ observation, institution: 'ecb', decision: RAISE }),
    ).toEqual(decisionFrontPages({ observation, institution: 'ecb', decision: RAISE }))
  })

  it('quotes no one and attributes nothing to an office-holder', () => {
    const observation = observationFor('ecb', 'front')
    for (const decision of [RAISE, CUT, HOLD]) {
      for (const page of decisionFrontPages({
        observation,
        institution: 'ecb',
        decision,
      })) {
        const text = `${page.headline} ${page.standfirst}`
        expect(text, page.masthead).not.toMatch(/["“”]/)
        expect(text, page.masthead).not.toMatch(
          /\b(?:president|governor|chancellor|minister|chair(?:man|woman)?)\b/i,
        )
      }
    }
  })
})
