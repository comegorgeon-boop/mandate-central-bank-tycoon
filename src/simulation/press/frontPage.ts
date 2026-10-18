import type { Institution } from '../types/core.ts'
import type { AreaObservation, MemberObservation } from '../observation/memberObservation.ts'
import type { ObservationSet } from '../types/observation.ts'
import { getInstitution } from '../config/institutions.ts'
import { MEMBERS_BY_ID, type MemberId } from '../config/members.ts'

/**
 * The front page, the morning after the decision.
 *
 * The meeting's paper reports the *world*; this reports the **committee**, and
 * it is written by people with a view. A decision that reads as obviously
 * correct from the area's aggregate reads as a betrayal from inside the member
 * that is already in the worst recession in the union, and the whole reason a
 * currency area is hard is that both readings are fair.
 *
 * So the euro area gets several papers and they disagree. That is the
 * asymmetric shock made legible: a player who has just raised the rate against
 * an area-wide inflation figure sees one masthead call it overdue and another
 * call it the wrong medicine, and can check both claims against the dispersion
 * panel. The Fed gets one paper, because it has one sovereign.
 *
 * ## The rules this content is written to
 *
 * Mastheads are **invented and named after geography** — a river, a sea, a
 * delta. No real newspaper is named, no real person is quoted, and no paper
 * has a national character: what decides its line is arithmetic, the gap
 * between that member's own inflation and unemployment and what the committee
 * just did about them. Swap two members' numbers and the two papers swap
 * lines. That is the difference between modelling an economy and
 * characterising a country, and it is not a fine distinction.
 *
 * Every word is a deterministic template filled from published figures. No
 * model, no remote call.
 */

export type Stance = 'vindicated' | 'approving' | 'uneasy' | 'hostile'

export interface FrontPage {
  readonly id: string
  readonly masthead: string
  /** The member it speaks for. Null for the area-wide paper. */
  readonly member: MemberId | null
  readonly location: string | null
  readonly headline: string
  readonly standfirst: string
  readonly stance: Stance
  /** The figure the paper is arguing from, so the reader can check it. */
  readonly evidence: string
}

/**
 * Mastheads, by geography.
 *
 * Rivers and coastlines, because a paper has to be called something and every
 * other option characterises. None of these exists.
 */
const MASTHEAD: Readonly<Record<MemberId, string>> = {
  de: 'The Rhine Ledger',
  fr: 'The Seine Review',
  it: 'The Tiber Chronicle',
  es: 'The Iberian Post',
  nl: 'The Delta Herald',
  rest: 'The Union Gazette',
}

/** The area-wide paper, and the Fed's. */
const AREA_MASTHEAD = 'The Meridian Ledger'

/**
 * How far a member's own position has to differ from the area's before its
 * paper has a different story to tell, in percentage points.
 *
 * Below this the national paper would be writing the area's editorial in a
 * different typeface, which is the thing this feature exists not to do.
 */
const DIVERGENCE = 0.6

export interface DecisionSummary {
  /** Basis points the committee moved. Zero for a hold. */
  readonly basisPoints: number
  /** The rate after the decision, %. */
  readonly rate: number
  /** True when a binding path was published with it. */
  readonly committed: boolean
}

/**
 * What a member wants from the committee, in basis points of its own.
 *
 * Positive means this member's own numbers argue for tightening. It is a
 * deliberately crude reading — the gap between its inflation overshoot and its
 * unemployment overshoot — because it is a newspaper's view and not a
 * reaction function, and because a reader has to be able to check it against
 * two numbers on the dispersion panel.
 */
function wants(member: MemberObservation, target: number, natural: number): number {
  const inflationGap = (member.inflation ?? target) - target
  const unemploymentGap = (member.unemployment ?? natural) - natural
  return inflationGap - unemploymentGap
}

function stanceFor(moved: number, wanted: number): Stance {
  // Did the committee move the way this member's own numbers argued for?
  const agrees = moved * wanted > 0 || (moved === 0 && Math.abs(wanted) < 0.5)
  const strong = Math.abs(wanted) >= 1.5
  if (agrees) return strong ? 'vindicated' : 'approving'
  return strong ? 'hostile' : 'uneasy'
}

function moveWords(basisPoints: number): string {
  if (basisPoints === 0) return 'held'
  return basisPoints > 0
    ? `raised rates by ${basisPoints} basis points`
    : `cut rates by ${Math.abs(basisPoints)} basis points`
}

const HEADLINE: Readonly<Record<Stance, (move: string, place: string) => string>> = {
  vindicated: (move, place) =>
    `At last: the bank has ${move}, and ${place} has been saying so for a year`,
  approving: (move, place) => `The bank has ${move}. ${place} can live with it`,
  uneasy: (move, place) => `The bank has ${move}. ${place} is not convinced`,
  hostile: (move, place) => `The bank has ${move}. ${place} will pay for it`,
}

/**
 * The paper's argument, naming the figure it is actually arguing from.
 *
 * The first version asserted the member did not have the problem the committee
 * was treating — "for an inflation rate this economy does not have" — and that
 * is frequently false. A member can have inflation *above* the area's and
 * unemployment so much worse that easing still wins its argument, which is
 * exactly the interesting case and exactly the one a lazy template gets
 * backwards. What is being said is a *comparison*, so the copy has to make the
 * comparison rather than deny one of its halves.
 */
