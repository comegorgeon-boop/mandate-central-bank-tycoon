import type { RunConfig } from '../types/core.ts'
import { getInstitution } from '../config/institutions.ts'
import { SUBSTEPS_PER_MEETING } from '../config/time.ts'
import { buildLagKernel } from '../engine/lags.ts'
import { tenureSentence } from './tenureCopy.ts'

/**
 * What the player is trying to do, in five lines.
 *
 * ## Why this exists
 *
 * > "J'ai fait tester à quelqu'un qui n'y connaît rien : il m'a demandé en
 * > boucle « c'est quoi le but, qu'est-ce que je dois faire ». Les trois
 * > réunions guidées ne règlent pas ça, parce qu'elles guident la DÉCISION et
 * > pas la DIRECTION."
 *
 * The distinction is the whole specification. The guided opening, the order
 * line, the consequence copy under the dial — everything this project has
 * built for legibility answers *what should I do with this number*. None of it
 * answers *what am I for*. A player who knows at every meeting which way to
 * move the rate and never learns what the rate is being moved toward has been
 * given a very good interface to a game they are not playing.
 *
 * So: direction, never decisions. Each line below says what is being aimed at
 * or what the instrument does. **None of them says what rate to set**, and a
 * later pass adding one would be rebuilding the thing this replaces.
 *
 * ## Short, deliberately
 *
 * > "Court. Pas dix écrans — l'essentiel tient en quelques lignes, et c'est
 * > leur absence qui perd tout le monde."
 *
 * Five points, one or two sentences each. The constraint is doing real work:
 * the mandate asymmetry alone could fill a page, and the version that fits in
 * two sentences is the version somebody reads.
 *
 * ## Derived, never written twice
 *
 * Every figure here comes from the configuration that produces it — the
 * objective from `INSTITUTIONS`, the lag from `LAG_KERNEL`, the term from
 * `TENURE` through `tenureSentence`. This project has shipped the same
 * quantity stated in three places that agreed with each other and disagreed
 * with the model, and an orientation screen is the worst possible place for
 * that: it is the one text a player takes on trust.
 */

export interface OrientationPoint {
  /** Two or three words, for the heading. */
  readonly title: string
  /** One or two sentences. Direction, never a decision. */
  readonly body: string
}

/**
 * How many meetings until a rate change bites hardest.
 *
 * **Read off the kernel the engine actually convolves**, not off
 * `LAG_KERNEL.peakSubsteps`. The first version divided that constant by the
 * sub-steps per meeting and rounded, which gave *4* where the briefing's own
 * "how policy acts" panel — computed from the built kernel — said *3.5*. Two
 * numbers for the same lag, on the same screen, three inches apart: the defect
 * this project has recorded as "one quantity stated in two places, agreeing
 * with each other and disagreeing with the model", arriving in the one text a
 * player takes entirely on trust.
 *
 * `peakSubsteps` is the kernel's *parameter*; where the kernel actually peaks
 * is a fact about the kernel.
 */
export function lagInMeetings(config: RunConfig): number {
  const kernel = buildLagKernel(config.difficulty)
  let peak = 0
  for (let index = 1; index < kernel.length; index += 1) {
    if (kernel[index] > kernel[peak]) peak = index
  }
  return (peak + 1) / SUBSTEPS_PER_MEETING
}

export function orientation(config: RunConfig): readonly OrientationPoint[] {
  const institution = getInstitution(config.institution)
  const fed = config.institution === 'fed'
  const target = institution.inflationTarget.toFixed(1)
  const lag = lagInMeetings(config)

  return [
    {
      title: 'You hold a mandate',
      body:
        `You are the ${fed ? 'Chair of the Federal Reserve' : 'President of the European Central Bank'}. ` +
        'You do not run the economy and you do not pass budgets. You hold one ' +
        'instrument and a set of objectives somebody else wrote, and your job is ' +
        'to meet them with it.',
    },
    {
      /*
       * **The asymmetry, which the player named as one of the most important
       * things in the game.** It is also the only place the two institutions
       * differ in what *winning* means, so stating it vaguely would make the
       * two mandates feel like a reskin.
       *
       * The wording tracks the law rather than paraphrasing it loosely. The
       * Federal Reserve Act directs the Board to promote "maximum employment,
       * stable prices, and moderate long-term interest rates"; the two the
       * game scores are coequal and the Fed says so. Article 127(1) TFEU reads
       * "The primary objective of the ESCB shall be to maintain price
       * stability. Without prejudice to the objective of price stability, the
       * ESCB shall support the general economic policies in the Union" — and
       * *without prejudice to* is the operative phrase, which is why it is
       * quoted rather than smoothed into "less important".
       */
      title: 'What it requires of you',
      body: fed
        ? `Two objectives, equal in law. Inflation at ${target} %, and employment ` +
          'at the highest level this economy can sustain without prices running ' +
          'away. Neither comes first, so when they pull in opposite directions ' +
          'nobody can tell you which to drop — that is the job.'
        : `One objective comes first: price stability, inflation at ${target} %. ` +
          'Employment and growth matter and are pursued “without prejudice to” ' +
          'it, which is the Treaty’s phrase and means exactly what it says — ' +
          'support them where you can, never instead. When they conflict, prices win.',
    },
    {
      /*
       * The lag, which is the single most important fact about the instrument
       * and the one no amount of per-meeting guidance conveys: a player who
       * does not know it reads every meeting as a failure of the last decision.
       */
      title: 'What your instrument does, and when',
      body:
        'You set one interest rate. It reaches borrowing, spending and then ' +
        `prices — but not today: a change made now lands hardest about ${lag} ` +
        `meetings from now. You are not setting today’s inflation. You are ` +
        'setting the inflation of several meetings’ time, and the last few ' +
        'decisions are still arriving while you make this one.',
    },
    {
      title: 'How it ends',
      body: `${tenureSentence(config)} Nobody hands you a target score — what ` +
        'you are playing for is to still be here, having held the objectives, ' +
        'for as long as you can.',
    },
    {
      /*
       * Last, because it is the one that changes how the other four are read:
       * every number on every screen is an estimate. Stated as the difficulty
       * rather than as a disclaimer — it is the actual decision problem, and
       * `observation/` exists to produce it.
       */
      title: 'And the hard part',
      body:
        'You will never see the economy as it is, only as it was measured: ' +
        'late, with error, and revised after you have acted on it. Every ' +
        'decision here is taken on a figure that is already out of date. That ' +
        'is not a simulation artefact — it is the problem the job consists of.',
    },
  ]
}

/**
 * The one-line answer to "what am I trying to do", for the standing affordance.
 *
 * > "Mon ami n'a pas posé la question une fois, il l'a posée en boucle."
 *
 * So the full orientation stays one gesture away at every meeting, and this is
 * the line on the control that opens it. It names the objective rather than
 * the current gap, because the gap is already on three gauges and the question
 * being answered is the other one.
 */
export function aimLine(config: RunConfig): string {
  const institution = getInstitution(config.institution)
  const target = institution.inflationTarget.toFixed(1)
  return config.institution === 'fed'
    ? `Inflation to ${target} % and people in work, equally.`
    : `Price stability first: inflation to ${target} %.`
}
