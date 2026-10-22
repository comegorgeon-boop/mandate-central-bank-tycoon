import type { EndConditionWarning } from '../types/scoring.ts'
import type { ResolvedEventRecord } from '../types/events.ts'
import type { LatentState, SimulationState } from '../types/state.ts'
import { readMandate } from './mandate.ts'
import { inflationTargetFor } from '../scenarios/scenarios.ts'
import { unemploymentGap } from '../engine/indices.ts'

/**
 * The bulletin that takes the screen: a wire flash, not a line in the feed.
 *
 * > "Aujourd'hui une crise bancaire arrive dans le flux comme le reste ; je
 * > veux qu'elle me coupe la parole. […] RÉSERVÉE AUX MAJEURS ET AU CRITIQUE,
 * > jamais à la routine, avec un plafond par mandat. Si ça surgit tout le
 * > temps, ça devient du papier peint en trois réunions et j'aurai perdu
 * > l'outil au moment précis où j'en ai besoin."
 *
 * The second half of that is the harder constraint and it is what shapes this
 * file. An interruption is a currency: every one spent on something ordinary
 * devalues the next, and the failure mode is not "too noisy", it is **the
 * alarm not being read on the meeting it matters**. So the gating is strict
 * and it is strict in a particular way.
 *
 * ## Everything here fires on a *transition*
 *
 * Not on a state. A guard that is broken stays broken for several meetings and
 * a post at risk stays at risk; a bulletin on the *state* would re-announce the
 * same fact every meeting until it cleared, which is exactly the wallpaper the
 * player is describing. So each kind fires on the meeting the thing **became**
 * true and is silent afterwards, which is the pattern journal 17 landed on for
 * the guidance wire: *"fired on the crossing rather than on the state, so it is
 * news rather than furniture."*
 *
 * That also makes the per-mandate cap mostly structural rather than a counter:
 * a guard can only break again after it has healed.
 *
 * ## And a hard cap on top of it
 *
 * Transitions alone are not quite enough — an economy oscillating around a
 * threshold would cross it repeatedly — so `PER_MANDATE_CAP` is a backstop,
 * counted over the mandate's own history so it replays exactly. Majors are
 * counted separately and more generously: a major event is already rare by
 * construction (`events/catalog.ts` rations them) and it is the case the player
 * named first.
 *
 * ## What it says
 *
 * > "Elle dit ce qui s'est passé, ce que ça fait à mes trois chiffres, et ce
 * > que ça veut dire concrètement — en mots, pas en indices."
 *
 * Three fields, in that order: `headline` (what happened), `readings` (what it
 * does to the three numbers on the board, as a before-and-after), and
 * `meaning` (what that is, in words). Never an index, never a basis point
 * without a sentence around it, and never a recommendation — the room and the
 * desk are where a decision gets argued, and an alarm that told the player
 * what to do would be the guided-decision mistake arriving somewhere new.
 */

export type BulletinKind =
  | 'major_event'
  | 'post_at_risk'
  | 'guard_broken'
  | 'target_adrift'

export interface BulletinReading {
  readonly label: string
  readonly before: string
  readonly after: string
  /** True when this reading moved the wrong way. Drives the colour. */
  readonly worse: boolean
}

export interface Bulletin {
  readonly kind: BulletinKind
  /** `urgent` is the red band: the post or the system. `grave` is amber. */
  readonly severity: 'urgent' | 'grave'
  readonly label: string
  readonly headline: string
  readonly readings: readonly BulletinReading[]
  readonly meaning: string
}

/**
 * Bulletins allowed in one mandate, **majors included**.
 *
 * ## Measured, and the first version was wallpaper
 *
 * Majors were exempt, on the reasoning that `events/catalog.ts` already
 * rations them. It does not ration them nearly enough for this: measured in
 * `dev/bulletinRate.ts`, the first version interrupted **18 to 27 % of
 * meetings** at every bucket under both plays, and major events were the bulk
 * of it — 178 to 258 per cell against a few dozen for the three critical kinds
 * together. Journal 19 is where that comes from: the event rate was tripled so
 * that the *longest calm run of meetings is two*, everywhere. An alarm on
 * every major is an alarm every third meeting.
 *
 * That is precisely the thing the player described: *"si ça surgit tout le
 * temps, ça devient du papier peint en trois réunions et j'aurai perdu l'outil
 * au moment précis où j'en ai besoin."* One meeting in four is reflex
 * territory. So the cap covers everything, which is also what was asked for —
 * *"avec un plafond par mandat"*, without an exemption in it.
 *
 * ## Four
 *
 * Measured against the share of meetings rather than chosen: four takes the
 * interruption rate to roughly one meeting in ten on a short mandate and well
 * under that on a long one, which is the band where each one is still an
 * event. Fewer than four and a Fed term that meets three genuine crises has
 * nothing left for the fourth.
 *
 * The *order* in `readBulletin` is what decides which four a player gets, and
 * it is deliberate: the post first, then the system, then the objectives. A
 * mandate that spends its allowance on market news and then cannot announce
 * that the post is at risk has spent it wrongly.
 */
