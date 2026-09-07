import type { EventEffect, MemberSelector, MemberShock } from '../types/events.ts'
import type { MemberLatent } from '../types/state.ts'
import { MEMBERS, type MemberId, type MemberProfile } from '../config/members.ts'
import { shockMember } from '../engine/members.ts'

/**
 * Shocks that fall on one or two members rather than on the whole area.
 *
 * The mechanic that makes a single policy rate a genuine problem. A common
 * shock has a common answer; an asymmetric one puts the chair in the position
 * of setting one rate for members who need different ones, which is the
 * question the ECB's job actually turns on and which a homogeneous model
 * cannot ask.
 *
 * Two properties are enforced here rather than left to each event's author:
 *
 *   - **The aggregate moves by the member's weight and no more.** A shock
 *     worth two points of Italian inflation moves the area's by 0.28, because
 *     Italy is 14 % of the area. That is not a coefficient, it is
 *     `shockMember`'s arithmetic, and it is why a severe shock to one member
 *     barely registers in the number the committee targets — which is the
 *     brief's requirement and also simply true.
 *   - **Selectors resolve by structure.** An event about sovereign debt finds
 *     the most indebted member; an event about gas finds the most
 *     energy-exposed one. Naming a country to carry a story it has no
 *     structural reason to carry would be characterising it rather than
 *     modelling it, which this build does not do.
 */

/** Resolves a selector against the member profiles. */
function resolve(selector: MemberSelector): MemberProfile | undefined {
  const best = (score: (member: MemberProfile) => number): MemberProfile =>
    MEMBERS.reduce((top, member) => (score(member) > score(top) ? member : top))

  switch (selector) {
    case 'most_indebted':
      return best((member) => member.debtLoading)
    case 'most_industrial':
      return best((member) => member.industrialWeight)
    case 'most_energy_exposed':
      return best((member) => member.energyExposure)
    case 'most_cyclical':
      return best((member) => member.labourSensitivity)
    case 'largest':
      return best((member) => member.weight)
    default:
      return MEMBERS.find((member) => member.id === selector)
  }
}

export interface MemberShockResult {
  readonly members: readonly MemberLatent[]
  /** Area-wide effects the shocks imply, to be applied to the latent state. */
  readonly aggregate: readonly EventEffect[]
  /** Which members were actually hit, for the record and the press. */
  readonly hit: readonly MemberId[]
}

const AGGREGATE_FIELD = {
  inflationOffset: 'inflationHeadline',
  outputGapOffset: 'outputGap',
  unemploymentOffset: 'unemployment',
} as const

export function applyMemberShocks(
  members: readonly MemberLatent[],
  shocks: readonly MemberShock[],
  severityScale: number,
): MemberShockResult {
  if (members.length === 0 || shocks.length === 0) {
    return { members, aggregate: [], hit: [] }
  }

  let current = members
  const aggregate: EventEffect[] = []
  const hit = new Set<MemberId>()

  for (const shock of shocks) {
    const profile = resolve(shock.member)
    if (profile === undefined) continue
    hit.add(profile.id)
    const magnitude = shock.magnitude * severityScale

    if (shock.field === 'spread') {
      // A price, not an offset: it moves alone and there is nothing to
      // renormalise. The area's own fragmentation is a separate variable with
      // its own dynamics, and a member's spread widening does not mechanically
      // widen everyone else's — that is precisely what makes it fragmentation
      // rather than a rise in the common risk premium.
      current = current.map((member) =>
        member.id === profile.id
          ? { ...member, spread: member.spread + magnitude }
          : member,
      )
      continue
    }

    const result = shockMember(current, profile.id, shock.field, magnitude)
    current = result.members
    if (Math.abs(result.aggregate) > 1e-12) {
      aggregate.push({
        variable: AGGREGATE_FIELD[shock.field],
        delta: result.aggregate,
      })
    }
  }

  return { members: current, aggregate, hit: [...hit] }
}
