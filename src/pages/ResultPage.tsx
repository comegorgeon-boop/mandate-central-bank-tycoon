import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  MAX_SCORE,
  SCENARIOS,
  getInstitution,
  type RunSession,
} from '../simulation/index.ts'
import { LineChart, type ChartSeries } from '../components/LineChart.tsx'
import { useRun } from '../features/game/runContext.ts'
import { buildMandateReport } from '../features/result/report.ts'
import { Mascot } from '../components/Mascot.tsx'
import { closingLine } from '../features/meeting/mascotLine.ts'
import { DoctrineMandatesPanel } from '../features/result/DoctrineMandatesPanel.tsx'
import { TheStandardPanel } from '../features/result/TheStandardPanel.tsx'
import { AchievementsPanel } from '../features/result/AchievementsPanel.tsx'
import { AgainstYourselfPanel } from '../features/result/AgainstYourselfPanel.tsx'
import { buildTheStandard } from '../features/result/theStandard.ts'
import { bankedTotal } from '../simulation/index.ts'
import { scenarioVerdict } from '../features/result/scenarioVerdict.ts'
import { Tally } from '../components/engraving/motion.tsx'

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
/**
 * What this mandate is, in the words the player chose it by.
 *
 * The same grouping the records page and the scoring use — a scenario is its
 * own bucket, a fictional mandate is its institution and difficulty — written
 * out so a sentence can contain it.
 */
function bucketLabel(session: RunSession): string {
  const { scenario, institution, difficulty } = session.state.config
  if (scenario !== null) {
    return SCENARIOS.find((entry) => entry.id === scenario)?.title ?? scenario
  }
  return `${getInstitution(institution).shortName} at ${difficulty}`
}

