import type { RunSession } from '../replay/replayRun.ts'
import { GUIDANCE_HORIZON_MEETINGS, THRESHOLDS } from '../config/thresholds.ts'
import { politicalDemand } from '../politics/demands.ts'
import { scenarioOf } from '../scenarios/scenarios.ts'

/**
 * Not every meeting is a meeting.
 *
 * ## The complaint this answers
 *
 * > "Le jeu n'a qu'une seule forme de tour. Vingt-quatre fois de suite : lire
 * > beaucoup de chiffres, bouger un curseur, lire beaucoup de chiffres. Le
 * > contenu change à chaque réunion, le geste jamais. C'est ça l'ennui, pas le
 * > manque de contenu."
 *
 * That was right, and it was invisible to every measurement this project had:
 * the screens were legible, the contrast passed on six hundred states, the
 * prose had been cut by a fifth, and the *shape of a turn* was identical
 * twenty-four times running. Density was never the problem. Uniformity was.
 *
 * ## Three tempos
 *
 * **Quick.** Nothing is at stake that the committee has not already settled.
 * One line, the dial, done — the room is one gesture away and most players
 * will not open it, which is the point. Real committees hold meetings like
 * this constantly and they take ten minutes.
 *
 * **Full.** Something **changed**: a crisis landed, a warning just turned
 * severe, the government has asked for something it was not asking for last
 * meeting, the objective itself moved, or a promise comes due. The whole
 * apparatus comes out, because this is the meeting it was built for.
 *
 * The word *changed* is the whole rule, and the first version got it wrong.
 * It tested states — "a demand exists", "a supply shock is running" — and a
 * state is true for as long as it lasts, so the 2021-23 mandates came back
 * 79 % full and the tempo had latched on. A thing that is true at every
 * meeting is the weather, not an event, and a committee does not convene the
 * full room because it is still raining. Measured: that one change took
 * fed/hard from 58 % quick to the figures in `dev/tempoMix.ts`.
 *
 * **Decisive.** Once per mandate, announced in advance, and the one the
 * mandate is remembered by.
 *
 * ## Why this lives in the simulation
 *
 * Because it has to replay. A tempo derived in the interface would differ
 * between a run and its replay the moment anything in the interface changed,
 * and the decision log would reconstruct a mandate whose meetings had a
 * different shape from the ones that were played. It is a pure function of
 * the session — no randomness of its own beyond the seeded draw that places
 * the decisive meeting.
 */

export type MeetingTempo = 'quick' | 'full' | 'decisive'

export interface TempoReading {
  readonly tempo: MeetingTempo
  /**
   * Why this meeting is not quick, in the player's words, or null.
   *
   * Shown as the reason the room is open. A full meeting that cannot say what
   * it is for is a full meeting that should have been quick.
   */
  readonly because: string | null
}

/**
 * Which meeting of this mandate is the decisive one.
 *
 * Placed in the middle half of the term — far enough in that the player has a
 * position to defend, far enough from the end that the consequence has
 * somewhere to land. Derived from the seed so it replays, and announced a
 * meeting ahead so it can be dreaded.
 */
export function decisiveMeetingOf(session: RunSession): number {
  const { meetingCount, seed } = session.state.config
  // A scenario's decisive meeting is where its own history put it: the
  // meeting before the mandate-defining crisis, so the announcement lands on
  // the committee that still had a choice.
  const major = session.state.config.scenario === null ? null : scriptedMajor(session)
  if (major !== null) return major

  let hash = 0
  for (const character of seed) hash = (hash * 31 + character.charCodeAt(0)) | 0
  const first = Math.floor(meetingCount * 0.3)
  const span = Math.max(1, Math.floor(meetingCount * 0.45))
  return first + (Math.abs(hash) % span)
}

/** The meeting at which a scenario's own major event is scheduled, if any. */
function scriptedMajor(session: RunSession): number | null {
  const scenario = scenarioOf(session.state.config)
  if (scenario === null) return null
  // The meeting *before* the crisis, so the announcement reaches a committee
  // that still has a choice about what to walk into.
  const major = scenario.events.find((event) => event.major)
  return major === undefined ? null : Math.max(1, major.meetingIndex - 1)
}

