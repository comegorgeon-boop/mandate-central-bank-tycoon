// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { MemberId } from '../config/members.ts'
import type { MemberLatent, SimulationState } from '../types/state.ts'
import { MEMBERS, MEMBER_DYNAMICS } from '../config/members.ts'
import { HOLD, testConfig } from '../testing/harness.ts'
import { advanceTrueState } from './advanceTrueState.ts'
import { applyPolicyPackage } from './applyPolicyPackage.ts'
import { createInitialState } from './initialState.ts'
import {
  advanceMembers,
  createMembers,
  dispersion,
  memberLevel,
  memberTransmission,
  shockMember,
} from './members.ts'

/**
 * The aggregate is the weighted mean of the members, always.
 *
 * This is the load-bearing property of the whole design. Members are carried
 * as *offsets* from the area's own figures, with the weighted mean of each
 * offset held at zero, which is what lets the area-wide economy stay
 * bit-for-bit the calibrated engine it was while a second dimension is added
 * underneath it. If the invariant slips, the dispersion panel and the
 * aggregate the mandate targets are describing two different economies and
 * nothing in the interface would say so.
 */

function weightedMean(
  members: readonly MemberLatent[],
  read: (member: MemberLatent) => number,
): number {
  const weights = new Map(MEMBERS.map((member) => [member.id, member.weight]))
  return members.reduce(
    (sum, member) => sum + (weights.get(member.id) ?? 0) * read(member),
    0,
  )
}

function ecb(seed = 'members'): SimulationState {
  return createInitialState(testConfig('ecb', 'medium', seed), {
    openingEvent: false,
    tutorialDamage: false,
  })
}

describe('the area is made of its members', () => {
  it('gives the euro area members and the Fed none', () => {
    expect(createMembers('ecb')).toHaveLength(MEMBERS.length)
    // The Fed has regions, not members with their own sovereign borrowing
    // costs, and that difference is the entire point of this file.
    expect(createMembers('fed')).toHaveLength(0)
  })

  it('opens with the weighted mean of every offset at zero', () => {
    // The config states the dispersion it *intends* and `createMembers` makes
    // it exact. Hand-rounding six numbers until they sum to zero is a
    // maintenance trap that fails silently the first time one is retuned.
    const members = createMembers('ecb')
    for (const field of [
      'inflationOffset',
      'outputGapOffset',
      'unemploymentOffset',
    ] as const) {
      expect(weightedMean(members, (m) => m[field]), field).toBeCloseTo(0, 9)
    }
  })

  it('opens with a dispersion wide enough for one rate to be a problem', () => {
    // If the members opened on top of each other the single-rate difficulty
    // would not exist until an event created it, and a mandate that drew no
    // asymmetric event would never meet the mechanic at all.
    const members = createMembers('ecb')
    const inflations = members.map((member) => member.inflationOffset)
    expect(Math.max(...inflations) - Math.min(...inflations)).toBeGreaterThan(1.5)
  })

  it('holds the invariant through a whole mandate', () => {
    let state = ecb()
    for (let meeting = 0; meeting < 20; meeting += 1) {
      const applied = applyPolicyPackage(state, HOLD)
      if (!applied.ok) break
      state = advanceTrueState(applied.state)
      for (const field of [
        'inflationOffset',
        'outputGapOffset',
        'unemploymentOffset',
      ] as const) {
        expect(
          weightedMean(state.members, (m) => m[field]),
          `${field} at meeting ${meeting}`,
        ).toBeCloseTo(0, 6)
      }
    }
  })

  it('reads a member level as the aggregate plus its own offset', () => {
    const state = ecb()
    const germany = state.members.find((member) => member.id === 'de')!
    expect(memberLevel(germany, state.latent, 'inflation')).toBeCloseTo(
      state.latent.inflationHeadline + germany.inflationOffset,
      9,
    )
  })
})

describe('a shock to one member barely moves the aggregate', () => {
  // The brief's requirement, and it is arithmetic rather than a coefficient:
  // there is no way to write `shockMember` that does not do this.
  it('moves the area by exactly that member`s weight', () => {
    const members = createMembers('ecb')
    const italy = MEMBERS.find((member) => member.id === 'it')!
    const result = shockMember(members, 'it', 'inflationOffset', 2)

    expect(result.aggregate).toBeCloseTo(italy.weight * 2, 9)
    // Fourteen per cent of the area, so 2 points of Italian inflation is 0.28
    // of the area's. A committee reading only the aggregate sees almost
    // nothing; that is the mechanic, not a shortcoming of it.
    expect(result.aggregate).toBeLessThan(0.3)
  })

  it('leaves every other member`s level untouched', () => {
    const members = createMembers('ecb')
    const before = ecb().latent
    const result = shockMember(members, 'it', 'inflationOffset', 2)
    const after = { ...before, inflationHeadline: before.inflationHeadline + result.aggregate }

    for (const member of members) {
      const shocked = result.members.find((entry) => entry.id === member.id)!
      const was = memberLevel(member, before, 'inflation')
      const is = memberLevel(shocked, after, 'inflation')
      if (member.id === 'it') {
        expect(is - was, 'the member hit').toBeCloseTo(2, 9)
      } else {
        expect(is - was, member.id).toBeCloseTo(0, 9)
      }
    }
  })

  it('keeps the invariant after a shock', () => {
    const result = shockMember(createMembers('ecb'), 'es', 'unemploymentOffset', 3)
    expect(
      weightedMean(result.members, (m) => m.unemploymentOffset),
    ).toBeCloseTo(0, 9)
  })

  it('does nothing at an institution with no members', () => {
    const result = shockMember([], 'it', 'inflationOffset', 2)
    expect(result.aggregate).toBe(0)
    expect(result.members).toHaveLength(0)
  })
})

