import { getDoctrine } from '../../simulation/index.ts'
import { ranked, type Scoreboard } from '../game/doctrineScoreboard.ts'

/**
 * The running record of who has been right.
 *
 * The part that turns ten positions into an education. Reading that the
 * monetarist believes in long and variable lags teaches a sentence; watching
 * the monetarist be right two meetings in three through a demand cycle and
 * wrong two in three through a supply shock teaches what the sentence is
 * *for*, and which regime it belongs to.
 *
 * Every entry is settled by counterfactual and not by opinion — the same
 * world, the same shocks, that one meeting taken the school's way, judged four
 * meetings later on the mandate's own loss. See `game/doctrineScoreboard.ts`.
 *
 * Deliberately small and deliberately behind the argument: it is a record, and
 * a record belongs under the thing it is a record of.
 */
export function ScoreboardPanel({ board }: { readonly board: Scoreboard }) {
  const records = ranked(board)
  if (records.length === 0) return null

  return (
    <section aria-labelledby="scoreboard-heading" className="mt-4 border-t border-edge pt-3">
      <h3
        id="scoreboard-heading"
        className="text-2xs font-semibold uppercase tracking-[0.12em] text-ink-faint"
      >
        Who has been right
      </h3>

      <ul className="mt-1.5 space-y-1">
        {records.map((record) => {
          const share = record.right / record.tested
          return (
            <li
              key={record.doctrine}
              className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm"
            >
              <span className="text-ink-soft">
                {getDoctrine(record.doctrine).name}
              </span>
              <span className="tabular-nums">
                <span
                  className={
                    share >= 0.6
                      ? 'font-medium text-good-strong'
                      : share <= 0.4
                        ? 'text-ink-faint'
                        : 'text-ink'
                  }
                >
                  {record.right} of {record.tested}
                </span>
                {record.agreed > 0 && (
                  <span className="ml-2 text-2xs text-ink-faint">
                    agreed with you {record.agreed}×
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ul>

      <p className="mt-2 text-2xs text-ink-faint">
        Counted only where a school disagreed with you: its meeting replayed
        with that one rate changed, the same shocks, and judged four meetings
        later on the mandate&rsquo;s own loss. A school you always follow has
        your record, not one of its own.
      </p>
    </section>
  )
}
