import {
  explainInflation,
  liveShocks,
  meetingsLeftInTerm,
  TENURE,
  unemploymentGap,
  type RunSession,
} from '../../simulation/index.ts'

/**
 * The dispatches: the wire, and the first three meetings' guidance.
 *
 * ## Why a wire and not a help box
 *
 * > "TOUT VIT DANS LE TERMINAL : pas d'encadré d'aide, le texte arrive par un
 * > PANNEAU DÉPÊCHES, comme un fil d'agence."
 *
 * A help box is a thing outside the game that explains the game. A wire is
 * part of the machine the player is already looking at, which means guidance
 * and news arrive through the same slot and in the same voice — and that the
 * guidance can stop without a seam, because when it stops the slot carries on
 * doing something else.
 *
 * ## The opening is guided, at every difficulty
 *
 * > "LES TROIS PREMIÈRES RÉUNIONS DE CHAQUE PARTIE SONT GUIDÉES, puis le jeu
 * > se retire. Pas un mode à part : l'ouverture de toutes les parties, à
 * > toutes les difficultés."
 *
 * Three, then silence, and the silence is as deliberate as the guidance. A
 * tutorial that never stops is a game that never starts; and because this is
 * the opening of *every* mandate rather than a mode, a player on hard gets
 * the same three dispatches — which is right, because what they explain is
 * how to read the screen, not how to run an economy.
 */

export interface Dispatch {
  /** Stable, so a re-render does not reshuffle the wire. */
  readonly id: string
  /** The slug a wire puts in front of a story. */
  readonly tag: string
  readonly text: string
  /** Guidance is marked, so it can be styled as the machine talking to you. */
  readonly kind: 'guide' | 'wire'
}

/**
 * The three that teach the screen.
 *
 * Each one points at a thing that is on the screen *right now* and says what
 * to do with it. None of them is a general statement about monetary policy:
 * the player can read about monetary policy anywhere, and what they cannot
 * get anywhere else is "the amber line at the top is the only thing you have
 * to read".
 */
function guidance(session: RunSession, index: number): Dispatch | null {
  const { config } = session.state
  const tenure = TENURE[config.institution]

  if (index === 0) {
    return {
      id: 'guide-0',
      tag: 'Start here',
      kind: 'guide',
      text:
        'The amber line at the top is the only thing you have to read. It ' +
        'says what to do and how far away it is. Everything below it is ' +
        'there to be checked, not read.',
    }
  }

  if (index === 1) {
    return {
      id: 'guide-1',
      tag: 'The dial',
      kind: 'guide',
      text:
        'Your rate takes about a year to reach prices. You are not setting ' +
        'today’s inflation, you are setting the inflation of six meetings ' +
        'from now — so act on what is coming, not on the print.',
    }
  }

  if (index === 2) {
    return {
      id: 'guide-2',
      tag: 'How this ends',
      kind: 'guide',
      text: tenure.renewable
        ? `You serve until you are not reappointed. The hearing is ${meetingsLeftInTerm(
            config.institution,
            session.state.meetingIndex,
          )} meetings away and it weighs your standing, not your luck.`
        : 'Your term is eight years and cannot be renewed or cut short. ' +
          'Nobody can remove you — but a president who loses the Governing ' +
          'Council is finished anyway.',
    }
  }

  return null
}

/**
 * The wire for this meeting: guidance first, then whatever is live.
 *
 * Capped at three. A wire that scrolls is a newspaper, and the whole
 * complaint behind this panel was that reading a newspaper every meeting is
 * too much work for what it gives back.
 */
export function readDispatches(
  session: RunSession,
  { compact = false }: { readonly compact?: boolean } = {},
): readonly Dispatch[] {
  const out: Dispatch[] = []
  const index = session.state.meetingIndex

  const guide = index < 3 ? guidance(session, index) : null
  if (guide !== null) out.push(guide)

  // What landed since the last meeting, in the wire's own words.
  for (const record of [
    ...(session.majorEvent === null ? [] : [session.majorEvent]),
    ...session.minorEvents,
  ]) {
    out.push({
      id: `event-${record.eventId}-${record.meetingIndex}`,
      tag: 'Landed',
      kind: 'wire',
      /*
       * On the quick surface, the **title** and not the newswire sentence.
       *
       * The wire copy is twenty words of press prose and putting it here put
       * the newspaper straight back onto the surface this whole pass took it
       * off — measured, the quick budget went from 34 words to 96 the moment
       * this panel landed. The title says what happened; the sentence says it
       * again with colour, and colour is what the heavy surface is for.
       */
      text: compact ? record.title : record.newswire,
    })
  }

  /*
   * The standing line, on the heavy surface only.
   *
   * On a steady quick meeting the wire has nothing left to do: the shock
   * panel already names what is arriving and what to do about it, the order
   * already says what the meeting is for, and a third restatement of the same
   * economy is the newspaper coming back in through a different door. Its job
   * on the quick surface is to *teach*, and after three meetings it has
   * finished.
   */
  if (out.length < 3 && !compact) {
    const inflation = explainInflation(session.state.latent, session.state.config)
    const jobs = unemploymentGap(session.state.latent)
    const shocks = liveShocks(session.state, 1)

    if (shocks.length > 0 && index >= 3) {
      out.push({
        id: `running-${shocks[0].eventId}`,
        tag: 'Still running',
        kind: 'wire',
        text: `${shocks[0].title} — about ${shocks[0].meetingsLeft} meetings of it left to arrive.`,
      })
    } else if (Math.abs(inflation.gap) > 1) {
      out.push({
        id: 'wire-prices',
        tag: 'Prices',
        kind: 'wire',
        text:
          `Inflation is ${Math.abs(inflation.gap).toFixed(1)} points ` +
          `${inflation.gap > 0 ? 'above' : 'below'} the objective` +
          (inflation.leading === null
            ? '.'
            : `, mostly ${inflation.leading.label}.`),
      })
    } else if (Math.abs(jobs) > 1) {
      out.push({
        id: 'wire-jobs',
        tag: 'Labour',
        kind: 'wire',
        text:
          `Unemployment is ${Math.abs(jobs).toFixed(1)} points ` +
          `${jobs > 0 ? 'above' : 'below'} the sustainable rate.`,
      })
    }
  }

  /*
   * One line on the quick surface, three on the heavy one.
   *
   * A wire that scrolls is a newspaper, and the complaint behind this panel
   * was that reading a newspaper every meeting is too much work for what it
   * gives back. The guided opening is the exception and it is the point: for
   * three meetings the top line is a lesson, and the budget is allowed to
   * carry it because teaching the screen *is* the job at meeting one.
   */
  return out.slice(0, compact ? 1 : 3)
}
