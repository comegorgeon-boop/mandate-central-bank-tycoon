import type { EndConditionWarning } from '../../../simulation/index.ts'
import type { StandingReading, StandingTone } from '../standing.ts'

/**
 * How the mandate is going, said out loud, in both directions.
 *
 * This replaces a panel that only ever appeared when something was wrong. A
 * mandate held at target with everyone in work now gets a green plaque naming
 * what is going right, for the same reason the red one names what is going
 * wrong: a player cannot steer by an absence.
 *
 * The severe warnings still take the whole panel when they exist. Nothing
 * about celebrating success should make a mandate four meetings from
 * revocation read as anything other than that.
 *
 * Everything else folds. The verdict is one line and the reasons behind it are
 * one click away, because the reasons are almost entirely restatements of what
 * the three charts underneath already show — "inflation is 1.85 pp above the
 * objective" beside a chart of inflation against the objective is the same
 * fact, told twice, using the vertical space the chart wanted. The tone
 * colouring stays: a verdict you have to open to read is not a verdict.
 */

const TONE_STYLE: Readonly<Record<StandingTone, string>> = {
  thriving: 'border-good bg-good-surface',
  steady: 'border-edge-room bg-room',
  strained: 'border-accent bg-accent-surface',
  critical: 'border-bad bg-bad-surface',
}

/**
 * Text colours, paired to the surface above.
 *
 * `steady` is the only tone that sits on walnut; the other three are light
 * plaques and take ink. Getting this pairing wrong is how an interface ends up
 * with light-on-light text, which is the complaint this whole redesign began
 * with, so the two records are kept adjacent and in the same order.
 */
const TONE_TEXT: Readonly<Record<StandingTone, string>> = {
  thriving: 'text-good-strong',
  steady: 'text-onwood',
  strained: 'text-accent-strong',
  critical: 'text-bad-strong',
}

const TONE_BODY: Readonly<Record<StandingTone, string>> = {
  thriving: 'text-ink',
  steady: 'text-onwood-soft',
  strained: 'text-ink',
  critical: 'text-ink',
}

/**
 * The ✓ and ! markers, paired to the surface for the same reason.
 *
 * A fourth record rather than a hard-coded `text-good`, because the markers
 * were hard-coded and the audit found them at 1.96:1 and 2.28:1 — a danger
 * marker that could not be read on the one tone where danger is the subject.
 * Changing them to the `-onwood` pair fixed three tones and broke the other
 * three in the other direction, at 2.0:1, which is the lesson this file's
 * comment above already states: the surface flips material and the foreground
 * has to flip with it.
 *
 * `-strong` on the three light plaques (8.5:1 to 12.7:1 across both
 * directions), the `-onwood` pair on the one tone that sits on walnut in both
 * (6.1:1). `steady` is the exception here exactly as it is above, and the four
 * records are kept adjacent and in the same order so that it stays visible.
 */
const TONE_MARK_GOOD: Readonly<Record<StandingTone, string>> = {
  thriving: 'text-good-strong',
  steady: 'text-good-onwood',
  strained: 'text-good-strong',
  critical: 'text-good-strong',
}

const TONE_MARK_BAD: Readonly<Record<StandingTone, string>> = {
  thriving: 'text-bad-strong',
  steady: 'text-bad-onwood',
  strained: 'text-bad-strong',
  critical: 'text-bad-strong',
}

export function StandingPanel({
  standing,
  previousTone,
  severeWarnings,
}: {
  readonly standing: StandingReading
  /**
   * The reading at the last meeting, so the panel can tell an improvement
   * from a continuation. Null at the first meeting.
   */
  readonly previousTone: StandingTone | null
  readonly severeWarnings: readonly EndConditionWarning[]
}) {
  const critical = severeWarnings.length > 0
  const reasons = standing.achievements.length + standing.concerns.length

  // The sweep fires when the mandate *turns* good, and never again until it
  // stops being good and turns again. A flourish on every meeting of a decade
  // held at target is wallpaper: it would say "things are well" so often that
  // the one meeting they became well would look identical to the forty after
  // it, which is the opposite of the point.
  const turnedGood =
    !critical &&
    standing.tone === 'thriving' &&
    previousTone !== null &&
    previousTone !== 'thriving'

  return (
    <section
      aria-labelledby="standing-heading"
      // `alert` only when it is one. A green plaque that interrupts a screen
      // reader every meeting to say things are fine is not an improvement.
      role={critical ? 'alert' : undefined}
      className={`animate-rise mt-4 rounded-lg border-l-4 p-3 ${TONE_STYLE[standing.tone]} ${
        standing.tone === 'steady' ? '' : 'shadow-panel'
      } ${turnedGood ? 'animate-sweep' : ''}`}
    >
      <h2
        id="standing-heading"
        className={`font-display text-base font-semibold ${TONE_TEXT[standing.tone]}`}
      >
        {critical ? 'Mandate at risk' : standing.headline}
      </h2>

      {turnedGood && (
        <p className={`mt-0.5 text-sm ${TONE_BODY[standing.tone]}`}>
          It was not, at the last meeting. Whatever you did between them, that
          is what it looks like when it works.
        </p>
      )}

      {critical ? (
        <ul className={`mt-1 list-disc space-y-0.5 pl-5 text-sm ${TONE_BODY[standing.tone]}`}>
          {severeWarnings.map((warning) => (
            <li key={warning.id}>{warning.message}</li>
          ))}
        </ul>
      ) : reasons === 0 ? (
        <p className={`mt-1 text-sm ${TONE_BODY[standing.tone]}`}>
          Nothing is far enough from where it should be to be worth calling out,
          in either direction.
        </p>
      ) : (
        <details className="group mt-0.5">
          <summary
            className={`cursor-pointer list-none text-xs underline decoration-dotted underline-offset-2 marker:content-none ${TONE_BODY[standing.tone]}`}
          >
            {/* "1 going right" is gone, and it was the single clearest
                example of the defect the whole legibility pass is about: a
                tally of descriptions, where the player needed a diagnosis and
                an instruction. The instruction now lives one element below,
                in the order banner; what is left here is the *record* — what
                has been held and what is slipping — and a record is allowed
                to be a list, as long as it is not pretending to be advice.

                Named rather than counted, because "2 to watch" tells you
                there is something to find and not what it is, which is the
                worst of both: the cost of an alarm with the content of a
                footnote. */}
            <span className="group-open:hidden">
              {standing.concerns.length > 0
                ? `Watching: ${standing.concerns.length === 1 ? 'one thing' : `${standing.concerns.length} things`}`
                : 'The record so far'}
            </span>
            <span className="hidden group-open:inline">Close</span>
          </summary>
          {standing.achievements.length > 0 && (
            <ul className={`mt-1.5 space-y-0.5 text-sm ${TONE_BODY[standing.tone]}`}>
              {standing.achievements.map((line) => (
                <li key={line} className="flex gap-2">
                  <span
                    aria-hidden="true"
                    className={TONE_MARK_GOOD[standing.tone]}
                  >
                    ✓
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          )}
          {standing.concerns.length > 0 && (
            <ul className={`mt-1 space-y-0.5 text-sm ${TONE_BODY[standing.tone]}`}>
              {standing.concerns.map((line) => (
                <li key={line} className="flex gap-2">
                  <span
                    aria-hidden="true"
                    className={TONE_MARK_BAD[standing.tone]}
                  >
                    !
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          )}
        </details>
      )}
    </section>
  )
}
