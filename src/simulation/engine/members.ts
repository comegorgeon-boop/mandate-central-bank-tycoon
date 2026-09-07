import type { Institution } from '../types/core.ts'
import type { LatentState, MemberLatent } from '../types/state.ts'
import { clamp } from '../config/bounds.ts'
import { MEMBERS, MEMBER_DYNAMICS, type MemberId } from '../config/members.ts'
import { FRAGMENTATION } from '../config/model.ts'

/**
 * Member states, as dispersion around the aggregate.
 *
 * The design decision this file is built on: **the area aggregate stays
 * primitive and members carry offsets from it.** Every member's inflation is
 * the area's inflation plus its own offset, and the weighted mean of the
 * offsets is held at zero.
 *
 * The alternative — making members primitive and deriving the aggregate — is
 * more obviously "right" and was rejected. It would mean running the Phillips
 * curve, the IS curve, Okun's law, the expectations block and the lag pipeline
 * six times per sub-step, and every constant in `config/model.ts` is
 * calibrated against the aggregate. The result would be a differently
 * calibrated engine wearing the same numbers, and every measurement in
 * docs/BALANCE.md would be void. The offset form leaves the area-wide economy
 * bit-for-bit what it was and adds a second, orthogonal dimension.
 *
 * It also makes the property the brief asks for *structural* rather than
 * tuned: "a severe shock to one member barely moves the aggregate" is not a
 * coefficient here, it is the arithmetic of `shockMember` below. A shock worth
 * two points of Italian inflation moves the area's by 0.14 × 2, because Italy
 * is 14 % of the area, and there is no way to write it that does not do that.
 *
 * Everything a member does is a **differential**. Each coefficient multiplies
 * the distance between that member's structural loading and the area average,
 * so a member at average on every loading never diverges from the aggregate at
 * all, whatever happens to the area. That is the property that keeps the
 * dispersion from drifting into a second, contradictory economy.
 */

/** Bounds, as elsewhere: safety rails far outside any plausible dispersion. */
const OFFSET_BOUND = 12
const SPREAD_BOUND: readonly [number, number] = [-150, 1500]

/** Opens the area at its configured dispersion, renormalised to sum to zero. */
export function createMembers(institution: Institution): readonly MemberLatent[] {
  if (institution !== 'ecb') return []

  const weightedMean = (read: (id: MemberId) => number): number =>
    MEMBERS.reduce((sum, member) => sum + member.weight * read(member.id), 0)

  const opening = new Map(MEMBERS.map((member) => [member.id, member.opening]))
  // The config states the dispersion it *intends*; this makes it exact. A set
  // of offsets whose weighted mean was not zero would be a second and
  // contradictory statement about the area's own inflation rate, and rounding
  // six hand-written numbers to make it come out is a maintenance trap.
  const inflationMean = weightedMean((id) => opening.get(id)!.inflation)
  const gapMean = weightedMean((id) => opening.get(id)!.outputGap)
  const unemploymentMean = weightedMean((id) => opening.get(id)!.unemployment)

  return MEMBERS.map((member) => ({
    id: member.id,
    inflationOffset: member.opening.inflation - inflationMean,
    outputGapOffset: member.opening.outputGap - gapMean,
    unemploymentOffset: member.opening.unemployment - unemploymentMean,
    // Spreads open at the level the area's opening fragmentation implies for
    // each member's debt, so meeting one already shows the structure rather
    // than a flat row of zeros that fills in over the first year.
    spread: FRAGMENTATION.ecb.base * member.debtLoading,
  }))
}

/** Re-centres offsets so their weighted mean is exactly zero. */
function renormalise(members: readonly MemberLatent[]): readonly MemberLatent[] {
  const byId = new Map(MEMBERS.map((member) => [member.id, member.weight]))
  const weight = (member: MemberLatent): number => byId.get(member.id) ?? 0

  let inflation = 0
  let gap = 0
  let unemployment = 0
  for (const member of members) {
    inflation += weight(member) * member.inflationOffset
    gap += weight(member) * member.outputGapOffset
    unemployment += weight(member) * member.unemploymentOffset
  }

  return members.map((member) => ({
    ...member,
    inflationOffset: clamp(member.inflationOffset - inflation, -OFFSET_BOUND, OFFSET_BOUND),
    outputGapOffset: clamp(member.outputGapOffset - gap, -OFFSET_BOUND, OFFSET_BOUND),
    unemploymentOffset: clamp(
      member.unemploymentOffset - unemployment,
      -OFFSET_BOUND,
      OFFSET_BOUND,
    ),
  }))
}

/**
 * How much of the common policy rate actually reaches a member.
 *
 * Beyond `transmissionBreakSpread` a member's borrowing costs are being set by
 * its own risk premium rather than by the rate the committee voted, and the
 * committee is steering an economy it has partly lost contact with. This is
 * the mechanic the anti-fragmentation instrument exists to repair, and the
 * reason repairing it is worth a political cost.
 */
export function memberTransmission(spread: number): number {
  const excess = Math.max(0, spread - MEMBER_DYNAMICS.transmissionBreakSpread)
  const share = Math.min(1, excess / MEMBER_DYNAMICS.transmissionBreakSpread)
  return 1 - MEMBER_DYNAMICS.transmissionBreakLoss * share
}

/**
 * Advances every member one sub-step.
 *
 * `restriction` is how far policy sits above neutral in real terms, which is
 * the single quantity the whole area shares and every member experiences
 * differently.
 */
