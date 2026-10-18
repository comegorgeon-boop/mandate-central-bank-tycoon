import type { Institution } from '../types/core.ts'
import type { ObservationSet, SeriesId } from '../types/observation.ts'
import type { ResolvedEventRecord } from '../types/events.ts'
import type { SimulationState } from '../types/state.ts'
import { getInstitution } from '../config/institutions.ts'
import { EXPECTATIONS } from '../config/model.ts'
import { EVENTS_BY_ID, isMajorEvent } from '../events/catalog.ts'
import { revealedDispatches } from '../events/dispatches.ts'
import { MEMBERS_BY_ID, type MemberId } from '../config/members.ts'
import { hashUnit } from '../rng/prng.ts'
import { FILLER } from './filler.ts'

/**
 * The morning paper.
 *
 * A meeting used to arrive with its news scattered across three places that
 * did not know about each other: a banner for the major event, a flat list of
 * minor headlines on the transition screen, and warning clues somewhere else
 * again. Nothing ranked them, so a currency crisis and a routine data release
 * carried the same weight on the page, and by the fifth meeting a player had
 * — in their own words — stopped reading any of it.
 *
 * So this builds one page, hierarchised, with a lead. Everything on it is
 * derived: from events that actually fired, from the published statistics and
 * how far they moved, from the institution's own standing. Every word is a
 * deterministic template filled from the state. No model, no remote call, and
 * the same seed prints the same paper.
 *
 * It reads the **observation set**, never the latent economy, exactly like
 * every other player-facing derivation — a newspaper reports the figures that
 * were published, including the ones that will be revised. The one exception
 * is the event log, which is public by construction: an event is news.
 *
 * ## The noise is deliberate
 *
 * A page on which everything matters teaches nothing, because a player who can
 * safely read all of it never has to learn to *rank*. Some of what follows is
 * filler: plausible, dated, immaterial, and marked `material: false` so the
 * interface can print it small and out of the way. Learning to skip it is the
 * skill. It is capped, it never takes a prominent slot, and it is drawn from a
 * stateless hash so it costs the run no randomness at all.
 */

export type Prominence = 'lead' | 'major' | 'minor' | 'brief'

/** Where a story came from, so the interface can label its section. */
export type PressDesk =
  | 'economy'
  | 'markets'
  | 'institution'
  | 'world'
  | 'business'

export interface PressStory {
  readonly id: string
  readonly prominence: Prominence
  /** The desk it ran on, as a section label. */
  readonly desk: PressDesk
  readonly headline: string
  /** The sentence under the headline. Null for a one-line brief. */
  readonly standfirst: string | null
  /**
   * Whether this bears on the decision at all.
   *
   * False marks the filler. The interface prints it, quietly — a page with no
   * chaff is a page that never teaches anyone to look for the wheat.
   */
  readonly material: boolean
  /** Ranking weight, highest first. Not shown. */
  readonly weight: number
}

export interface PressPage {
  readonly masthead: string
  readonly dateline: string
  readonly stories: readonly PressStory[]
  /** True when nothing material happened at all. */
  readonly quiet: boolean
}

/** The fictional paper of record. Original, like everything else here. */
const MASTHEAD = 'The Meridian Ledger'

/** How many filler items may run, at most. */
const MAX_FILLER = 3

/** Prominence is assigned by rank, not chosen: the page has one lead. */
const SLOTS: readonly { readonly upTo: number; readonly prominence: Prominence }[] = [
  { upTo: 1, prominence: 'lead' },
  { upTo: 3, prominence: 'major' },
  { upTo: 7, prominence: 'minor' },
  { upTo: Infinity, prominence: 'brief' },
]

/** A story before it has been ranked into a slot. */
interface Draft {
  readonly id: string
  readonly desk: PressDesk
  readonly headline: string
  readonly standfirst: string | null
  readonly material: boolean
  readonly weight: number
}

