import type { RecordEntry } from '../records/storage.ts'

/**
 * This mandate against the last one you played like it.
 *
 * ## Why this is the only league table the game can have
 *
 * There is no server, no account and no online board — that is the project's
 * first rule — so the only comparison available is against yourself, on this
 * device. That turns out to be the right one anyway: the score means something
 * different in every bucket, and a seeded game whose whole premise is "the
 * same economy, played again" is a game about beating your own last attempt.
 *
 * Compared **inside the bucket and never across it**, the same rule the
 * records page and the scoring have followed since they were written. An easy
 * Fed tutorial and 1929-33 are not two attempts at one problem.
 *
 * ## The ordering trap, which this project has now hit twice
 *
 * `previousBest` is read by the provider at the instant the mandate ends,
 * *before* `recordResult` writes this run into the history — because
 * afterwards the history contains the run being compared, and every mandate
 * reports as having failed to beat itself. The achievements panel hit exactly
 * this and could never mark anything as earned for the first time. It is
 * recorded in `runContext.ts` beside the field, because the field is useless
 * without it.
 */
export function AgainstYourselfPanel({
  banked,
  previousBest,
  bucketLabel,
}: {
  /** What this mandate banked. The score — see `scoring/theScore.ts`. */
  readonly banked: number
  /** The best in this bucket before this run, or null if this is the first. */
  readonly previousBest: RecordEntry | null
  /** What this bucket is called, in the player's words. */
  readonly bucketLabel: string
}) {
  if (previousBest === null) {
    return (
      <p className="mt-6 text-sm text-ink-soft">
        Your first {bucketLabel}. The seed is on the setup screen — the same one
        replays the same economy, which is the only way to find out whether a
        different decision was a better one.
      </p>
    )
  }

  const difference = banked - previousBest.score
  const beaten = difference > 0

  return (
    <section
      aria-labelledby="against-yourself-heading"
      className="mt-6 border-t border-edge pt-4"
    >
      <h2
        id="against-yourself-heading"
        className="text-sm font-semibold uppercase tracking-wide text-ink-soft"
      >
        Against yourself
      </h2>

      <p className="mt-2 text-sm text-ink">
        {beaten ? (
          <>
            <span className="font-semibold text-good-strong">
              A personal best for {bucketLabel}
            </span>{' '}
            — {banked.toLocaleString()} against{' '}
            {previousBest.score.toLocaleString()}, by{' '}
            {Math.abs(difference).toLocaleString()}.
          </>
        ) : difference === 0 ? (
          <>
            Exactly your best for {bucketLabel}:{' '}
            {banked.toLocaleString()}, again.
          </>
        ) : (
          <>
            Your best for {bucketLabel} is{' '}
            <span className="font-semibold tabular-nums text-ink">
              {previousBest.score.toLocaleString()}
            </span>
            , {Math.abs(difference).toLocaleString()} above this one — set on
            seed {previousBest.seed}.
          </>
        )}
      </p>

      <p className="mt-1 text-xs text-ink-faint">
        Kept in this browser and compared only inside this bucket. There is no
        online table: an easy tutorial and a historical mandate are different
        problems, and putting them on one ladder would say they were not.
      </p>
    </section>
  )
}