const PER_MANDATE_CAP = 4

/**
 * Points from objective at which a target has "come badly adrift".
 *
 * Deliberately far outside `mandate.ts`'s own `TOLERANCE` of 0.5, which is the
 * band inside which an objective counts as *met*. This is the other end: not
 * "missed" but visibly coming apart, and a bar anywhere near the tolerance
 * would fire on ordinary weather at a difficulty that opens six points out.
 */
const ADRIFT = { inflation: 4, unemployment: 3 } as const

function format(value: number, unit = ' %'): string {
  return `${value.toFixed(1)}${unit}`
}

/** Has a target crossed from "wide" to "badly adrift" at this meeting? */
function adriftCrossing(
  now: LatentState,
  before: LatentState,
  target: number,
): 'inflation' | 'unemployment' | null {
  const wasInflation = Math.abs(before.inflationHeadline - target) >= ADRIFT.inflation
  const isInflation = Math.abs(now.inflationHeadline - target) >= ADRIFT.inflation
  if (isInflation && !wasInflation) return 'inflation'

  const wasJobs = Math.abs(unemploymentGap(before)) >= ADRIFT.unemployment
  const isJobs = Math.abs(unemploymentGap(now)) >= ADRIFT.unemployment
  if (isJobs && !wasJobs) return 'unemployment'

  return null
}

/** Growth below this is the guard broken. Mirrors `explain/mandate.ts`. */
const GUARD_FLOOR = -0.5

/**
 * The bulletin for this meeting, or null — which is most meetings.
 *
 * `severeWarnings` comes from the end conditions rather than being recomputed:
 * whether the post is near revocation is their judgement, and a second opinion
 * about it here is how two screens come to disagree about whether a mandate is
 * in danger.
 */