function reading(observation: ObservationSet, id: SeriesId) {
  return observation.indicators[id] ?? null
}

/** "rose 0.4 pp to 2.9 %", in the series' own units. */
function movementPhrase(
  value: number,
  previous: number,
  unit: string,
  decimals: number,
): string {
  const change = value - previous
  const direction = change > 0 ? 'rose' : 'fell'
  const size = Math.abs(change).toFixed(decimals)
  const suffix = unit.startsWith('%') || unit === 'pp' ? 'pp' : 'points'
  return `${direction} ${size} ${suffix} to ${value.toFixed(decimals)}${
    unit.startsWith('%') ? ' %' : ''
  }`
}

/**
 * The data desk: what the statisticians published since the last meeting.
 *
 * Weighted by how far each series moved *relative to its own published error*,
 * so a quarter-point move in a series measured to two decimals outranks a
 * two-point move in one that swings by ten every quarter. That ratio is the
 * whole reason a hierarchy is possible at all: without it, ranking headlines
 * means ranking the units they happen to be quoted in.
 */
function dataStories(
  observation: ObservationSet,
  institution: Institution,
): readonly Draft[] {
  const target = getInstitution(institution).inflationTarget
  const natural = getInstitution(institution).initial.naturalUnemployment
  const drafts: Draft[] = []

  const headline = reading(observation, 'headline_inflation')
  if (headline?.value != null) {
    const gap = headline.value - target
    const move =
      headline.previous == null ? 0 : Math.abs(headline.value - headline.previous)
    // Arriving is news. A paper that leads on every deterioration and reports
    // the recovery as one more line of movement is a paper that only ever
    // tells the player things are going wrong, which is the complaint this
    // whole session began with. Coming back to the objective, after being
    // away from it, is the single best thing that can happen on this page and
    // it now reads like it.
    const arrived =
      Math.abs(gap) <= 0.25 &&
      headline.previous != null &&
      Math.abs(headline.previous - target) > 0.25
    drafts.push({
      id: 'data-inflation',
      desk: 'economy',
      headline: arrived
        ? `Inflation is back at the objective, at ${headline.value.toFixed(2)} %`
        : headline.previous == null
          ? `Consumer prices: inflation stands at ${headline.value.toFixed(2)} %`
          : `Consumer prices: inflation ${movementPhrase(headline.value, headline.previous, headline.unit, 2)}`,
      standfirst: arrived
        ? `The first reading within a quarter-point of ${target.toFixed(1)} % since it went away. Holding it there is a different job from getting it there.`
        : Math.abs(gap) <= 0.25
          ? `That is within a quarter-point of the ${target.toFixed(1)} % objective.`
          : `The objective is ${target.toFixed(1)} %, leaving a gap of ${Math.abs(gap).toFixed(2)} pp ${gap > 0 ? 'above' : 'below'} it.`,
      material: true,
      // The level matters as much as the move: inflation two points off target
      // is the story even in a quarter when it did not budge. And arriving
      // outranks both, because it happens once.
      weight:
        (arrived ? 7 : 3) +
        move / Math.max(0.05, headline.uncertainty) +
        Math.abs(gap) * 1.5,
    })
  }

  const unemployment = reading(observation, 'unemployment')
  if (unemployment?.value != null) {
    const gap = unemployment.value - natural
    const move =
      unemployment.previous == null
        ? 0
        : Math.abs(unemployment.value - unemployment.previous)
    const recovered =
      gap <= 0.3 &&
      unemployment.previous != null &&
      unemployment.previous - natural > 0.8
    drafts.push({
      id: 'data-unemployment',
      desk: 'economy',
      headline: recovered
        ? `Unemployment is back to what this economy can sustain, at ${unemployment.value.toFixed(2)} %`
        : unemployment.previous == null
          ? `Labour market: unemployment stands at ${unemployment.value.toFixed(2)} %`
          : `Labour market: unemployment ${movementPhrase(unemployment.value, unemployment.previous, unemployment.unit, 2)}`,
      standfirst:
        gap > 0.3
          ? `That is ${gap.toFixed(2)} pp above the rate economists judge this economy can sustain.`
          : 'That is at or below the rate economists judge this economy can sustain.',
      material: true,
      weight:
        (recovered ? 7 : 3) +
        move / Math.max(0.05, unemployment.uncertainty) +
        Math.max(0, gap) * 1.2,
    })
  }

  const expectations = reading(observation, 'inflation_expectations')
  if (expectations?.value != null) {
    const drift = Math.abs(expectations.value - target)
    const move =
      expectations.previous == null
        ? 0
        : Math.abs(expectations.value - expectations.previous)
    // Only worth a story when it has actually moved or actually drifted. A
    // survey that reads 2.01 for the ninth quarter running is not news.
    if (move > 0.05 || drift > 0.4) {
      drafts.push({
        id: 'data-expectations',
        desk: 'economy',
        headline:
          drift > 0.5 || expectations.previous == null
            ? `Households and markets expect ${expectations.value.toFixed(2)} % inflation over five years`
            : `Five-year inflation expectations ${movementPhrase(expectations.value, expectations.previous, expectations.unit, 2)}`,
        standfirst:
          drift > 0.5
            ? `The objective is ${target.toFixed(1)} %. Expectations that settle away from it are the hardest thing a central bank has to pull back.`
            : 'Expectations remain close to the objective, which is what makes the objective reachable.',
        material: true,
        weight: 2.5 + drift * 3 + move * 4,
      })
    }
  }

  const wages = reading(observation, 'wage_growth')
  if (wages?.value != null && wages.previous != null) {
    const move = Math.abs(wages.value - wages.previous)
    if (move > wages.uncertainty) {
      drafts.push({
        id: 'data-wages',
        desk: 'business',
        headline: `Pay settlements: wage growth ${movementPhrase(wages.value, wages.previous, wages.unit, 2)}`,
        standfirst:
          'Wages chasing prices is how a temporary shock becomes a persistent one.',
        material: true,
        weight: 1.8 + move / Math.max(0.05, wages.uncertainty),
      })
    }
  }

  return drafts
}

