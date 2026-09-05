import {
  getSeries,
  type IndicatorObservation,
  type ReleaseCategory,
} from '../simulation/index.ts'
import { plainHeadline, type Register } from '../features/meeting/register.ts'
import { TrendChart } from './TrendChart.tsx'

/**
 * One published indicator.
 *
 * It carries four things, in the order a player needs them: the number, how it
 * has moved over the mandate, what a move in it means for them, and how much
 * to trust it — where it comes from, how late it is, how wide its error bar is,
 * and whether an earlier print has since been corrected.
 *
 * The trend chart is not decoration. A single reading shows no direction, and
 * in macroeconomics the direction usually decides the policy.
 *
 * What leads the row is the difficulty's `Register`. On the learning mandate a
 * plain sentence is the headline and the figure is the note underneath it; from
 * medium the figure leads; at hard the plain-language reading of what a move
 * means is withdrawn entirely and only the technical definition remains. See
 * `features/meeting/register.ts`.
 */

const CATEGORY_LABEL: Readonly<Record<ReleaseCategory, string>> = {
  market_data: 'Market price',
  official_statistic: 'Official statistic',
  survey: 'Survey',
  internal_estimate: 'Staff estimate',
}

function lagLabel(meetings: number): string {
  if (meetings <= 0) return 'available at this meeting'
  if (meetings === 1) return 'reflects the period before last'
  return `reflects ${meetings} meetings ago`
}

function formatValue(value: number | null, decimals: number): string {
  return value === null ? '—' : value.toFixed(decimals)
}

function formatChange(
  value: number | null,
  previous: number | null,
  decimals: number,
): string | null {
  if (value === null || previous === null) return null
  const change = value - previous
  if (Math.abs(change) < 10 ** -decimals / 2) return 'unchanged'
  return `${change > 0 ? '+' : '−'}${Math.abs(change).toFixed(decimals)} vs previous`
}

export function IndicatorRow({
  observation,
  reference = null,
  referenceLabel = 'objective',
  register = 'plain',
}: {
  readonly observation: IndicatorObservation
  /** A line to read the series against, such as the inflation objective. */
  readonly reference?: number | null
  readonly referenceLabel?: string
  /** Which language this difficulty publishes its numbers in. */
  readonly register?: Register
}) {
  const decimals = getSeries(observation.seriesId)?.decimals ?? 2
  const change = formatChange(observation.value, observation.previous, decimals)
  const figure = (
    <span className="tabular-nums text-lg text-neutral-50">
      {formatValue(observation.value, decimals)}
      <span className="ml-1 text-xs text-neutral-400">{observation.unit}</span>
    </span>
  )

  return (
    <li className="border-b border-neutral-800 py-4 last:border-b-0">
      {register === 'plain' ? (
        <div>
          <p className="font-medium text-neutral-100">
            {plainHeadline(observation, reference, referenceLabel)}
          </p>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span className="text-xs uppercase tracking-wide text-neutral-500">
              {observation.label}
            </span>
            {figure}
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="font-medium text-neutral-100">{observation.label}</span>
          {figure}
        </div>
      )}

      <TrendChart
        label={observation.label}
        values={observation.trend}
        decimals={decimals}
        reference={reference}
        referenceLabel={referenceLabel}
      />

      {/* What a move means is a reading, and hard reads nothing for you. */}
      {register !== 'technical' && (
        <p className="mt-2 text-sm text-neutral-400">{observation.meaning}</p>
      )}

      <p className="mt-2 text-xs text-neutral-500">
        {observation.missing ? (
          <span className="text-amber-400">
            This release did not arrive in time for the meeting.
          </span>
        ) : (
          <>
            {change !== null && <span>{change}. </span>}
            {observation.uncertainty > 0 && (
              <span>Uncertainty ±{observation.uncertainty.toFixed(decimals)}. </span>
            )}
            <span>
              {CATEGORY_LABEL[observation.category]},{' '}
              {lagLabel(observation.publicationLagMeetings)}.
            </span>
          </>
        )}
      </p>

      {observation.revision !== null && (
        <p className="mt-1 text-xs text-amber-400">
          Revision: the reading {observation.revision.periodsAgo} period
          {observation.revision.periodsAgo === 1 ? '' : 's'} ago was first published at{' '}
          {observation.revision.firstPrint.toFixed(decimals)} and now reads{' '}
          {observation.revision.current.toFixed(decimals)}.
        </p>
      )}

      <p className="mt-1 text-xs text-neutral-600">{observation.definition}</p>
    </li>
  )
}
