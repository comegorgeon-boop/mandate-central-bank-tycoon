import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { MAX_SCORE, getInstitution } from '../simulation/index.ts'
import { LineChart, type ChartSeries } from '../components/LineChart.tsx'
import { useRun } from '../features/game/runContext.ts'
import { buildMandateReport } from '../features/result/report.ts'

/**
 * The post-mandate report.
 *
 * The run is over, so this screen is allowed to show the realised path of the
 * true economy rather than the published statistics the player was working
 * from. That difference is itself part of the lesson.
 *
 * The written account leads, directly under the header: what happened, what
 * went well, what went wrong, why the score is what it is. The score and its
 * component breakdown come after, as the Scorecard — support for the
 * narrative, not the headline.
 */
export default function ResultPage() {
  const { runId } = useParams()
  const navigate = useNavigate()
  const { finished, begin } = useRun()

  if (finished === null) return <Navigate to="/play/setup" replace />
  if (runId !== finished.runId) {
    return <Navigate to={`/play/result/${finished.runId}`} replace />
  }

  const { session, score } = finished
  const { config } = session.state
  const institution = getInstitution(config.institution)
  const outcome = session.outcome
  const history = session.state.history
  const meetingsServed = session.state.meetingIndex
  const report = buildMandateReport(session.state, outcome, score)

  const line = (
    label: string,
    read: (index: number) => number,
    className: string,
    dash?: string,
  ): ChartSeries => ({
    label,
    values: history.map((_, index) => read(index)),
    className,
    dash,
  })

  const replaySameSeed = (): void => {
    begin({
      institution: config.institution,
      difficulty: config.difficulty,
      seed: config.seed,
    })
    navigate('/play/briefing')
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-8 text-neutral-200">
      <p className="text-xs uppercase tracking-wide text-neutral-500">
        {institution.name} · {config.difficulty} · seed {config.seed}
      </p>
      <h1 className="mt-1 text-2xl font-semibold text-neutral-50">
        {outcome.label ?? 'Mandate ended'}
      </h1>
      <p className="mt-1 text-sm text-neutral-400">
        {meetingsServed} of {config.meetingCount} scheduled meetings served.
      </p>

      <section className="mt-6 space-y-6" aria-labelledby="report-heading">
        <h2 id="report-heading" className="sr-only">
          The mandate, in full
        </h2>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
            What happened
          </h3>
          {report.whatHappened.map((paragraph) => (
            <p key={paragraph} className="mt-2 text-sm leading-relaxed text-neutral-200">
              {paragraph}
            </p>
          ))}
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-400">
            What went well
          </h3>
          {report.whatWentWell.map((paragraph) => (
            <p key={paragraph} className="mt-2 text-sm leading-relaxed text-neutral-200">
              {paragraph}
            </p>
          ))}
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-400">
            What went wrong
          </h3>
          {report.whatWentWrong.map((paragraph) => (
            <p key={paragraph} className="mt-2 text-sm leading-relaxed text-neutral-200">
              {paragraph}
            </p>
          ))}
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
            Why this score
          </h3>
          {report.whyThisScore.map((paragraph) => (
            <p key={paragraph} className="mt-2 text-sm leading-relaxed text-neutral-200">
              {paragraph}
            </p>
          ))}
        </div>
      </section>

      <section className="mt-10" aria-labelledby="score-heading">
        <h2 id="score-heading" className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
          Scorecard
        </h2>
        <p className="mt-2 text-4xl font-semibold tabular-nums text-neutral-50">
          {score.score.toLocaleString('en-US')}
          <span className="ml-2 text-base font-normal text-neutral-500">
            / {MAX_SCORE.toLocaleString('en-US')}
          </span>
        </p>

        <table className="mt-4 w-full border-collapse text-left text-sm">
          <caption className="sr-only">Score components</caption>
          <thead>
            <tr className="border-b border-neutral-700 text-xs uppercase tracking-wide text-neutral-500">
              <th scope="col" className="py-2 pr-2 font-medium">Component</th>
              <th scope="col" className="py-2 pr-2 text-right font-medium">Result</th>
              <th scope="col" className="py-2 text-right font-medium">Weight</th>
            </tr>
          </thead>
          <tbody>
            {score.components.map((component) => (
              <tr key={component.id} className="border-b border-neutral-800 align-top">
                <th scope="row" className="py-2 pr-2 font-medium text-neutral-100">
                  {component.label}
                  <span className="block text-xs font-normal text-neutral-500">
                    {component.explanation}
                  </span>
                </th>
                <td className="py-2 pr-2 text-right tabular-nums text-neutral-200">
                  {Math.round(component.raw * 100)} %
                </td>
                <td className="py-2 text-right tabular-nums text-neutral-400">
                  {Math.round(component.weight * 100)} %
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-3 text-xs text-neutral-500">
          Weighted total {Math.round(score.weightedTotal * 100)} %, difficulty
          multiplier ×{score.difficultyMultiplier.toFixed(2)}
          {score.priceStabilityGate < 1 &&
            `, price-stability gate ×${score.priceStabilityGate.toFixed(2)}`}
          {score.conductGate < 1 &&
            `, conduct gate ×${score.conductGate.toFixed(2)}`}
          . Scoring formula v{score.scoringVersion}, engine v{score.simulationVersion}.
        </p>
      </section>

      {outcome.causalChain.length > 0 && (
        <section className="mt-8" aria-labelledby="cause-heading">
          <h2 id="cause-heading" className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
            How it ended
          </h2>
          <p className="mt-1 text-sm text-neutral-400">
            Several factors contributed, in this order of weight.
          </p>
          <ol className="mt-3 space-y-2">
            {outcome.causalChain.map((factor) => (
              <li key={factor.label} className="border-l-2 border-neutral-800 pl-3">
                <p className="text-sm font-medium text-neutral-100">
                  {factor.label}
                  <span className="ml-2 font-normal tabular-nums text-neutral-500">
                    {Math.round(factor.contribution * 100)} %
                  </span>
                </p>
                <p className="text-sm text-neutral-400">{factor.detail}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="mt-8" aria-labelledby="charts-heading">
        <h2 id="charts-heading" className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
          The mandate in four charts
        </h2>
        <p className="mt-1 text-sm text-neutral-400">
          The true path of the economy, one point per meeting. During the run you saw
          only the published version of this: later, noisier and revised.
        </p>

        <LineChart
          title="Inflation"
          unit="% per year"
          reference={{ label: 'objective', value: institution.inflationTarget }}
          series={[
            line('Headline', (i) => history[i].latent.inflationHeadline, 'stroke-neutral-100'),
            line('Core', (i) => history[i].latent.inflationCore, 'stroke-sky-400', '5 3'),
          ]}
        />

        <LineChart
          title="Unemployment"
          unit="%"
          series={[
            line('Unemployment', (i) => history[i].latent.unemployment, 'stroke-neutral-100'),
            line(
              'Sustainable rate',
              (i) => history[i].latent.naturalUnemployment,
              'stroke-amber-400',
              '5 3',
            ),
          ]}
        />

        <LineChart
          title="Policy rate"
          unit="%"
          series={[
            line('Policy rate', (i) => history[i].latent.policyRate, 'stroke-neutral-100'),
          ]}
        />

        <LineChart
          title="Output gap"
          unit="% of potential"
          reference={{ label: 'potential', value: 0 }}
          series={[
            line('Output gap', (i) => history[i].latent.outputGap, 'stroke-neutral-100'),
          ]}
        />
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={replaySameSeed}
          className="rounded border border-neutral-300 bg-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
        >
          Replay the same seed
        </button>
        <Link
          to="/play/setup"
          className="rounded border border-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
        >
          New economy
        </Link>
        <Link
          to="/"
          className="rounded border border-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
        >
          Home
        </Link>
      </div>

      <p className="mt-8 text-xs text-neutral-600">
        This build keeps no local records, so this report is not stored anywhere and
        is lost when you leave the page.
      </p>
    </main>
  )
}