/** The markets desk. Prices are exact and immediate, so they are always news. */
function marketStories(observation: ObservationSet): readonly Draft[] {
  const drafts: Draft[] = []

  const equity = reading(observation, 'equity_index')
  if (equity?.value != null && equity.previous != null) {
    const change = ((equity.value - equity.previous) / equity.previous) * 100
    if (Math.abs(change) >= 2) {
      drafts.push({
        id: 'market-equity',
        desk: 'markets',
        headline: `${equity.label} ${change > 0 ? 'gains' : 'sheds'} ${Math.abs(change).toFixed(1)} % on the quarter`,
        standfirst: `The index closed at ${equity.value.toFixed(0)}.`,
        material: true,
        weight: 1.2 + Math.abs(change) / 4,
      })
    }
  }

  const spread = reading(observation, 'credit_spread')
  if (spread?.value != null && spread.previous != null) {
    const change = spread.value - spread.previous
    if (Math.abs(change) >= 0.2) {
      drafts.push({
        id: 'market-credit',
        desk: 'markets',
        headline: `Corporate borrowing costs ${change > 0 ? 'widen' : 'narrow'} to ${spread.value.toFixed(2)} pp over government paper`,
        standfirst:
          change > 0
            ? 'Lenders are charging more for the same risk, which tightens conditions without any decision being taken.'
            : 'Lenders are charging less for the same risk, easing conditions on their own.',
        material: true,
        weight: 1.6 + Math.abs(change) * 2,
      })
    }
  }

  const yields = reading(observation, 'long_rate')
  if (yields?.value != null && yields.previous != null) {
    const change = (yields.value - yields.previous) * 100
    if (Math.abs(change) >= 15) {
      drafts.push({
        id: 'market-long',
        desk: 'markets',
        headline: `Ten-year yield ${change > 0 ? 'climbs' : 'falls'} ${Math.abs(change).toFixed(0)} bp to ${yields.value.toFixed(2)} %`,
        standfirst:
          'Long rates are what mortgages and corporate investment are actually priced off.',
        material: true,
        weight: 1.4 + Math.abs(change) / 40,
      })
    }
  }

  const fragmentation = reading(observation, 'fragmentation_spread')
  if (fragmentation?.value != null && fragmentation.previous != null) {
    const change = fragmentation.value - fragmentation.previous
    if (Math.abs(change) >= 20) {
      drafts.push({
        id: 'market-fragmentation',
        desk: 'markets',
        headline: `Sovereign spreads ${change > 0 ? 'widen' : 'narrow'} to ${fragmentation.value.toFixed(0)} bp across the currency area`,
        standfirst:
          change > 0
            ? 'One policy rate stops meaning one policy rate when member states borrow at prices this far apart.'
            : 'Borrowing costs across the area are converging again.',
        material: true,
        weight: 2 + Math.abs(change) / 60,
      })
    }
  }

  return drafts
}