export function readBulletin(
  state: SimulationState,
  majorEvent: ResolvedEventRecord | null,
  warnings: readonly EndConditionWarning[],
  previousWarnings: readonly EndConditionWarning[],
  /**
   * How many bulletins this mandate has already shown.
   *
   * **Counted by the run loop and passed in**, which took two attempts. The
   * first version recomputed it from `state.history` and `state.eventLog`, on
   * the reasoning `scoring/banked.ts` gives for deriving the banked total
   * rather than storing it. It does not work here: `post_at_risk` fires off the
   * *warnings*, and a history snapshot carries the economy, not the end
   * conditions. So that kind was uncounted and the allowance leaked — measured,
   * the worst mandates showed five and six against a cap of four.
   *
   * A cap that does not hold is this project's own recorded defect, so the
   * count is now kept where every bulletin passes through it. It lives on the
   * `RunSession` rather than on `SimulationState`: the bulletin is explanation
   * and not economy, nothing in the engine reads it, and a replay rebuilds it
   * because a replay goes through `submitMeeting`.
   */
  spent: number,
): Bulletin | null {
  const history = state.history
  if (history.length < 2) {
    // The opening cannot be news: nothing has changed yet, and the briefing
    // has just said what the economy is.
    return null
  }

  // **The allowance, checked before anything is composed.** Majors are inside
  // it: measured, exempting them interrupted a quarter of all meetings. See
  // `PER_MANDATE_CAP`.
  if (spent >= PER_MANDATE_CAP) return null

  const now = history[history.length - 1].latent
  const before = history[history.length - 2].latent
  const target = inflationTargetFor(state.config)

  /*
   * The order is the rationing. With four in a career, which four the player
   * gets is decided here, and it runs from the thing that ends the mandate to
   * the thing that is merely bad: the post, then the system, then an
   * objective. A mandate that spent its allowance on market news and could not
   * then announce that the post was at risk would have spent it wrongly.
   */

  // 1. The post. A warning that has just become severe — not one that *is*
  //    severe, which would re-announce itself every meeting until it cleared.
  const severe = warnings.find((warning) => warning.severity === 'severe')
  const wasSevere = previousWarnings.some(
    (warning) => warning.id === severe?.id && warning.severity === 'severe',
  )
  if (severe !== undefined && !wasSevere) {
    return {
      kind: 'post_at_risk',
      severity: 'urgent',
      label: 'Your position',
      headline: severe.label,
      readings: boardReadings(state, now, before),
      meaning:
        `${severe.message} This has held for ${severe.meetingsHeld} of the ` +
        `${severe.meetingsToTrigger} consecutive meetings that end the mandate. ` +
        'It is not a score penalty. It is the job.',
    }
  }

  // 2. A major event: the system, or the world, doing something.
  if (majorEvent !== null) return majorBulletin(state, majorEvent)

  // 3. The guard. Growth crossing below the floor is the one reading the board
  //    calls "the cost of reaching the other two".
  if (now.realGrowth < GUARD_FLOOR && before.realGrowth >= GUARD_FLOOR) {
    return {
      kind: 'guard_broken',
      severity: 'grave',
      label: 'The guard',
      headline: 'The economy has started shrinking',
      readings: boardReadings(state, now, before),
      meaning:
        'Growth has gone below zero. This is the reading the board calls a ' +
        'guard rather than a target: nobody asks you to maximise it, and ' +
        'breaking it is how a mandate that hit its objectives is still judged ' +
        'to have failed. Tightening into this makes it worse before it makes ' +
        'inflation better.',
    }
  }

  // 4. A target coming badly adrift — the first of the player's three.
  const adrift = adriftCrossing(now, before, target)
  if (adrift !== null) {
    const inflation = adrift === 'inflation'
    return {
      kind: 'target_adrift',
      severity: 'grave',
      label: 'An objective',
      headline: inflation
        ? 'Inflation has come badly adrift of the objective'
        : 'Employment has come badly adrift of its sustainable rate',
      readings: boardReadings(state, now, before),
      meaning: inflation
        ? `Headline inflation is now more than ${ADRIFT.inflation} points from ` +
          `the ${format(target)} objective. At this distance expectations start ` +
          'to follow the number rather than the objective, and an anchor that ' +
          'has moved is the expensive thing to repair — far more expensive than ' +
          'the gap itself.'
        : `Unemployment is now more than ${ADRIFT.unemployment} points from the ` +
          'rate this economy can sustain. A gap this wide leaves scars: people ' +
          'out of work long enough stop being counted as available, and the ' +
          'sustainable rate itself drifts toward the bad number.',
    }
  }

  return null
}

/** The three board readings, before and after, for the bulletin's middle. */
function boardReadings(
  state: SimulationState,
  now: LatentState,
  before: LatentState,
): readonly BulletinReading[] {
  const after = readMandate(now, state.config)
  const prior = readMandate(before, state.config)

  return after.readings.map((reading, index) => {
    const previous = prior.readings[index]
    return {
      label: reading.label,
      before: format(previous?.value ?? reading.value, reading.unit),
      after: format(reading.value, reading.unit),
      // A guard is worse when it falls; a target is worse when its distance
      // grows. Comparing the raw values would call a falling inflation rate a
      // deterioration on the mandate that is trying to lower it.
      worse:
        reading.kind === 'guard'
          ? reading.value < (previous?.value ?? reading.value)
          : Math.abs(reading.distance) >
            Math.abs(previous?.distance ?? reading.distance),
    }
  })
}

function majorBulletin(
  state: SimulationState,
  event: ResolvedEventRecord,
): Bulletin {
  const history = state.history
  const now = history[history.length - 1]?.latent
  const before = history[history.length - 2]?.latent ?? now

  return {
    kind: 'major_event',
    severity: 'urgent',
    label: 'Newswire',
    headline: event.title,
    readings: now === undefined ? [] : boardReadings(state, now, before),
    // The wire line is what a newsroom published; it is already written for
    // this exact purpose and writing a second description here would be the
    // same event narrated twice, which is how two screens come to disagree.
    meaning: event.newswire,
  }
}
