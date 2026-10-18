import { Link } from 'react-router-dom'
import { SCENARIOS, SIMULATION_VERSION } from '../simulation/index.ts'

/**
 * What this is, and what it is not.
 *
 * The legal page, written as prose rather than as a wall of disclaimers,
 * because the things it has to say are things a reader actually wants to know:
 * whether the numbers are real, whether anybody is watching them play, and
 * whether any of it is advice. A page that buried those under "all rights
 * reserved" would be meeting a formality and failing the reader.
 *
 * Four claims, and every one of them is a property of the build rather than a
 * promise: no network calls after load, no account, no analytics, no model
 * calls. They are enforced elsewhere — the engine imports nothing that can
 * reach a network, the tooling fails a walk that produces a failed request —
 * and stated here.
 */
export default function AboutPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-10 text-onwood">
      <h1 className="font-display text-2xl font-semibold text-onwood">
        What this is, and what it is not
      </h1>

      <section aria-labelledby="is" className="mt-8">
        <h2 id="is" className="text-sm font-semibold uppercase tracking-wide text-onwood-soft">
          What it is
        </h2>
        <p className="mt-2 text-sm text-onwood-soft">
          An educational simulation of monetary policy, played one meeting at a
          time. The economy underneath is a semi-structural model — a Phillips
          curve, an IS curve, expectations that are partly anchored and partly
          adaptive, a financial block and a labour market — run forward in
          small steps with seeded randomness. The same seed replays the same
          mandate exactly.
        </p>
        <p className="mt-2 text-sm text-onwood-soft">
          Six of the mandates are historical. Their opening states, calendars
          and benchmark paths are taken from published series — the Federal
          Reserve&rsquo;s own FOMC pages, the European Central Bank&rsquo;s own
          decision dates, and the St. Louis Fed&rsquo;s FRED database — and
          every figure that is derived, approximated or set by judgement is
          marked as such in <code>docs/SCENARIOS.md</code>, which a test in
          this repository parses and compares against the code row by row.
          They are {SCENARIOS.map((entry) => entry.title).join(', ')}.
        </p>
      </section>

      <section aria-labelledby="not" className="mt-8">
        <h2 id="not" className="text-sm font-semibold uppercase tracking-wide text-onwood-soft">
          What it is not
        </h2>
        <ul className="mt-2 space-y-2 text-sm text-onwood-soft">
          <li>
            <strong className="text-onwood">Not affiliated with anybody.</strong>{' '}
            Not with the Federal Reserve, the European Central Bank, or any
            other institution, and not endorsed by one. The institutions are
            named because the mandates they are given are genuinely different
            and a game that invented two fictional central banks would have
            taught less.
          </li>
          <li>
            <strong className="text-onwood">Not advice.</strong> Nothing here
            is investment, financial or policy advice. The equity index, the
            newswire and every company in it are fictional and do not track
            anything.
          </li>
          <li>
            <strong className="text-onwood">Not a record of what anyone said.</strong>{' '}
            In the historical mandates, what institutions *did* is in the game
            and what people said is not. There are no quotations and no words
            are put in anybody&rsquo;s mouth — a test forbids quotation marks
            and attribution verbs in that prose outright, because the cost of
            getting one wrong is higher than anything a quotation would add.
            No living politician is named.
          </li>
          <li>
            <strong className="text-onwood">Not a forecast.</strong> The model
            reproduces the shape of several real episodes and misses their
            depth, by amounts that are measured and written down rather than
            glossed over.
          </li>
        </ul>
      </section>

      <section aria-labelledby="privacy" className="mt-8">
        <h2 id="privacy" className="text-sm font-semibold uppercase tracking-wide text-onwood-soft">
          What happens to your data
        </h2>
        <p className="mt-2 text-sm text-onwood-soft">
          Nothing leaves this device. There is no account, no server, no
          analytics and no telemetry, and the game makes no network request at
          all once its files have loaded — the whole simulation runs in your
          browser. Your settings, the mandate you have in progress and your
          records are kept in this browser&rsquo;s own storage and nowhere
          else; clearing your site data clears all three, and nothing is
          recoverable afterwards because there was never a copy.
        </p>
        <p className="mt-2 text-sm text-onwood-soft">
          No part of this game calls a language model. Every sentence it
          produces — the newspapers, the committee&rsquo;s arguments, the
          end-of-mandate report — is assembled locally from fixed templates and
          the run&rsquo;s own numbers, which is why the same seed always
          produces the same words.
        </p>
      </section>

      <p className="mt-10 text-xs text-onwood-faint">
        Simulation engine {SIMULATION_VERSION}. A score is only comparable with
        another score from the same institution, the same difficulty and the
        same engine version.
      </p>

      <p className="mt-6 text-sm">
        <Link to="/" className="text-onwood-soft underline hover:text-onwood">
          Back
        </Link>
      </p>
    </main>
  )
}