/**
 * The institution desk: the paper writing about the central bank itself.
 *
 * The reason this exists is that political pressure had no reader. It now
 * erodes the anchor — see `EXPECTATIONS.anchoringIndependence` — and a
 * mechanic the player cannot see is a mechanic the player will report as
 * absent, which is exactly what happened.
 */
function institutionStories(
  state: SimulationState,
  observation: ObservationSet,
): readonly Draft[] {
  const drafts: Draft[] = []
  const { politicalPressure } = state.latent
  const tolerance = EXPECTATIONS.independenceTolerance
  const institution = getInstitution(state.config.institution)

  // The first edition. Every statistic carries a publication lag, so at
  // meeting zero literally nothing has been printed yet and the page came out
  // blank — which is backwards, because meeting one is when a chair most needs
  // orienting. It is also, on the day someone takes office, obviously the
  // lead: a paper does not open on the absence of data, it opens on the
  // appointment.
  if (state.meetingIndex === 0) {
    drafts.push({
      id: 'institution-appointment',
      desk: 'institution',
      headline: `A new chair takes office at the ${institution.name}`,
      standfirst: `${institution.mandateSummary} The first figures of the term are not published yet; the first decision is taken without them.`,
      material: true,
      weight: 6,
    })
  }

  // Not a published statistic and not presented as one: whether the bank's
  // independence is being openly contested is on the front page by definition,
  // and the chair knows it the same way everyone else does.
  if (politicalPressure > tolerance) {
    const severe = politicalPressure > tolerance + 20
    drafts.push({
      id: 'institution-independence',
      desk: 'institution',
      headline: severe
        ? 'Calls to curb the central bank grow louder'
        : "Legislators question the bank's remit",
      standfirst:
        'A bank whose independence is in doubt is one whose promises are ' +
        'discounted — expectations drift on the argument alone, before any ' +
        'policy has changed.',
      material: true,
      weight: severe ? 4.5 : 2.6,
    })
  }

  const credibility = reading(observation, 'credibility_index')
  if (credibility?.value != null && credibility.previous != null) {
    const change = credibility.value - credibility.previous
    if (Math.abs(change) >= 4) {
      drafts.push({
        id: 'institution-credibility',
        desk: 'institution',
        headline:
          change > 0
            ? `Confidence in the committee recovers to ${credibility.value.toFixed(0)}`
            : `Confidence in the committee slips to ${credibility.value.toFixed(0)}`,
        standfirst:
          change > 0
            ? 'Being believed is what makes an announcement work before the rate does.'
            : 'Every point lost here is a point of force taken off the next announcement.',
        material: true,
        weight: 1.5 + Math.abs(change) / 6,
      })
    }
  }

  const approval = reading(observation, 'public_approval')
  if (approval?.value != null && approval.previous != null) {
    const change = approval.value - approval.previous
    if (Math.abs(change) >= 4) {
      drafts.push({
        id: 'institution-approval',
        desk: 'institution',
        headline: `Public trust in the bank ${change > 0 ? 'rises' : 'falls'} to ${approval.value.toFixed(0)}`,
        standfirst: 'Polling of households on the prices and the jobs they live with.',
        material: true,
        weight: 0.9 + Math.abs(change) / 10,
      })
    }
  }

  return drafts
}

