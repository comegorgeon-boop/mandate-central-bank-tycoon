import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MEETING_COUNT, getInstitution } from '../simulation/index.ts'
import { useRun } from '../features/game/runContext.ts'
import { MAX_SEED_LENGTH, randomSeed, sanitizeSeed } from '../features/game/seed.ts'

/**
 * Run setup.
 *
 * This build ships the Federal Reserve at easy difficulty only. Both choices
 * are shown as fixed rather than hidden, so the shape of the finished screen
 * is already visible.
 */
export default function SetupPage() {
  const navigate = useNavigate()
  const { begin } = useRun()
  const [seed, setSeed] = useState(randomSeed)

  const fed = getInstitution('fed')
  const trimmed = sanitizeSeed(seed)

  const start = (): void => {
    if (trimmed.length === 0) return
    begin({ institution: 'fed', difficulty: 'easy', seed: trimmed })
    navigate('/play/briefing')
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-8 text-neutral-200">
      <h1 className="text-2xl font-semibold text-neutral-50">Set up your mandate</h1>
      <p className="mt-2 text-sm text-neutral-400">
        A simplified fictional simulation of monetary policy. Not affiliated with, and
        not an official product of, any central bank.
      </p>

      <section className="mt-8" aria-labelledby="institution-heading">
        <h2 id="institution-heading" className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
          Institution
        </h2>
        <div className="mt-2 rounded border border-neutral-700 bg-neutral-900 p-3">
          <p className="font-medium text-neutral-100">{fed.name}</p>
          <p className="mt-1 text-sm text-neutral-400">{fed.mandateSummary}</p>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          The European Central Bank is not part of this build.
        </p>
      </section>

      <section className="mt-6" aria-labelledby="difficulty-heading">
        <h2 id="difficulty-heading" className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
          Difficulty
        </h2>
        <div className="mt-2 rounded border border-neutral-700 bg-neutral-900 p-3">
          <p className="font-medium text-neutral-100">
            Easy — {MEETING_COUNT.easy} scheduled meetings
          </p>
          <p className="mt-1 text-sm text-neutral-400">
            A one-year training mandate. The policy rate is the only instrument,
            indicators are mostly timely and accurate, shocks are mild, and the
            estimated direction of each decision is explained on the desk.
          </p>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Medium and hard are not part of this build.
        </p>
      </section>

      <section className="mt-6" aria-labelledby="seed-heading">
        <h2 id="seed-heading" className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
          Scenario seed
        </h2>
        <p className="mt-1 text-sm text-neutral-400">
          The seed generates the economy. The same seed always produces the same run.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="seed-input">
            Scenario seed
          </label>
          <input
            id="seed-input"
            value={seed}
            maxLength={MAX_SEED_LENGTH}
            onChange={(event) => setSeed(sanitizeSeed(event.target.value))}
            className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-3 py-2 font-mono text-sm text-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
          />
          <button
            type="button"
            onClick={() => setSeed(randomSeed())}
            className="rounded border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
          >
            Random seed
          </button>
        </div>
        {trimmed.length === 0 && (
          <p className="mt-2 text-xs text-amber-400">
            Enter a seed of at least one letter or digit.
          </p>
        )}
      </section>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={start}
          disabled={trimmed.length === 0}
          className="rounded border border-neutral-300 bg-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
        >
          Start the mandate
        </button>
        <Link to="/" className="text-sm text-neutral-400 underline hover:text-neutral-200">
          Back
        </Link>
      </div>

      <p className="mt-8 text-xs text-neutral-600">
        This build keeps no local records and does not save runs. Reloading the page
        during a mandate ends it.
      </p>
    </main>
  )
}
