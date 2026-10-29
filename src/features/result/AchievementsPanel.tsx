import { useEffect, useMemo, useState } from 'react'
import { theScore, type RunSession, type ScoreBreakdown } from '../../simulation/index.ts'
import { ACHIEVEMENTS, earnedBy } from '../records/achievements.ts'
import {
  readAchievements,
  recordAchievements,
  scenariosCompleted,
} from '../records/storage.ts'

/**
 * What this mandate was remembered for.
 *
 * Shown on the result screen, below the written account, and deliberately
 * small: a row of what this run earned, with the ones it earned *for the first
 * time* marked. A grid of grey locked boxes listing everything not yet done
 * would turn the end of a mandate into a checklist, which is the opposite of
 * what the report is for.
 *
 * The full list, earned and not, lives on the records page.
 *
 * ## Why `beatTheStandard` is computed here
 *
 * Because this is where the historical comparison already exists. The provider
 * records achievements when the mandate ends, before any replay has been run,
 * so it passes `false` for that one; this panel knows the answer and records
 * the difference. A player who only ever sees the result screen — which is
 * everybody, since it is where the game sends them — gets it either way.
 */
export function AchievementsPanel({
  session,
  score,
  beatTheStandard,
}: {
  readonly session: RunSession
  readonly score: ScoreBreakdown
  /** Whether this mandate scored above the path history took. */
  readonly beatTheStandard: boolean
}) {
  // What this device knew before this mandate was scored, snapshotted once.
  // A lazy initialiser rather than a read inside the memo: the memo also
  // writes, and a read that re-ran after its own write would find everything
  // already earned and mark nothing as new.
  const [before] = useState(readAchievements)

  const earned = useMemo(
    () =>
      earnedBy({
        state: session.state,
        decisions: session.decisions,
        score,
        banked: theScore(session.state).total,
        outcome: session.outcome.triggered ?? 'mandate_completed',
        beatTheStandard,
        scenariosCompleted: scenariosCompleted(),
      }),
    [session, score, beatTheStandard],
  )

  // The write is an effect, not part of the memo. Memoised values are
  // recomputed whenever React feels like it — twice per render under
  // StrictMode — and a store that is written from inside one is a store
  // written an unpredictable number of times.
  useEffect(() => {
    recordAchievements(earned)
  }, [earned])

  const fresh = new Set(earned.filter((id) => before[id] === undefined))

  if (earned.length === 0) return null

  return (
    <section aria-labelledby="earned-heading" className="mt-10">
      <h2
        id="earned-heading"
        className="text-sm font-semibold uppercase tracking-wide text-ink-soft"
      >
        What this one is remembered for
      </h2>
      <ul className="mt-3 space-y-2">
        {ACHIEVEMENTS.filter((achievement) => earned.includes(achievement.id)).map(
          (achievement) => (
            <li
              key={achievement.id}
              className="border-t border-edge pt-2 text-sm"
            >
              <span className="font-medium text-ink">{achievement.name}</span>
              {fresh.has(achievement.id) && (
                <span className="ml-2 rounded-sm border border-edge-accent px-1 py-px text-2xs uppercase tracking-wide text-accent-strong">
                  first time
                </span>
              )}
              <span className="mt-0.5 block text-xs text-ink-faint">
                {achievement.note}
              </span>
            </li>
          ),
        )}
      </ul>
    </section>
  )
}
