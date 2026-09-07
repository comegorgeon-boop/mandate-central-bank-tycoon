import type { DifficultyConfig } from '../config/difficulty.ts'
import type { MemberId } from '../config/members.ts'
import type { SimulationState } from '../types/state.ts'
import { MEMBERS } from '../config/members.ts'
import { hashGaussian } from '../rng/prng.ts'
import { getSeries } from './series.ts'

/**
 * National statistics for the members of a currency area.
 *
 * The dispersion is only a problem if the committee can *see* it, and seeing
 * it has to obey the same discipline as everything else the player reads:
 * national price and labour statistics are official statistics, so they arrive
 * with the same publication lag as the area's and carry rather more noise —
 * they are the same measurement taken on a smaller sample, which is a fact
 * about statistics and not a game mechanic. Sovereign spreads are prices, so
 * they are exact and immediate, exactly like every other market series here.
 *
 * That asymmetry is the interesting part. In a fragmentation episode the
 * spreads move first and the national statistics confirm it two meetings
 * later, so a chair who waits for the confirmation is acting a quarter after
 * the market already knew.
 *
 * Noise is drawn from the same stateless hash generators the rest of the
 * observation layer uses, keyed by seed, member, field and period — so adding
 * these readings shifts no other draw in the run and a replay reproduces them
 * exactly.
 */

/**
 * Extra measurement error on a national statistic, as a multiple of the
 * area-wide error on the same series.
 *
 * A national release is the same survey on a smaller sample.
 */
const NATIONAL_NOISE_MULTIPLE = 1.2

export interface MemberObservation {
  readonly id: MemberId
  readonly name: string
  readonly short: string
  /** Definite article for running prose: "in the Netherlands". */
  readonly article: string
  /** Share of area GDP, so the panel can say why a big move barely counted. */
  readonly weight: number
  /** Published national inflation, %. Null when the release has not arrived. */
  readonly inflation: number | null
  readonly unemployment: number | null
  /** Sovereign spread over the area benchmark, bp. Exact: it is a price. */
  readonly spread: number
  /** Percentage points above or below the area's own reading. */
  readonly inflationGap: number | null
  readonly unemploymentGap: number | null
}

export interface AreaObservation {
  readonly members: readonly MemberObservation[]
  /**
   * The area's own published figures, so the panel can put the aggregate on
   * the same row as the members it is the average of.
   *
   * The whole point of the panel is that the number the mandate targets is one
   * no member is actually living, and that only lands if the two are adjacent.
   */
  readonly aggregate: {
    readonly inflation: number | null
    readonly unemployment: number | null
  }
  /**
   * Weighted mean absolute deviation of national inflation from the area's,
   * in percentage points. A real measure and a published one: the ECB watches
   * exactly this.
   */
  readonly inflationDispersion: number
  readonly unemploymentDispersion: number
  /** Widest gap between any two members' inflation, pp. What a headline says. */
  readonly inflationRange: number
  /** The members at the two ends of the inflation distribution. */
  readonly highestInflation: MemberObservation | null
  readonly lowestInflation: MemberObservation | null
  /** The widest sovereign spread in the area, bp. */
  readonly widestSpread: number
}

function noisy(
  value: number,
  seed: string,
  id: MemberId,
  field: string,
  period: number,
  sd: number,
): number {
  return value + hashGaussian(0, sd, seed, 'member', id, field, period)
}

/**
 * Reads the members as published.
 *
 * Returns null outside a currency area, which is the honest answer rather
 * than an empty structure: the Fed does not have members, and a panel that
 * rendered "dispersion: 0.00" for it would be describing something that does
 * not exist.
 */