export default function ResultPage() {
  const { runId } = useParams()
  const navigate = useNavigate()
  const { finished, begin } = useRun()

  if (finished === null) return <Navigate to="/play/setup" replace />
  if (runId !== finished.runId) {
    return <Navigate to={`/play/result/${finished.runId}`} replace />
  }

  const { session, score, scoreboard, previousBest } = finished
  const { config } = session.state
  const institution = getInstitution(config.institution)
  const outcome = session.outcome
  const history = session.state.history
  const meetingsServed = session.state.meetingIndex
  const report = buildMandateReport(session.state, outcome, score)
  const banked = bankedTotal(session.state)
  const verdict = scenarioVerdict(session.state, outcome)

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

  /*
   * `onwood`, like the meeting screen's chrome and for the same reason: this
   * header sits straight on the room, which is dark in both directions. The
   * postmortem *document* below it is on paper and keeps `ink`.
   *
   * It was swept to `ink` with everything else this pass and came back at
   * 1.09:1 in papers-on-the-table — a 36 px heading in near-black on dark
   * walnut. Correct in the terminal, invisible in the other direction, and
   * the second time the same sweep made the same mistake in the same pass.
   */
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-8 text-onwood">
      <p className="text-2xs uppercase tracking-[0.14em] text-onwood-faint">
        {institution.name} · {config.difficulty} · seed {config.seed}
      </p>
      <h1
        className={`mt-1 font-display text-3xl font-semibold ${
          outcome.triggered === 'objective_met' ? 'text-good-onwood' : 'text-onwood'
        }`}
      >
        {outcome.triggered === 'objective_met'
          ? 'Objective met — well done'
          : (outcome.label ?? 'Mandate ended')}
      </h1>
      <p className="mt-1 font-mono text-sm text-onwood-soft">
        {/* "N of M scheduled meetings" is gone for the same reason "Meeting 3
            of 16" is: under a survival structure there is no M. What there is
            is how long you held it, which is now half the result rather than
            a footnote on it. */}
        {outcome.triggered === 'objective_met'
          ? `The economy was repaired and held in ${meetingsServed} meetings.`
          : `${meetingsServed} meetings served — ${(meetingsServed / 8).toFixed(1)} years in office.`}
      </p>

      {/* The verdict against the record, for a historical scenario that ended
          early. The scenarios kept their calendars and got this instead. */}
      {verdict !== null && (
        <p className="mt-2 border-l-2 border-edge-accent pl-2 font-mono text-sm text-accent-onwood">
          {verdict}
        </p>
      )}

      {/* The banked total: both halves, always. The total alone is a
          leaderboard of length and the rate alone is the average this whole
          structure exists to get rid of. */}
      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-y border-edge py-1.5 font-mono text-sm">
        <div className="flex items-baseline gap-2">
          <dt className="text-2xs uppercase tracking-[0.16em] text-onwood-faint">Banked</dt>
          <dd className="tabular-nums text-onwood">
            <Tally value={banked.total} delayMs={240} durationMs={1100} />
          </dd>
        </div>
        <div className="flex items-baseline gap-2">
          <dt className="text-2xs uppercase tracking-[0.16em] text-onwood-faint">
            A meeting
          </dt>
          <dd className="tabular-nums text-onwood-soft">{banked.perMeeting}</dd>
        </div>
      </dl>

      {outcome.triggered === 'objective_met' && (
        <section
          aria-labelledby="passed-heading"
          className="mt-4 rounded-lg border-l-4 border-good bg-good-surface p-4 shadow-panel"
        >
          <h2
            id="passed-heading"
            className="font-display text-xl font-semibold text-good-strong"
          >
            You brought it back.
          </h2>
          <p className="mt-1 text-sm text-ink">
            {outcome.summary}
          </p>
          <p className="mt-2 text-sm text-ink">
            That is the whole of monetary policy in one mandate: an economy
            running hot, an instrument that acts with a lag, and an objective
            you have to reach without breaking the other half of the mandate on
            the way. Medium adds the shock that makes those two halves pull
            against each other.
          </p>
        </section>
      )}

      {/* The postmortem is a document, so it sits on paper like everything
          else the player reads. The charts inside it draw in ink, which is
          what made them 1.04:1 while this section was on walnut. */}
      <div className="mt-6 rounded-lg border border-edge bg-panel p-4 text-ink shadow-panel sm:p-6">
      <section className="space-y-6" aria-labelledby="report-heading">
        <h2 id="report-heading" className="sr-only">
          The mandate, in full
        </h2>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
            What happened
          </h3>
          {report.whatHappened.map((paragraph) => (
            <p key={paragraph} className="mt-2 text-sm leading-relaxed text-ink">
              {paragraph}
            </p>
          ))}
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-good-strong">
            What went well
          </h3>
          {report.whatWentWell.map((paragraph) => (
            <p key={paragraph} className="mt-2 text-sm leading-relaxed text-ink">
              {paragraph}
            </p>
          ))}
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-accent-strong">
            What went wrong
          </h3>
          {report.whatWentWrong.map((paragraph) => (
            <p key={paragraph} className="mt-2 text-sm leading-relaxed text-ink">
              {paragraph}
            </p>
          ))}
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
            Why this score
          </h3>
          {report.whyThisScore.map((paragraph) => (
            <p key={paragraph} className="mt-2 text-sm leading-relaxed text-ink">
              {paragraph}
            </p>
          ))}
        </div>
      </section>

      <section className="mt-10" aria-labelledby="score-heading">
        <h2 id="score-heading" className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
          Scorecard
        </h2>
        <p className="mt-2 text-4xl font-semibold tabular-nums text-ink">
          {score.score.toLocaleString('en-US')}
          <span className="ml-2 text-base font-normal text-ink-faint">
            / {MAX_SCORE.toLocaleString('en-US')}
          </span>
        </p>

        <table className="mt-4 w-full border-collapse text-left text-sm">
          <caption className="sr-only">Score components</caption>
          <thead>
            <tr className="border-b border-edge text-xs uppercase tracking-wide text-ink-faint">
              <th scope="col" className="py-2 pr-2 font-medium">Component</th>
              <th scope="col" className="py-2 pr-2 text-right font-medium">Result</th>
              <th scope="col" className="py-2 text-right font-medium">Weight</th>
            </tr>
          </thead>
          <tbody>
            {score.components.map((component) => (
              <tr key={component.id} className="border-b border-edge align-top">
                <th scope="row" className="py-2 pr-2 font-medium text-ink">
                  {component.label}
                  <span className="block text-xs font-normal text-ink-faint">
                    {component.explanation}
                  </span>
                </th>
                <td className="py-2 pr-2 text-right tabular-nums text-ink">
                  {Math.round(component.raw * 100)} %
                </td>
                <td className="py-2 text-right tabular-nums text-ink-soft">
                  {Math.round(component.weight * 100)} %
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-3 text-xs text-ink-faint">
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
          <h2 id="cause-heading" className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
            How it ended
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Several factors contributed, in this order of weight.
          </p>
          <ol className="mt-3 space-y-2">
            {outcome.causalChain.map((factor) => (
              <li key={factor.label} className="border-l-2 border-edge pl-3">
                <p className="text-sm font-medium text-ink">
                  {factor.label}
                  <span className="ml-2 font-normal tabular-nums text-ink-faint">
                    {Math.round(factor.contribution * 100)} %
                  </span>
                </p>
                <p className="text-sm text-ink-soft">{factor.detail}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="mt-8" aria-labelledby="charts-heading">
        <h2 id="charts-heading" className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
          The mandate in four charts
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          The true path of the economy, one point per meeting. During the run you saw
          only the published version of this: later, noisier and revised.
        </p>

        <LineChart
          title="Inflation"
          unit="% per year"
          reference={{ label: 'objective', value: institution.inflationTarget }}
          series={[
            line('Headline', (i) => history[i].latent.inflationHeadline, 'stroke-ink'),
            line('Core', (i) => history[i].latent.inflationCore, 'stroke-good-strong', '5 3'),
          ]}
        />

        <LineChart
          title="Unemployment"
          unit="%"
          series={[
            line('Unemployment', (i) => history[i].latent.unemployment, 'stroke-ink'),
            line(
              'Sustainable rate',
              (i) => history[i].latent.naturalUnemployment,
              'stroke-accent-strong',
              '5 3',
            ),
          ]}
        />

        <LineChart
          title="Policy rate"
          unit="%"
          series={[
            line('Policy rate', (i) => history[i].latent.policyRate, 'stroke-ink'),
          ]}
        />

        <LineChart
          title="Output gap"
          unit="% of potential"
          reference={{ label: 'potential', value: 0 }}
          series={[
            line('Output gap', (i) => history[i].latent.outputGap, 'stroke-ink'),
          ]}
        />
      </section>

      <TheStandardPanel session={session} score={score} />

      {/* Before the doctrines, because this is about the player and that is
          about the argument. The order a reader wants at the end of a mandate
          is: what I scored, how it compares with what I have done before, then
          who in the room turned out to be right. */}
      <AgainstYourselfPanel
        score={score}
        previousBest={previousBest}
        bucketLabel={bucketLabel(session)}
      />

      <DoctrineMandatesPanel session={session} score={score} board={scoreboard} />

      {/* Last, because it is the lightest thing on the page and the written
          account is the point. Whether the mandate beat the path history took
          is computed once, here, from the same comparison the standard panel
          above builds — wrapped, because that replay is the one that blanked
          this screen once already. */}
      <AchievementsPanel
        session={session}
        score={score}
        beatTheStandard={(() => {
          try {
            const standard = buildTheStandard(session, score)
            return standard !== null && score.score > standard.replay.score.score
          } catch {
            return false
          }
        })()}
      />

      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={replaySameSeed}
          className="rounded-md border border-edge-accent bg-accent px-4 py-2 text-sm font-semibold text-on-accent shadow-panel transition-colors hover:bg-accent-onwood"
        >
          Replay the same seed
        </button>
        <Link
          to="/play/setup"
          className="rounded border border-edge-room px-4 py-2 text-sm text-onwood hover:bg-inset"
        >
          New economy
        </Link>
        <Link
          to="/"
          className="rounded border border-edge-room px-4 py-2 text-sm text-onwood hover:bg-inset"
        >
          Home
        </Link>
      </div>

      <aside className="mt-8 flex items-start gap-3 rounded-lg border border-edge-room bg-room p-4">
        <Mascot size={92} className="shrink-0" />
        <p className="text-sm leading-relaxed text-onwood-soft">
          {closingLine({
            completed: outcome.status === 'completed',
            objectiveMet: outcome.triggered === 'objective_met',
            objectiveMissed: outcome.triggered === 'objective_missed',
            score: score.score,
            maxScore: MAX_SCORE,
            conductGate: score.conductGate,
            supplyRegimeShare: score.supplyRegimeShare,
          })}
        </p>
      </aside>

      <p className="mt-6 text-xs text-onwood-faint">
        This build keeps no local records, so this report is not stored anywhere and
        is lost when you leave the page.
      </p>
    </main>
  )
}
