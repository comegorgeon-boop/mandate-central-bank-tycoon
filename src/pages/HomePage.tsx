import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  MEETING_COUNT,
  SCENARIOS,
  getInstitution,
} from '../simulation/index.ts'
import { useRun } from '../features/game/runContext.ts'
import { bestByBucket, loadSave, type SavedRun } from '../features/records/storage.ts'

/**
 * The front door.
 *
 * It used to be a title, one sentence about chairing the Federal Reserve for
 * twelve meetings, and a button — written when twelve meetings was the whole
 * game. It now has seven historical mandates behind it and a mandate in
 * progress to come back to, and a front door that mentions neither is lying
 * about what is through it.
 *
 * Three things, in the order a visitor needs them: **carry on** if there is
 * something to carry on with, **start** if there is not, and **what this is**
 * for somebody deciding whether to. Everything else — the glossary, the
 * records, the legal page — is a line of links at the bottom, because a front
 * page that leads with its own footer is a brochure.
 *
 * Read once, at mount. A save written in another tab is not watched for: the
 * interesting failure is two tabs playing two mandates into one save slot, and
 * the honest answer to that is the last confirmed decision wins, not a page
 * that reshuffles itself underneath a reader.
 */

/**
 * A small count, spelled out.
 *
 * Because the heading above the scenario list said "Six that happened" over a
 * list rendered from `SCENARIOS` — so the moment a seventh was added the page
 * contradicted itself in two adjacent lines. A number that is *derived* from
 * the same array as the thing it counts cannot do that. Falls back to digits
 * above twelve, which is where spelling out stops helping anyway.
 */
function countWord(n: number): string {
  const words = [
    'None', 'One', 'Two', 'Three', 'Four', 'Five', 'Six',
    'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  ]
  return words[n] ?? String(n)
}

export default function HomePage() {
  const navigate = useNavigate()
  const { resume } = useRun()
  const [saved] = useState<SavedRun | null>(() => loadSave()?.save ?? null)
  const [best] = useState(() => bestByBucket())
  const [error, setError] = useState<string | null>(null)

  const carryOn = (): void => {
    const result = resume()
    if (result.ok) {
      navigate('/play/briefing')
      return
    }
    setError(result.error)
  }

  const savedLabel =
    saved === null
      ? null
      : saved.scenario !== null
        ? (SCENARIOS.find((entry) => entry.id === saved.scenario)?.title ?? saved.scenario)
        : `${getInstitution(saved.institution).shortName}, ${saved.difficulty}`

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-12 text-onwood">
      <h1 className="font-display text-3xl font-bold text-onwood">
        Mandate: Central Bank Tycoon
      </h1>
      <p className="mt-3 text-base text-onwood-soft">
        You chair a central bank. You set one rate, you say one thing about it,
        and you answer for the whole path of the economy at the end. The
        instrument works and it works slowly, which is the entire problem.
      </p>

      {saved !== null && (
        <section
          aria-labelledby="resume-heading"
          className="mt-8 rounded-lg border-l-4 border-edge-accent bg-inset p-4"
        >
          <h2
            id="resume-heading"
            className="text-2xs font-semibold uppercase tracking-[0.14em] text-onwood-faint"
          >
            A mandate in progress
          </h2>
          <p className="mt-1 text-sm text-onwood">
            {savedLabel} · seed {saved.seed} · {saved.meetingsServed} meeting
            {saved.meetingsServed === 1 ? '' : 's'} served.
          </p>
          <button
            type="button"
            onClick={carryOn}
            className="mt-3 rounded-md border border-edge-accent bg-accent px-4 py-2 text-sm font-semibold text-on-accent shadow-panel transition-colors hover:bg-accent-onwood"
          >
            Carry on
          </button>
          {error !== null && (
            <p role="alert" className="mt-2 text-xs text-bad-onwood">
              {error}
            </p>
          )}
        </section>
      )}

      {/* `data-start`, for the tests and the browser tools. Matching on the
          label would break the moment the label changed, which it just did —
          it was "Play now" for the whole of this project until this page was
          rewritten, and three tests and the driver were matching on it. */}
      <Link
        data-start="true"
        to="/play/setup"
        className={`${saved === null ? 'mt-8' : 'mt-4'} inline-block self-start rounded-md border ${
          saved === null
            ? 'border-edge-accent bg-accent px-4 py-2 text-sm font-semibold text-on-accent shadow-panel hover:bg-accent-onwood'
            : 'border-edge-room px-4 py-2 text-sm text-onwood hover:bg-inset'
        } transition-colors`}
      >
        {saved === null ? 'Start a mandate' : 'Start a new one instead'}
      </Link>

      <section aria-labelledby="what-heading" className="mt-10">
        <h2 id="what-heading" className="text-sm font-semibold uppercase tracking-wide text-onwood-soft">
          Two kinds of mandate
        </h2>
        <dl className="mt-3 space-y-3 text-sm">
          <div>
            <dt className="font-medium text-onwood">An invented economy</dt>
            <dd className="text-onwood-soft">
              A seeded world, an institution you pick, and a difficulty that is
              not a damage multiplier: easy serves problems with a right answer
              over {MEETING_COUNT.easy} meetings, medium is where the two halves
              of the mandate start pulling against each other, and hard is made
              of the problems that have no right answer.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-onwood">
              {countWord(SCENARIOS.length)} that happened
            </dt>
            <dd className="text-onwood-soft">
              {SCENARIOS.map((entry) => entry.title).join(', ')}. There is no
              difficulty to choose on these: difficulty is what was known at the
              time, and it was different in every year because the statistical
              system was. Every opening figure is sourced, and what is
              approximated says so.
            </dd>
          </div>
        </dl>
      </section>

      {best.size > 0 && (
        <section aria-labelledby="best-heading" className="mt-10">
          <h2 id="best-heading" className="text-sm font-semibold uppercase tracking-wide text-onwood-soft">
            Your best, on this device
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {[...best.values()]
              .sort((a, b) => b.score - a.score)
              .slice(0, 4)
              .map((entry) => (
                <li key={entry.bucket} className="flex justify-between gap-4">
                  <span className="text-onwood-soft">
                    {entry.scenario !== null
                      ? (SCENARIOS.find((s) => s.id === entry.scenario)?.title ??
                        entry.scenario)
                      : `${getInstitution(entry.institution).shortName}, ${entry.difficulty}`}
                  </span>
                  <span className="tabular-nums text-onwood">{entry.score}</span>
                </li>
              ))}
          </ul>
          <p className="mt-2 text-xs text-onwood-faint">
            Kept in this browser and nowhere else — there is no account and no
            online table. Scores from different mandates are not comparable and
            are never put on one ladder.{' '}
            <Link to="/records" className="underline hover:text-onwood">
              All of them
            </Link>
            .
          </p>
        </section>
      )}

      <nav aria-label="About this game" className="mt-12 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link to="/glossary" className="text-onwood-soft underline hover:text-onwood">
          Glossary
        </Link>
        <Link to="/records" className="text-onwood-soft underline hover:text-onwood">
          Records
        </Link>
        <Link to="/about" className="text-onwood-soft underline hover:text-onwood">
          What this is, and what it is not
        </Link>
      </nav>

      <p className="mt-6 text-xs text-onwood-faint">
        An educational simulation. The economies are models and the newswire is
        fiction. Not investment advice, and not affiliated with the Federal
        Reserve, the European Central Bank or any other institution.
      </p>
    </main>
  )
}