/**
 * Names the members an asymmetric event actually fell on.
 *
 * An event that hit two economies out of six, reported as though it hit the
 * area, is worse than no report: two thirds of the area did not experience it,
 * and noticing *who* did is the entire skill the mechanic exists to exercise.
 * The aggregate will barely move — that is by construction — so if the paper
 * does not say who was hit, nothing will.
 */
function appendMembers(
  body: string,
  members: readonly MemberId[] | undefined,
): string {
  if (members === undefined || members.length === 0) return body
  const names = members
    .map((id) => MEMBERS_BY_ID.get(id))
    .filter((profile): profile is NonNullable<typeof profile> => profile !== undefined)
    .map((profile) => `${profile.article}${profile.name}`)
  if (names.length === 0) return body

  const share = members.reduce(
    (sum, id) => sum + (MEMBERS_BY_ID.get(id)?.weight ?? 0),
    0,
  )
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  const sentence =
    `Felt in ${list} — ${(share * 100).toFixed(0)} % of the area, so the ` +
    `area-wide figures will move by much less than the national ones.`
  return body.length === 0 ? sentence : `${body} ${sentence}`
}

function withMembers(record: ResolvedEventRecord): string {
  return appendMembers(record.newswire, record.members)
}

/** Events that actually fired, and the follow-ups still unfolding. */
function eventStories(
  state: SimulationState,
  newswire: readonly string[],
  majorEvent: ResolvedEventRecord | null,
  minorEvents: readonly ResolvedEventRecord[],
): readonly Draft[] {
  const drafts: Draft[] = []

  if (majorEvent !== null) {
    drafts.push({
      id: `event-${majorEvent.eventId}`,
      desk: EVENTS_BY_ID.get(majorEvent.eventId)?.family.includes('political')
        ? 'institution'
        : 'world',
      headline: majorEvent.title,
      standfirst: withMembers(majorEvent),
      material: true,
      // A major event outranks everything on the page, which is what makes it
      // the lead. Nothing else reaches 8.
      weight: 12,
    })
  }

  // The follow-ups: a crisis that unfolds over quarters keeps its column.
  for (const dispatch of revealedDispatches(state.eventLog, state.meetingIndex)) {
    if (dispatch.record.meetingIndex === state.meetingIndex) continue
    const latest = dispatch.lines.at(-1)
    if (latest === undefined) continue
    drafts.push({
      id: `dispatch-${dispatch.record.eventId}-${dispatch.lines.length}`,
      desk: 'world',
      headline: `${dispatch.record.title}: the story continues`,
      standfirst: latest,
      material: true,
      weight: dispatch.concluded ? 2.2 : 5,
    })
  }

  for (const [index, line] of newswire.entries()) {
    // The wire line is the standfirst; its own first clause is the headline,
    // which is how a wire item becomes a story without writing it twice.
    const stop = line.indexOf('. ')
    const headline = stop > 20 ? line.slice(0, stop) : line
    const record = minorEvents[index]
    const body = stop > 20 ? line.slice(stop + 2) : null
    drafts.push({
      id: `wire-${index}`,
      desk: 'world',
      headline,
      standfirst:
        record === undefined ? body : appendMembers(body ?? '', record.members),
      material: true,
      weight: 3.4 - index * 0.1,
    })
  }

  return drafts
}

