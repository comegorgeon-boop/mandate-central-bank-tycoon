import type { TutorialProgress } from '../../../simulation/index.ts'

/**
 * The tutorial's goal, and how far along it is.
 *
 * Easy ends when this is met rather than when a clock runs out, so the goal has
 * to be on screen at every meeting: a mode whose ending is an achievement
 * needs the achievement stated, or the player is working toward something they
 * have to infer.
 *
 * Two rows, one per objective, each showing the figure against its bar and
 * whether it is met right now — followed by the count of consecutive meetings
 * both have held, because holding is the part that is easy to forget and the
 * part that turns a lucky quarter into a passed lesson.
 */

function Row({
  label,
  value,
  bar,
  unit,
  met,
}: {
  readonly label: string
  readonly value: number
  readonly bar: number
  readonly unit: string
  readonly met: boolean
}) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-t border-edge py-2 first:border-t-0">
      <span className="flex items-center gap-2 text-sm text-ink">
        <span
          aria-hidden="true"
          className={met ? 'text-good' : 'text-ink-faint'}
        >
          {met ? '✓' : '○'}
        </span>
        {label}
      </span>
      <span className="tabular-nums text-sm">
        <span className={met ? 'font-semibold text-good' : 'font-semibold text-ink'}>
          {value.toFixed(2)} {unit}
        </span>
        <span className="text-ink-soft"> · target below {bar.toFixed(2)}</span>
      </span>
      {/* The state in words, for a reader who cannot see the tick or the
          colour. Both carry the same fact, so neither is load-bearing alone. */}
      <span className="sr-only">{met ? 'Met.' : 'Not yet met.'}</span>
    </li>
  )
}

export function TutorialGoalPanel({
  progress,
}: {
  readonly progress: TutorialProgress
}) {
  const remaining = Math.max(0, progress.meetingsNeeded - progress.meetingsHeld)

  return (
    <section
      aria-labelledby="tutorial-goal-heading"
      className="mt-4 rounded-lg border border-edge bg-panel p-4 text-ink shadow-panel"
    >
      <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-soft">
        What ends this mandate
      </p>
      <h2
        id="tutorial-goal-heading"
        className="mt-1 font-display text-xl font-semibold text-ink"
      >
        Repair the economy, then hold it there
      </h2>

      <ul className="mt-3">
        <Row
          label="Inflation"
          value={progress.inflation}
          bar={progress.inflationBelow}
          unit="%"
          met={progress.inflation < progress.inflationBelow}
        />
        <Row
          label="Unemployment"
          value={progress.unemployment}
          bar={progress.unemploymentBelow}
          unit="%"
          met={progress.unemployment < progress.unemploymentBelow}
        />
      </ul>

      <p className="mt-3 text-sm text-ink">
        {progress.onTarget ? (
          remaining === 0 ? (
            <span className="font-semibold text-good">
              Both held. This is the last meeting of the tutorial.
            </span>
          ) : (
            <>
              Both met, for{' '}
              <span className="font-semibold text-good">
                {progress.meetingsHeld} of {progress.meetingsNeeded}
              </span>{' '}
              consecutive meetings. {remaining} more and the mandate is complete.
            </>
          )
        ) : (
          <>
            Both have to be true at once, and stay true for{' '}
            {progress.meetingsNeeded} consecutive meetings. One good quarter is
            luck; holding it is the job.
          </>
        )}
      </p>

      <p className="mt-2 text-2xs text-ink-faint">
        This mandate has no fixed number of meetings — it ends when the objective
        is reached. If it is still not reached by meeting {progress.maxMeetings},
        it ends anyway.
      </p>
    </section>
  )
}