/**
 * What kind of meeting this is.
 *
 * Read in the order a committee would: a scheduled decisive meeting outranks
 * everything, then a live crisis, then the ordinary business that still needs
 * the room, then quick.
 */
export function readTempo(session: RunSession): TempoReading {
  const { state, outcome } = session
  const index = state.meetingIndex

  if (index === decisiveMeetingOf(session)) {
    return { tempo: 'decisive', because: null }
  }

  // The first meeting is never quick. It is the one where a player learns what
  // a meeting is — the first-meeting guide points at the tab strip and the
  // confirm step, neither of which a quick meeting has — and it is the only
  // meeting with no previous state to have changed from, so every test below
  // would answer "nothing happened" and send a new player straight to a
  // five-second surface they had never been shown the inside of.
  if (index === 0) {
    return { tempo: 'full', because: 'Your first meeting. The whole room is out.' }
  }

  // The world as it was at the last meeting, for every "has this changed"
  // test below. Absent at the first meeting, where nothing can have changed.
  const before = state.history.at(-2)?.latent ?? null

  // A crisis that landed in the interval just gone.
  //
  // **Majors only**, and the reasoning is worth keeping because the opposite
  // was tried in between. Opening the whole room for every event looked like
  // the fix for "eight meetings with nothing to decide" — but once the
  // generator was made to fire every third meeting at the latest, it meant
  // three meetings in sixteen stayed quick and the fast surface effectively
  // disappeared. Two things were being conflated:
  //
  //   - **whether something happened**, which is the event generator's job
  //     and is now guaranteed (see `LatentState.meetingsSinceEvent`);
  //   - **whether the whole apparatus is needed to respond**, which is this.
  //
  // An energy spike changes the economy and is worth a sentence and a dial.
  // A bank failing is worth the room. The quick surface names the event in
  // its own line — see `features/meeting/meetingLine.ts` — so a player is
  // never unaware that something landed, only spared the dossier about it.
  if (session.majorEvent !== null) {
    return { tempo: 'full', because: session.majorEvent.title }
  }

  // A warning that has just become severe. `breachCounters` counts the
  // consecutive meetings a condition has held, so a counter of one is the
  // meeting it started — and a warning standing at four is the same warning
  // the player has already convened the room about.
  const warning = outcome.warnings.find(
    (entry) =>
      entry.severity === 'severe' && (outcome.breachCounters[entry.id] ?? 0) <= 1,
  )
  if (warning !== undefined) {
    return { tempo: 'full', because: warning.message }
  }

  // A demand the government was not making last meeting.
  if (politicalDemand(state) !== null && !wasDemanding(state, before)) {
    return { tempo: 'full', because: 'The government has asked for something.' }
  }

  // The meeting the objective moves, and not the ones after it. A cost-push
  // regime changes what winning means; a player who is not shown that is
  // being scored on a rule nobody told them about. But it is shown *once*.
  const regimeBar = THRESHOLDS.inflationSpiral.watchInflation / 4
  if (
    state.latent.supplyShock > regimeBar &&
    (before === null || before.supplyShock <= regimeBar)
  ) {
    return {
      tempo: 'full',
      because: 'Costs are being pushed from outside demand; the objective has moved.',
    }
  }

  // A promise coming due is the one piece of ordinary business worth the room,
  // because it is the only thing in the game that pays for conduct. It is due
  // on exactly one meeting.
  const guidance = state.guidance
  if (
    guidance.impliedRatePath !== null &&
    guidance.issuedAtMeeting >= 0 &&
    index - guidance.issuedAtMeeting === GUIDANCE_HORIZON_MEETINGS - 1
  ) {
    return { tempo: 'full', because: 'Published guidance comes due.' }
  }

  return { tempo: 'quick', because: null }
}

/**
 * Whether the government was already pressing at the previous meeting.
 *
 * Reconstructed from the political-pressure reading rather than from a stored
 * flag, because the demand generator is a pure function of the state and
 * storing a second copy of something derivable is how two sources of truth
 * about one world start disagreeing.
 */
function wasDemanding(
  state: RunSession['state'],
  before: { readonly politicalPressure: number } | null,
): boolean {
  if (before === null) return false
  return politicalDemand({ ...state, latent: { ...state.latent, ...before } }) !== null
}