export function advanceMembers(
  members: readonly MemberLatent[],
  latent: LatentState,
  restriction: number,
  dt: number,
): readonly MemberLatent[] {
  if (members.length === 0) return members

  const cfg = MEMBER_DYNAMICS
  const byId = new Map(MEMBERS.map((member) => [member.id, member]))

  const next = members.map((member): MemberLatent => {
    const profile = byId.get(member.id)
    if (profile === undefined) return member

    // Differentials. A member at 1.00 on a loading contributes nothing from
    // that channel, whatever the area is doing.
    const labourGap = profile.labourSensitivity - 1
    const industrialGap = profile.industrialWeight - 1
    const energyGap = profile.energyExposure - 1
    const debtGap = profile.debtLoading - 1

    // A member the rate has stopped reaching is *shielded* from tightening in
    // the short run and pays for it through its own borrowing costs instead —
    // which is precisely why fragmentation is a transmission problem and not
    // merely an unfairness.
    const reach = memberTransmission(member.spread)

    const unemploymentDrift =
      cfg.labourTransmission * labourGap * restriction * reach
    const gapDrift = -cfg.industrialTransmission * industrialGap * restriction * reach
    const energyDrift = cfg.energyPassThrough * energyGap * latent.supplyShock
    const localPhillips = cfg.localPhillips * member.outputGapOffset

    const inflationOffset =
      member.inflationOffset +
      (energyDrift + localPhillips - cfg.convergence * member.inflationOffset) * dt
    const outputGapOffset =
      member.outputGapOffset +
      (gapDrift - cfg.convergence * member.outputGapOffset) * dt
    const unemploymentOffset =
      member.unemploymentOffset +
      (unemploymentDrift - cfg.convergence * member.unemploymentOffset) * dt

    // The spread is a level rather than an offset: it is a price, and it is
    // the one member quantity with no reason to average to zero. The area's
    // fragmentation is the common factor and debt is the loading.
    const spreadTarget =
      Math.max(0, latent.fragmentation) * (1 + cfg.spreadLoading * debtGap) +
      cfg.spreadGapSensitivity * Math.max(0, -(latent.outputGap + outputGapOffset))
    const spread =
      member.spread + cfg.spreadAdjustment * (spreadTarget - member.spread) * dt

    return {
      id: member.id,
      inflationOffset,
      outputGapOffset,
      unemploymentOffset,
      spread: clamp(spread, SPREAD_BOUND[0], SPREAD_BOUND[1]),
    }
  })

  return renormalise(next)
}

/**
 * Applies a shock to one member, keeping the aggregate identity exact.
 *
 * The arithmetic that makes "a severe shock to one member barely moves the
 * aggregate" structural rather than tuned. A shock of size `x` to member `i`
 * moves the area by `w_i · x` and leaves every other member's *level*
 * untouched:
 *
 *   level_i  = aggregate + offset_i
 *            = (A + w_i x) + (o_i + (1 − w_i) x)  =  old level + x
 *   level_j  = (A + w_i x) + (o_j − w_i x)        =  old level
 *
 * and the weighted mean of the offsets is unchanged, so the aggregate remains
 * the weighted mean of the members by construction rather than by convention.
 *
 * Returns the aggregate delta for the caller to apply to the latent state; the
 * two halves have to move together or the identity breaks.
 */
export function shockMember(
  members: readonly MemberLatent[],
  target: MemberId,
  field: 'inflationOffset' | 'outputGapOffset' | 'unemploymentOffset',
  magnitude: number,
): { readonly members: readonly MemberLatent[]; readonly aggregate: number } {
  const profile = MEMBERS.find((member) => member.id === target)
  if (profile === undefined || members.length === 0) {
    return { members, aggregate: 0 }
  }

  const weight = profile.weight
  const shifted = members.map((member) => {
    const delta =
      member.id === target ? (1 - weight) * magnitude : -weight * magnitude
    return { ...member, [field]: member[field] + delta } as MemberLatent
  })

  return { members: shifted, aggregate: weight * magnitude }
}

/** A member's own level of a series, aggregate plus its offset. */
export function memberLevel(
  member: MemberLatent,
  latent: LatentState,
  field: 'inflation' | 'outputGap' | 'unemployment',
): number {
  switch (field) {
    case 'inflation':
      return latent.inflationHeadline + member.inflationOffset
    case 'outputGap':
      return latent.outputGap + member.outputGapOffset
    case 'unemployment':
      return Math.max(0.2, latent.unemployment + member.unemploymentOffset)
  }
}

/**
 * How far apart the area is, in percentage points.
 *
 * Weighted mean absolute deviation rather than the max: the gap between the
 * highest and lowest is a fact about two members, while this is a fact about
 * the area, and it is the area's cohesion the mandate is judged on.
 */
export function dispersion(
  members: readonly MemberLatent[],
  field: 'inflationOffset' | 'outputGapOffset' | 'unemploymentOffset',
): number {
  if (members.length === 0) return 0
  const byId = new Map(MEMBERS.map((member) => [member.id, member.weight]))
  return members.reduce(
    (sum, member) => sum + (byId.get(member.id) ?? 0) * Math.abs(member[field]),
    0,
  )
}

/** The widest gap between any two members, which is what a headline quotes. */
export function spread(
  members: readonly MemberLatent[],
  field: 'inflationOffset' | 'outputGapOffset' | 'unemploymentOffset',
): number {
  if (members.length === 0) return 0
  const values = members.map((member) => member[field])
  return Math.max(...values) - Math.min(...values)
}
