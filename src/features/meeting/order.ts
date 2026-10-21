import {
  explainInflation,
  inflationTargetFor,
  unemploymentGap,
  type RunSession,
} from '../../simulation/index.ts'

/**
 * The order: what to do at this meeting, in the imperative, with a number.
 *
 * ## What this replaces, and why a description is not enough
 *
 * > "LA LIGNE DU HAUT DEVIENT UN ORDRE. À l'impératif, propre à CETTE réunion,
 * > avec la distance et le coût de l'inaction : « Faites redescendre
 * > l'inflation. Sans resserrement, deux points de plus d'ici trois
 * > réunions. » Plus jamais « 1 going right »."
 *
 * The diagnosis behind it is the sharpest thing anyone has said about this
 * game: **a PDF describes, a game commands.** The screen was handing the
 * player a *state* — one going right, two going wrong, inflation 4.8 — when
 * what a person sitting down to a decision needs is a *diagnosis* and an
 * instruction. "1 going right" is not even a description. It is a tally of
 * descriptions.
 *
 * So every meeting now opens with a sentence that has three parts, and the
 * test beside this file asserts all three on every meeting of every mandate:
 *
 *  1. **A verb addressed to the player.** Imperative, second person, an action
 *     they can take at this meeting.
 *  2. **A number to close.** The distance, stated.
 *  3. **The cost of doing nothing**, where the engine can see one.
 *
 * ## Why it can be this definite
 *
 * Because the engine knows. `explainInflation` reads the Phillips and headline
 * equations back term by term, so the order can name the leg that is actually
 * driving the miss and say whether the rate reaches it. That is the difference
 * between "inflation is 4.8 %" and "two of those points are energy, and the
 * rate cannot touch them."
 *
 * ## What it must never become
 *
 * A recommendation of a specific move. The order names the *objective* and the
 * distance; choosing the instrument and the size is the game, and a line that
 * said "raise 50 bp" would be playing it for the player. On easy the staff are
 * allowed to go further — that is what `meetingLine.ts` is for — and this stays
 * on the objective at every difficulty.
 */

export interface MeetingOrder {
  /** The imperative sentence. Always begins with a verb. */
  readonly command: string
  /** The distance and, where there is one, the cost of inaction. */
  readonly detail: string
  /** How loud the banner is. */
  readonly severity: 'calm' | 'watch' | 'urgent'
}

/** Percentage points of miss above which an objective is "the" problem. */
const MATERIAL = 0.5

export function readOrder(session: RunSession): MeetingOrder {
  const { state } = session
  const { latent, config } = state
  const target = inflationTargetFor(config)
  const inflation = explainInflation(latent, config)
  const jobsGap = unemploymentGap(latent)

  const priceMiss = inflation.gap
  const absPrice = Math.abs(priceMiss)
  const absJobs = Math.abs(jobsGap)

  // Which objective is further out, in its own units. Unemployment is scaled
  // because a point of unemployment gap and a point of inflation miss are not
  // the same amount of trouble — the engine's own score weights say so, and
  // this is the same judgement in one number.
  const priceUrgency = absPrice
  const jobsUrgency = absJobs * 0.8

  const severity: MeetingOrder['severity'] =
    Math.max(priceUrgency, jobsUrgency) > 2
      ? 'urgent'
      : Math.max(priceUrgency, jobsUrgency) > MATERIAL
        ? 'watch'
        : 'calm'

  /* ── Inflation is the problem ─────────────────────────────────────────── */
  if (priceUrgency >= jobsUrgency && absPrice > MATERIAL) {
    const rising = priceMiss > 0
    const leg = inflation.leading
    const outOfReach = Math.abs(priceMiss - inflation.reachable)

    const command = rising
      ? 'Bring inflation back down.'
      : 'Get inflation back up to target.'

    /*
     * **The unreachable share goes in the first sentence, not the second.**
     *
     * This was the other way round, and `dev/orderOnly.ts` found it: a reader
     * that sees only the order line kept tightening into a cost-push shock
     * the rate could not touch, and nine of forty easy mandates ended in a
     * banking crisis of the reader's own making. The clause that prevents
     * exactly that — *"1.2 of those points will not answer to you"* — was in
     * the second sentence, which the quick surface drops to stay inside its
     * word budget.
     *
     * So the one screen that shows a single sentence was showing the single
     * sentence that does not contain the warning. Distance and reachability
     * now travel together, because a distance you cannot close is a
     * different instruction from a distance you can.
     */
    const unreachable = leg !== null && leg.answersToRates === 'no' && leg.share > 0.3
    const parts: string[] = [
      unreachable
        ? `${absPrice.toFixed(1)} points ${rising ? 'above' : 'below'} the ${target.toFixed(1)} % objective, and ${outOfReach.toFixed(1)} of them will not answer to the rate — it is mostly ${leg.label}.`
        : `${absPrice.toFixed(1)} points ${rising ? 'above' : 'below'} the ${target.toFixed(1)} % objective.`,
    ]

    if (leg !== null && leg.share > 0.3 && !unreachable) {
      parts.push(`Mostly ${leg.label}.`)
    }

    // The cost of inaction, from the engine's own persistence: an unanchored
    // anchor is what turns a miss into a spiral, so that is what is quoted.
    const drift = Math.abs(latent.expectedInflationLong - target)
    if (drift > 0.3) {
      parts.push(
        `Expectations are already ${drift.toFixed(1)} off. Left alone, that is where the next three meetings start from.`,
      )
    } else if (rising && absPrice > 1.5) {
      parts.push('Left alone, this is the meeting the anchor starts to move.')
    }

    return { command, detail: parts.join(' '), severity }
  }

  /* ── Unemployment is the problem ──────────────────────────────────────── */
  if (absJobs > MATERIAL) {
    const slack = jobsGap > 0
    return {
      command: slack
        ? 'Put people back to work.'
        : 'Take the heat out of the labour market.',
      detail:
        `${absJobs.toFixed(1)} points ${slack ? 'above' : 'below'} the sustainable rate. ` +
        (slack
          ? 'Every meeting it stays there is a cohort that does not get hired back.'
          : 'Pay is being bid up, and that arrives in prices two or three meetings later.'),
      severity,
    }
  }

  /* ── Nothing is far out: the order is to hold, and to say why ─────────── */
  const fragility = latent.fragility
  return {
    command: 'Hold the line.',
    detail:
      `Inflation ${absPrice.toFixed(1)} from target, unemployment ${absJobs.toFixed(1)} from sustainable. ` +
      (fragility > 45
        ? 'Calm is where the next crisis is being built — the longer this lasts the larger it lands.'
        : 'Nothing needs fixing. The job is not to break it.'),
    severity,
  }
}
