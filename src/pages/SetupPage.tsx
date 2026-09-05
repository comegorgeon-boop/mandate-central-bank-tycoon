import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  MEETING_COUNT,
  getInstitution,
  type Difficulty,
  type Institution,
} from '../simulation/index.ts'
import { useRun } from '../features/game/runContext.ts'
import { MAX_SEED_LENGTH, randomSeed, sanitizeSeed } from '../features/game/seed.ts'

/**
 * Run setup.
 *
 * All three difficulties are selectable. They are not three settings of one
 * dial: each is a different decision problem, and what separates them most is
 * the *kind* of shock it serves. Easy is where you learn the instrument works,
 * on problems that have a right answer; medium is where the two halves of the
 * mandate first pull against each other; hard is the real job.
 *
 * The copy below says that, rather than listing multipliers, because the
 * multipliers are not the choice the player is making.
 */

const DIFFICULTY_COPY: Readonly<
  Record<Difficulty, { readonly name: string; readonly summary: string }>
> = {
  easy: {
    name: 'Easy',
    summary:
      'The mode where you learn that the instrument works. Demand shocks in a ' +
      'large majority — the kind a rate move addresses whole — with supply shocks ' +
      'rare, moderate and never landing on top of one another. The rate and ' +
      'forward guidance. The shock is named, the evidence is laid out, and the ' +
      'staff advice is reliable.',
  },
  medium: {
    name: 'Medium',
    summary:
      'The mode where you meet the trade-off. The first real supply shock, and ' +
      'the conflict between the two halves of the mandate. The balance sheet and ' +
      'the refinancing facilities open. The evidence is still shown but the shock ' +
      'is no longer named, and the staff can be wrong.',
  },
  hard: {
    name: 'Hard',
    summary:
      'The real job. Stagflation, shocks that pile onto one another, ' +
      'expectations that come unanchored, and tail risks. The full toolkit, and ' +
      'a statement whose tone you choose — so you can say one thing and do ' +
      'another, at a price. Nothing is named, nothing is read for you, and no ' +
      'recommendation is put to you: the committee argues and you decide.',
  },
}

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard']
const INSTITUTIONS: readonly Institution[] = ['fed', 'ecb']

export default function SetupPage() {
  const navigate = useNavigate()
  const { begin } = useRun()
  const [seed, setSeed] = useState(randomSeed)
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [institution, setInstitution] = useState<Institution>('fed')

  const trimmed = sanitizeSeed(seed)

  const start = (): void => {
    if (trimmed.length === 0) return
    begin({ institution, difficulty, seed: trimmed })
    navigate('/play/briefing')
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-8 text-neutral-200">
      <h1 className="text-2xl font-semibold text-neutral-50">Set up your mandate</h1>
      <p className="mt-2 text-sm text-neutral-400">
        A simplified fictional simulation of monetary policy. Not affiliated with, and
        not an official product of, any central bank.
      </p>

      <fieldset className="mt-8">
        <legend className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
          Institution
        </legend>
        <p className="mt-1 text-sm text-neutral-400">
          The mandate you serve, and therefore what you are judged on.
        </p>
        <div className="mt-2 flex flex-col gap-2">
          {INSTITUTIONS.map((id) => {
            const selected = id === institution
            const config = getInstitution(id)
            return (
              <button
                key={id}
                type="button"
                aria-pressed={selected}
                onClick={() => setInstitution(id)}
                className={`rounded border p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400 ${
                  selected
                    ? 'border-neutral-300 bg-neutral-800'
                    : 'border-neutral-700 bg-neutral-900 hover:bg-neutral-800'
                }`}
              >
                <span
                  className={`font-medium ${selected ? 'text-neutral-50' : 'text-neutral-100'}`}
                >
                  {config.name}
                </span>
                <span className="mt-1 block text-sm text-neutral-400">
                  {config.mandateSummary}
                </span>
              </button>
            )
          })}
        </div>
      </fieldset>

      <fieldset className="mt-6">
        <legend className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
          Difficulty
        </legend>
        <p className="mt-1 text-sm text-neutral-400">
          Not three settings of one dial. Each serves a different kind of problem.
        </p>
        <div className="mt-2 flex flex-col gap-2">
          {DIFFICULTIES.map((id) => {
            const selected = id === difficulty
            const copy = DIFFICULTY_COPY[id]
            return (
              <button
                key={id}
                type="button"
                aria-pressed={selected}
                onClick={() => setDifficulty(id)}
                className={`rounded border p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400 ${
                  selected
                    ? 'border-neutral-300 bg-neutral-800'
                    : 'border-neutral-700 bg-neutral-900 hover:bg-neutral-800'
                }`}
              >
                <span
                  className={`font-medium ${selected ? 'text-neutral-50' : 'text-neutral-100'}`}
                >
                  {copy.name} — {MEETING_COUNT[id]} scheduled meetings
                </span>
                <span className="mt-1 block text-sm text-neutral-400">
                  {copy.summary}
                </span>
              </button>
            )
          })}
        </div>
      </fieldset>

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