describe('structure decides who feels what', () => {
  it('drives a member at average structure by nothing of its own', () => {
    // Every coefficient is a *differential*: it multiplies the distance from
    // the area average. The residual bloc is average on every loading by
    // construction, so none of its own channels does anything to it.
    //
    // It does still move, for two reasons, and both are the model rather than
    // a leak. Re-centring the weighted mean back to zero shifts everybody when
    // the distinctive members diverge. And `memberTransmission` differs by
    // member, so a common tightening reaches a widely-spread member less than
    // a tightly-spread one and the differentials no longer cancel exactly —
    // which is the fragmentation mechanic doing its job, not a rounding error.
    //
    // What must hold is that the residual moves several times less than a
    // member with real structure behind it. Writing this test is what found
    // the *spurious* part of that drift: the structural loadings are
    // documented as averaging to one and did not, so an evenly-distributed
    // shock left a residue the renormalisation handed to everybody. See
    // `LOADINGS` in `engine/members.ts`.
    const state = ecb()
    let members = state.members.map((member) => ({
      ...member,
      inflationOffset: 0,
      outputGapOffset: 0,
      unemploymentOffset: 0,
    }))
    for (let step = 0; step < 40; step += 1) {
      members = [...advanceMembers(members, state.latent, 1.5, 1 / 32)]
    }
    const rest = members.find((member) => member.id === 'rest')!
    const germany = members.find((member) => member.id === 'de')!
    const spain = members.find((member) => member.id === 'es')!

    expect(Math.abs(rest.outputGapOffset)).toBeLessThan(
      Math.abs(germany.outputGapOffset) / 3,
    )
    expect(Math.abs(rest.unemploymentOffset)).toBeLessThan(
      Math.abs(spain.unemploymentOffset) / 3,
    )
  })

  it('costs the most cyclical labour market the most jobs when policy tightens', () => {
    const state = ecb()
    let members = state.members.map((member) => ({
      ...member,
      inflationOffset: 0,
      outputGapOffset: 0,
      unemploymentOffset: 0,
    }))
    for (let step = 0; step < 32; step += 1) {
      members = [...advanceMembers(members, state.latent, 2, 1 / 32)]
    }
    const spain = members.find((member) => member.id === 'es')!
    const germany = members.find((member) => member.id === 'de')!
    // Spain's labour sensitivity is the highest in the area and Germany's the
    // lowest, so the same tightening opens a gap between them.
    expect(spain.unemploymentOffset).toBeGreaterThan(germany.unemploymentOffset)
  })

  it('widens the indebted member`s spread when the area fragments', () => {
    const state = ecb()
    const calm = { ...state.latent, fragmentation: 20 }
    const stressed = { ...state.latent, fragmentation: 300 }

    const spreadAfter = (latent: typeof calm): Map<MemberId, number> => {
      let members = state.members
      for (let step = 0; step < 32; step += 1) {
        members = advanceMembers(members, latent, 0, 1 / 32)
      }
      return new Map(members.map((member) => [member.id, member.spread]))
    }

    const quiet = spreadAfter(calm)
    const episode = spreadAfter(stressed)
    const widening = (id: MemberId): number => episode.get(id)! - quiet.get(id)!

    // The common factor loads on debt. Italy carries the highest loading in
    // the area and Germany the lowest, which is what makes a fragmentation
    // episode a story about one member rather than about everyone.
    expect(widening('it')).toBeGreaterThan(widening('de') * 2)
  })
})

describe('fragmentation breaks transmission', () => {
  it('reaches a member fully until its spread runs away', () => {
    expect(memberTransmission(0)).toBeCloseTo(1, 9)
    expect(
      memberTransmission(MEMBER_DYNAMICS.transmissionBreakSpread),
    ).toBeCloseTo(1, 9)
  })

  it('loses transmission past the break, and no more than the documented share', () => {
    const doubled = MEMBER_DYNAMICS.transmissionBreakSpread * 2
    expect(memberTransmission(doubled)).toBeCloseTo(
      1 - MEMBER_DYNAMICS.transmissionBreakLoss,
      9,
    )
    // Floored: past the break the committee has lost contact with part of the
    // area, but never all of it — a member whose rate channel went to zero
    // would be outside the currency union in everything but name.
    expect(memberTransmission(doubled * 10)).toBeCloseTo(
      1 - MEMBER_DYNAMICS.transmissionBreakLoss,
      9,
    )
  })
})

describe('dispersion is a fact about the area', () => {
  it('is zero when every member sits on the aggregate', () => {
    const flat = createMembers('ecb').map((member) => ({
      ...member,
      inflationOffset: 0,
    }))
    expect(dispersion(flat, 'inflationOffset')).toBeCloseTo(0, 9)
  })

  it('weights a large member`s divergence more than a small one`s', () => {
    const base = createMembers('ecb').map((member) => ({
      ...member,
      inflationOffset: 0,
    }))
    const bigApart = base.map((member) =>
      member.id === 'de' ? { ...member, inflationOffset: 1 } : member,
    )
    const smallApart = base.map((member) =>
      member.id === 'nl' ? { ...member, inflationOffset: 1 } : member,
    )
    expect(dispersion(bigApart, 'inflationOffset')).toBeGreaterThan(
      dispersion(smallApart, 'inflationOffset'),
    )
  })
})
