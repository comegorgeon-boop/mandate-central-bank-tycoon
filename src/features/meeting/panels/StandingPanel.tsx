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

export function StandingPanel({
  standing,
  severeWarnings,
}: {
  readonly standing: StandingReading
  readonly severeWarnings: readonly EndConditionWarning[]
}) {
  const critical = severeWarnings.length > 0
  const reasons = standing.achievements.length + standing.concerns.length

  return (
    <section
      aria-labelledby="standing-heading"
      // `alert` only when it is one. A green plaque that interrupts a screen
      // reader every meeting to say things are fine is not an improvement.
      role={critical ? 'alert' : undefined}
      className={`mt-4 rounded-lg border-l-4 p-3 ${TONE_STYLE[standing.tone]} ${
        standing.tone === 'steady' ? '' : 'shadow-panel'
      }`}
    >
      <h2
        id="standing-heading"
        className={`font-display text-base font-semibold ${TONE_TEXT[standing.tone]}`}
      >
        {critical ? 'Mandate at risk' : standing.headline}
      </h2>

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
            <span className="group-open:hidden">
              {standing.achievements.length > 0 &&
                `${standing.achievements.length} going right`}
              {standing.achievements.length > 0 && standing.concerns.length > 0 && ', '}
              {standing.concerns.length > 0 &&
                `${standing.concerns.length} to watch`}
            </span>
            <span className="hidden group-open:inline">Close</span>
          </summary>
          {standing.achievements.length > 0 && (
            <ul className={`mt-1.5 space-y-0.5 text-sm ${TONE_BODY[standing.tone]}`}>
              {standing.achievements.map((line) => (
                <li key={line} className="flex gap-2">
                  <span aria-hidden="true" className="text-good">
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
                  <span aria-hidden="true" className="text-bad">
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