/**
 * Warning signals, written as reporting rather than as a system message.
 *
 * One story, not one per clue. Each clue used to become its own item with the
 * identical headline "Ahead of the meeting", so a meeting that surfaced two
 * of them printed the same headline twice in a row over two sentences about
 * the same subject — which reads as a bug in the paper rather than as two
 * risks. A column with a standing title is what a paper actually does with
 * this material.
 */
function clueStories(clues: readonly string[]): readonly Draft[] {
  if (clues.length === 0) return []
  return [
    {
      id: 'clues',
      desk: 'markets',
      headline: 'Ahead of the meeting',
      standfirst: clues.join(' '),
      material: true,
      weight: 2.8,
    },
  ]
}

/**
 * The filler.
 *
 * Drawn from a stateless hash keyed by seed and meeting, so it consumes none
 * of the run's randomness and reprints identically on a replay. Deliberately
 * plausible and deliberately inert: a page where everything matters never
 * teaches anyone to rank.
 */
function fillerStories(seed: string, meetingIndex: number): readonly Draft[] {
  const count = 1 + Math.floor(hashUnit(seed, 'filler-count', meetingIndex) * MAX_FILLER)
  const chosen = new Set<number>()
  const drafts: Draft[] = []

  for (let index = 0; index < count; index += 1) {
    // Rejection-free: walk forward from the drawn index until an unused one.
    let pick = Math.floor(hashUnit(seed, 'filler', meetingIndex, index) * FILLER.length)
    while (chosen.has(pick)) pick = (pick + 1) % FILLER.length
    chosen.add(pick)
    const item = FILLER[pick]
    drafts.push({
      id: `filler-${pick}`,
      desk: item.desk,
      headline: item.headline,
      standfirst: null,
      material: false,
      weight: -1 - index,
    })
  }

  return drafts
}

export function buildPressPage({
  state,
  observation,
  newswire,
  majorEvent,
  minorEvents = [],
}: {
  readonly state: SimulationState
  readonly observation: ObservationSet
  readonly newswire: readonly string[]
  readonly majorEvent: ResolvedEventRecord | null
  /**
   * The minor events behind `newswire`, in the same order.
   *
   * Carried so an asymmetric event can name the members it fell on. The wire
   * line itself cannot: it is written once, in the catalog, and which members
   * a structural selector resolves to is only known when the event fires.
   */
  readonly minorEvents?: readonly ResolvedEventRecord[]
}): PressPage {
  const institution = state.config.institution
  const drafts = [
    ...eventStories(
      state,
      newswire,
      majorEvent !== null && isMajorEvent(majorEvent.eventId) ? majorEvent : null,
      minorEvents,
    ),
    ...dataStories(observation, institution),
    ...marketStories(observation),
    ...institutionStories(state, observation),
    ...clueStories(observation.clues),
    ...fillerStories(state.config.seed, state.meetingIndex),
  ]

  // Ties broken by id so the page is stable rather than sort-implementation
  // dependent, which would make a replay print a different paper.
  const ranked = [...drafts].sort(
    (a, b) => b.weight - a.weight || a.id.localeCompare(b.id),
  )

  let materialRank = 0
  const stories: PressStory[] = ranked.map((draft) => {
    if (!draft.material) {
      return { ...draft, prominence: 'brief' as const }
    }
    const slot = SLOTS.find((entry) => materialRank < entry.upTo)!
    materialRank += 1
    return { ...draft, prominence: slot.prominence }
  })

  const year = Math.floor(state.timeYears) + 1
  const quarter = Math.min(4, Math.floor((state.timeYears % 1) * 4) + 1)

  return {
    masthead: MASTHEAD,
    dateline: `Year ${year}, quarter ${quarter} of the mandate`,
    stories,
    quiet: materialRank === 0,
  }
}