function standfirstFor(
  stance: Stance,
  basisPoints: number,
  member: MemberObservation,
  target: number,
  natural: number,
): string {
  const tighter = basisPoints > 0
  const inflationGap = (member.inflation ?? target) - target
  const unemploymentGap = (member.unemployment ?? natural) - natural
  // Which of this member's own two numbers is making its case.
  const prices = inflationGap > unemploymentGap

  const here = prices
    ? `prices here are ${inflationGap.toFixed(2)} pp above the objective`
    : `unemployment here is ${unemploymentGap.toFixed(2)} pp above what this economy can sustain`

  switch (stance) {
    case 'vindicated':
      return `A rate this economy recognises, at last: ${here}, and the committee has moved the way that argues for.`
    case 'approving':
      return `Close enough to what the numbers here argue for — ${here} — that the argument can wait for another meeting.`
    case 'uneasy':
      return `${tighter ? 'A tightening' : 'An easing'} set for an average nobody here is living: ${here}. The case is arguable; the bill is local.`
    case 'hostile':
      return prices === tighter
        ? `${here}, and the committee has moved against it. The case is the union's; the bill is local.`
        : `Borrowing costs ${tighter ? 'rise' : 'fall'} while ${here}. The union's average has been served, and this economy is not the average.`
  }
}

/** The area-wide paper: no member's axe to grind, and the aggregate to report. */
function areaPage(
  observation: ObservationSet,
  decision: DecisionSummary,
  institution: Institution,
): FrontPage {
  const target = getInstitution(institution).inflationTarget
  const inflation = observation.indicators.headline_inflation?.value ?? null
  const move = moveWords(decision.basisPoints)

  const gap = inflation === null ? 0 : inflation - target
  const stance: Stance =
    decision.basisPoints * gap > 0
      ? 'approving'
      : Math.abs(gap) < 0.4
        ? 'approving'
        : 'uneasy'

  return {
    id: 'area',
    masthead: AREA_MASTHEAD,
    member: null,
    location: null,
    headline:
      decision.basisPoints === 0
        ? `Rates held at ${decision.rate.toFixed(2)} %`
        : `Rates ${decision.basisPoints > 0 ? 'up' : 'down'} to ${decision.rate.toFixed(2)} %`,
    standfirst:
      (inflation === null
        ? 'The committee has ' + move + '.'
        : `The committee has ${move}, with inflation at ${inflation.toFixed(2)} % against an objective of ${target.toFixed(1)} %.`) +
      (decision.committed
        ? ' A path was published alongside it, which the bank will be held to.'
        : ' No path was published alongside it.'),
    stance,
    evidence:
      inflation === null
        ? 'No consumer price release this meeting.'
        : `Area inflation ${inflation.toFixed(2)} %, objective ${target.toFixed(1)} %.`,
  }
}

/**
 * The papers, area-wide first and then the members with something else to say.
 *
 * At most two national pages. A currency area of six papers is a reading
 * exercise, and the disagreement lands harder from two mastheads that flatly
 * contradict each other than from six that shade.
 */
export function decisionFrontPages({
  observation,
  institution,
  decision,
}: {
  readonly observation: ObservationSet
  readonly institution: Institution
  readonly decision: DecisionSummary
}): readonly FrontPage[] {
  const pages: FrontPage[] = [areaPage(observation, decision, institution)]

  const area: AreaObservation | null = observation.area
  if (area === null) return pages

  const config = getInstitution(institution)
  const natural = config.initial.naturalUnemployment
  const target = config.inflationTarget

  const ranked = area.members
    .filter((member) => member.id !== 'rest')
    .map((member) => ({ member, wanted: wants(member, target, natural) }))
    .filter((entry) => Math.abs(entry.wanted) >= DIVERGENCE)
    .sort((a, b) => Math.abs(b.wanted) - Math.abs(a.wanted))

  // The two ends of the argument, not the two loudest on the same side: a
  // page of two mastheads agreeing is the area paper printed twice.
  const wantsTighter = ranked.find((entry) => entry.wanted > 0)
  const wantsLooser = ranked.find((entry) => entry.wanted < 0)
  const chosen = [wantsTighter, wantsLooser].filter(
    (entry): entry is NonNullable<typeof entry> => entry !== undefined,
  )
  const selected = chosen.length > 0 ? chosen : ranked.slice(0, 1)

  for (const { member, wanted } of selected) {
    const profile = MEMBERS_BY_ID.get(member.id)
    if (profile === undefined) continue
    const stance = stanceFor(decision.basisPoints, wanted)
    const place = `${profile.article}${profile.name}`.replace(/^the /, 'The ')

    pages.push({
      id: member.id,
      masthead: MASTHEAD[member.id],
      member: member.id,
      location: profile.name,
      headline: HEADLINE[stance](moveWords(decision.basisPoints), place),
      standfirst: standfirstFor(
        stance,
        decision.basisPoints,
        member,
        target,
        natural,
      ),
      stance,
      evidence:
        `${profile.name}: inflation ` +
        (member.inflation === null ? '—' : `${member.inflation.toFixed(2)} %`) +
        ', unemployment ' +
        (member.unemployment === null ? '—' : `${member.unemployment.toFixed(2)} %`) +
        `, spread ${member.spread} bp.`,
    })
  }

  return pages
}
