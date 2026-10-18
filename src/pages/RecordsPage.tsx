import { useState } from 'react'
import { Link } from 'react-router-dom'
import { SCENARIOS, getInstitution } from '../simulation/index.ts'
import {
  clearAchievements,
  clearRecords,
  readAchievements,
  readRecords,
  type RecordEntry,
} from '../features/records/storage.ts'
import { ACHIEVEMENTS } from '../features/records/achievements.ts'

/**
 * Every finished mandate this browser remembers.
 *
 * ## Grouped, never ranked
 *
 * The page's one real design decision, and it is the same one the scoring has
 * made since it was written: **a bucket is the only comparable thing.** An
 * easy Fed tutorial, an ECB hard mandate and 1929-33 are not three attempts at
 * one problem, and a single table sorted by score would put them on one ladder
 * and teach the opposite of what the game is about. So mandates are grouped by
 * what they were, and within a group they are ranked.
 *
 * ## And honest about where it lives
 *
 * In this browser. There is no account, no server and no online table — that
 * is the project's first rule — so clearing site data clears these, and the
 * page says so in those words rather than implying a permanence it cannot
 * provide.
 */

function label(entry: RecordEntry): string {
  if (entry.scenario !== null) {
    return SCENARIOS.find((s) => s.id === entry.scenario)?.title ?? entry.scenario
  }
  const institution = getInstitution(entry.institution).shortName
  return `${institution}, ${entry.difficulty}`
}

function when(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

export default function RecordsPage() {
  const [records, setRecords] = useState(() => readRecords())
  const [earned, setEarned] = useState(() => readAchievements())

  const groups = new Map<string, RecordEntry[]>()
  for (const entry of records) {
    const list = groups.get(entry.bucket) ?? []
    list.push(entry)
    groups.set(entry.bucket, list)
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-10 text-onwood">
      <h1 className="font-display text-2xl font-semibold text-onwood">Records</h1>
      <p className="mt-2 text-sm text-onwood-soft">
        Finished mandates, grouped by what they were. Scores are only
        comparable inside a group: an easy tutorial and 1929-33 are different
        problems and putting them on one ladder would say they were not.
      </p>

      {groups.size === 0 ? (
        <p className="mt-8 text-sm text-onwood-soft">
          Nothing finished yet.{' '}
          <Link to="/play/setup" className="underline hover:text-onwood">
            Start a mandate
          </Link>
          .
        </p>
      ) : (
        <div className="mt-8 space-y-8">
          {[...groups.entries()].map(([bucket, entries]) => (
            <section key={bucket} aria-label={label(entries[0])}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-onwood-soft">
                {label(entries[0])}
              </h2>
              <ol className="mt-2 space-y-2">
                {[...entries]
                  .sort((a, b) => b.score - a.score)
                  .map((entry) => (
                    <li
                      key={`${entry.finishedAt}-${entry.seed}`}
                      className="flex flex-wrap items-baseline justify-between gap-x-4 border-t border-edge-room pt-2 text-sm"
                    >
                      <span className="text-onwood-soft">
                        {entry.outcomeLabel} · {entry.meetingsServed} of{' '}
                        {entry.meetingCount} meetings · seed {entry.seed}
                        <span className="ml-2 text-onwood-faint">
                          {when(entry.finishedAt)}
                        </span>
                      </span>
                      <span className="tabular-nums font-semibold text-onwood">
                        {entry.score}
                      </span>
                    </li>
                  ))}
              </ol>
            </section>
          ))}
        </div>
      )}

      <section aria-labelledby="achievements-heading" className="mt-12">
        <h2
          id="achievements-heading"
          className="text-sm font-semibold uppercase tracking-wide text-onwood-soft"
        >
          Achievements
        </h2>
        <p className="mt-1 text-sm text-onwood-soft">
          {Object.keys(earned).length} of {ACHIEVEMENTS.length}. None of
          these is scored —
          the score is the score — and one of them is not a virtue.
        </p>
        <ul className="mt-3 space-y-2">
          {ACHIEVEMENTS.map((achievement) => {
            const got = earned[achievement.id] !== undefined
            return (
              <li
                key={achievement.id}
                className="border-t border-edge-room pt-2 text-sm"
              >
                <span
                  className={got ? 'font-medium text-onwood' : 'text-onwood-faint'}
                >
                  {achievement.name}
                </span>
                {got && (
                  <span className="ml-2 text-2xs uppercase tracking-wide text-accent-onwood">
                    {when(earned[achievement.id])}
                  </span>
                )}
                <span
                  className={`mt-0.5 block text-xs ${
                    got ? 'text-onwood-soft' : 'text-onwood-faint'
                  }`}
                >
                  {achievement.note}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <p className="mt-10 text-xs text-onwood-faint">
        Kept in this browser only. Clearing your site data clears them, and
        they are not sent anywhere — this build makes no network call once it
        has loaded.
      </p>

      <div className="mt-6 flex flex-wrap gap-4 text-sm">
        <Link to="/" className="text-onwood-soft underline hover:text-onwood">
          Back
        </Link>
        {(records.length > 0 || Object.keys(earned).length > 0) && (
          <button
            type="button"
            onClick={() => {
              clearRecords()
              clearAchievements()
              setRecords([])
              setEarned({})
            }}
            className="text-onwood-faint underline hover:text-onwood"
          >
            Forget all of this
          </button>
        )}
      </div>
    </main>
  )
}
