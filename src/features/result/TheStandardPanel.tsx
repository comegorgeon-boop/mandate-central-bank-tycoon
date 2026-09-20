import { useMemo } from 'react'
import type { RunSession, ScoreBreakdown } from '../../simulation/index.ts'
import { LineChart } from '../../components/LineChart.tsx'
import { buildTheStandard } from './theStandard.ts'

/**
 * Your mandate against what actually happened.
 *
 * The thing a historical scenario is for. The chart puts the two rate paths on
 * one axis, meeting by meeting, and underneath it the same seed is replayed
 * with the historical path in the chair so that "what if I had done what they
 * did" has a number rather than an opinion.
 *
 * Two honesty rules govern the copy, and both are load-bearing rather than
 * decorative.
 *
 * **The benchmark is what prevailed, not what was voted.** Between October
 * 1979 and October 1982 the Committee voted reserve paths, and the funds rate
 * was an outcome of those votes. A reader who took this column for a sequence
 * of decisions would have learned the opposite of the period's central fact.
 *
 * **The replay is on your seed, not on 1979's.** The shocks are the ones your
 * mandate drew, so the history's own policy meets a different world. When it
 * does worse than it did, that is the answer to a real question — whether the
 * policy worked or the weather did — and not a defect in the comparison.
 */
export function TheStandardPanel({
  session,
  score,
}: {
  readonly session: RunSession
  readonly score: ScoreBreakdown
}) {
  const standard = useMemo(() => buildTheStandard(session, score), [session, score])
  if (standard === null) return null

  const { meetings, replay, yours, meanGap } = standard
  const played = meetings.filter((meeting) => meeting.yours !== null)
  const ahead = score.score - replay.score.score

  return (
    <section className="mt-10" aria-labelledby="standard-heading">
      <h2
        id="standard-heading"
        className="text-sm font-semibold uppercase tracking-wide text-ink-soft"
      >
        The standard
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        What you did, against what was actually done — and then the same seed
        played again with the historical path in the chair.
      </p>

      <LineChart
        title="Your rate and theirs"
        unit="%"
        series={[
          {
            // Only the meetings actually served. A mandate that ended early
            // stops here, which is itself information, and padding it would
            // draw a line through a period nobody governed.
            label: 'You',
            values: played.map((meeting) => meeting.yours as number),
            className: 'stroke-ink',
          },
          {
            label: 'What prevailed',
            values: meetings.map((meeting) => meeting.actual),
            className: 'stroke-accent-strong',
            dash: '5 3',
          },
        ]}
      />

      <p className="mt-2 text-sm text-ink">
        Across the {played.length} meetings you served, your rate sat an
        average of {meanGap.toFixed(2)} points from the one that actually
        prevailed — tighter at {standard.tighter}{' '}
        {standard.tighter === 1 ? 'meeting' : 'meetings'} and easier at{' '}
        {standard.easier}.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[24rem] border-collapse text-left text-sm">
          <caption className="sr-only">
            Your mandate compared with the same seed played on the historical
            policy path.
          </caption>
          <thead>
            <tr className="border-b border-edge text-xs uppercase tracking-wide text-ink-faint">
              <th scope="col" className="py-2 pr-2 font-medium" />
              <th scope="col" className="py-2 pr-2 text-right font-medium">
                You
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Their path, your seed
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-edge">
              <th scope="row" className="py-2 pr-2 font-medium text-ink">
                Score
              </th>
              <td className="py-2 pr-2 text-right font-semibold tabular-nums text-ink">
                {score.score.toLocaleString('en-US')}
              </td>
              <td
                className={`py-2 text-right tabular-nums ${
                  ahead < 0 ? 'font-semibold text-accent-strong' : 'text-ink'
                }`}
              >
                {replay.score.score.toLocaleString('en-US')}
              </td>
            </tr>
            <tr className="border-b border-edge">
              <th scope="row" className="py-2 pr-2 font-medium text-ink">
                Inflation at the end
              </th>
              <td className="py-2 pr-2 text-right tabular-nums text-ink">
                {yours.finalInflation.toFixed(1)} %
              </td>
              <td className="py-2 text-right tabular-nums text-ink">
                {replay.finalInflation.toFixed(1)} %
              </td>
            </tr>
            <tr className="border-b border-edge">
              <th scope="row" className="py-2 pr-2 font-medium text-ink">
                Worst unemployment
              </th>
              <td className="py-2 pr-2 text-right tabular-nums text-ink">
                {yours.peakUnemployment.toFixed(1)} %
              </td>
              <td className="py-2 text-right tabular-nums text-ink">
                {replay.peakUnemployment.toFixed(1)} %
              </td>
            </tr>
            <tr className="border-b border-edge">
              <th scope="row" className="py-2 pr-2 font-medium text-ink">
                How it ended
              </th>
              <td className="py-2 pr-2 text-right text-xs text-ink-soft">
                {session.outcome.status === 'completed'
                  ? `${session.state.meetingIndex} meetings`
                  : (session.outcome.label ??
                    `ended at ${session.state.meetingIndex}`)}
              </td>
              <td className="py-2 text-right text-xs text-ink-soft">
                {replay.completed
                  ? `${replay.meetings} meetings`
                  : (replay.endedAs ?? `ended at ${replay.meetings}`)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-ink-faint">
        The benchmark path is the effective federal funds rate that actually
        prevailed, month by month — <strong>not</strong> a target the Committee
        voted. Between October 1979 and October 1982 the FOMC voted paths for
        bank reserves, and the rate is an outcome of those votes rather than an
        instruction: that is the whole point of the period. The replay also
        meets <em>your</em> shocks rather than 1979&rsquo;s, so where it does
        worse than the history did, the question it answers is whether the
        policy worked or the weather did. Every figure in the benchmark column
        is sourced in <code>docs/SCENARIOS.md</code>, and a test fails if the
        two ever disagree.
      </p>
    </section>
  )
}