export function observeMembers(
  state: SimulationState,
  difficulty: DifficultyConfig,
  seed: string,
): AreaObservation | null {
  if (state.members.length === 0) return null

  const inflationSeries = getSeries('headline_inflation')
  const unemploymentSeries = getSeries('unemployment')
  if (inflationSeries === undefined || unemploymentSeries === undefined) return null

  // National statistics share the area's publication lag: the area's figure is
  // built from them, so it cannot be earlier than they are — including the
  // relief the learning mandate grants, for the same reason.
  const lag = Math.max(
    0,
    inflationSeries.publicationLagMeetings - difficulty.publicationLagRelief,
  )
  const period = state.meetingIndex - lag
  const snapshot = period >= 0 ? state.history[period] : undefined
  const latest = state.history[state.history.length - 1]

  const inflationSd =
    inflationSeries.baseNoiseSd *
    difficulty.observationNoiseScale *
    NATIONAL_NOISE_MULTIPLE
  const unemploymentSd =
    unemploymentSeries.baseNoiseSd *
    difficulty.observationNoiseScale *
    NATIONAL_NOISE_MULTIPLE

  const profiles = new Map(MEMBERS.map((member) => [member.id, member]))
  const areaInflation =
    snapshot === undefined ? null : snapshot.latent.inflationHeadline
  const areaUnemployment =
    snapshot === undefined ? null : snapshot.latent.unemployment

  const members: MemberObservation[] = []
  for (const member of state.members) {
    const profile = profiles.get(member.id)
    if (profile === undefined) continue

    const past = snapshot?.members.find((entry) => entry.id === member.id)
    const inflation =
      snapshot === undefined || past === undefined || areaInflation === null
        ? null
        : noisy(
            areaInflation + past.inflationOffset,
            seed,
            member.id,
            'inflation',
            period,
            inflationSd,
          )
    const unemployment =
      snapshot === undefined || past === undefined || areaUnemployment === null
        ? null
        : Math.max(
            0.2,
            noisy(
              areaUnemployment + past.unemploymentOffset,
              seed,
              member.id,
              'unemployment',
              period,
              unemploymentSd,
            ),
          )

    // The spread is read from the *current* state, not the lagged snapshot:
    // it is a price, and a price is known the moment it is quoted.
    const live = latest?.members.find((entry) => entry.id === member.id) ?? member

    members.push({
      id: member.id,
      name: profile.name,
      short: profile.short,
      article: profile.article,
      weight: profile.weight,
      inflation: inflation === null ? null : round(inflation, 2),
      unemployment: unemployment === null ? null : round(unemployment, 2),
      spread: Math.round(live.spread),
      inflationGap:
        inflation === null || areaInflation === null
          ? null
          : round(inflation - areaInflation, 2),
      unemploymentGap:
        unemployment === null || areaUnemployment === null
          ? null
          : round(unemployment - areaUnemployment, 2),
    })
  }

  const withInflation = members.filter(
    (member): member is MemberObservation & { inflation: number } =>
      member.inflation !== null,
  )
  const withUnemployment = members.filter(
    (member): member is MemberObservation & { unemployment: number } =>
      member.unemployment !== null,
  )

  const dispersionOf = (
    entries: readonly MemberObservation[],
    read: (member: MemberObservation) => number | null,
  ): number => {
    let total = 0
    for (const member of entries) {
      const gap = read(member)
      if (gap !== null) total += member.weight * Math.abs(gap)
    }
    return round(total, 2)
  }

  const sorted = [...withInflation].sort((a, b) => b.inflation - a.inflation)

  return {
    members,
    aggregate: {
      inflation:
        areaInflation === null ? null : round(areaInflation, 2),
      unemployment:
        areaUnemployment === null ? null : round(areaUnemployment, 2),
    },
    inflationDispersion: dispersionOf(withInflation, (m) => m.inflationGap),
    unemploymentDispersion: dispersionOf(withUnemployment, (m) => m.unemploymentGap),
    inflationRange:
      sorted.length < 2
        ? 0
        : round(sorted[0].inflation - sorted[sorted.length - 1].inflation, 2),
    highestInflation: sorted[0] ?? null,
    lowestInflation: sorted[sorted.length - 1] ?? null,
    widestSpread: members.reduce(
      (widest, member) => Math.max(widest, member.spread),
      0,
    ),
  }
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}
