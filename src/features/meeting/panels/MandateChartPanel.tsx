import {
  inflationTargetFor,
  sustainableRateFor,
  type ObservationSet,
  type RunConfig,
  type SeriesId,
} from '../../../simulation/index.ts'
import { TrendChart } from '../../../components/TrendChart.tsx'

/**
 * The mandate so far, as three lines.
 *
 * The primary interface, and placed where the primary interface belongs:
 * above everything, before any prose. A played mandate reported that by the
 * fifth meeting the player had stopped reading and was looking only at the
 * charts — which is not a failure of attention, it is the correct instinct
 * about what a macroeconomic series is for. The direction of travel decides
 * the policy; the current print rarely does.
 *
 * Three charts rather than one with three lines on it. Inflation is a
 * percentage near two, unemployment a percentage near five and the policy rate
 * a percentage anywhere from zero to eight: sharing an axis would flatten all
 * three into a band, and giving each its own axis on one chart produces a
 * picture that cannot be read without a legend nobody reads. Separate panels
 * with separate scales say more and ask less.
 *
 * Each carries the line it is judged against — the objective, the sustainable
 * rate of unemployment, the neutral rate — because "where is it relative to
 * where it should be" is the only question being asked of any of them, and a
 * chart that leaves the reader to hold the reference in their head is a chart
 * that will be misread.
 */

interface Series {
  readonly id: SeriesId
  readonly label: string
  readonly reference: number | null
  readonly referenceLabel: string
}

function seriesFor(
  config: RunConfig,
  observation: ObservationSet,
): readonly Series[] {
  return [
    {
      id: 'headline_inflation',
      label: 'Inflation',
      // The mandate's own objective, not the institution's. A historical
      // mandate may have been run to a different one — 1929-33 to a stable
      // price level — and a dashed line at 2 % would be the chart arguing with
      // the scenario.
      reference: inflationTargetFor(config),
      referenceLabel: 'objective',
    },
    {
      id: 'unemployment',
      label: 'Unemployment',
      reference: sustainableRateFor(config),
      referenceLabel: 'sustainable rate',
    },
    {
      id: 'policy_rate',
      label: 'Policy rate',
      // The neutral rate is an *estimate* and is published as one, so it is
      // read off the observation rather than assumed: at hard it carries the
      // same error as everything else, and drawing a confident line through a
      // number the player has only a noisy read of would be the interface
      // claiming a precision the mode deliberately withholds.
      reference: observation.indicators.neutral_rate_estimate?.value ?? null,
      referenceLabel: 'neutral rate estimate',
    },
  ]
}

export function MandateChartPanel({
  observation,
  config,
}: {
  readonly observation: ObservationSet
  /**
   * The run's own configuration, not just its institution.
   *
   * The two reference lines this panel draws — the objective and the
   * sustainable rate — are properties of the *mandate* rather than of the
   * institution, and a historical one may have been run to different ones.
   */
  readonly config: RunConfig
}) {
  const series = seriesFor(config, observation)
  const plotted = series
    .map((entry) => ({ entry, reading: observation.indicators[entry.id] }))
    .filter(
      (row): row is { entry: Series; reading: NonNullable<typeof row.reading> } =>
        row.reading !== undefined,
    )

  if (plotted.length === 0) return null

  return (
    <section
      aria-labelledby="mandate-chart-heading"
      className="animate-rise mt-5 rounded-lg border border-edge bg-panel p-4 text-ink shadow-panel sm:p-5"
    >
      <h2
        id="mandate-chart-heading"
        className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-faint"
      >
        The mandate so far
      </h2>

      <div className="mt-3 grid gap-5 sm:grid-cols-3">
        {plotted.map(({ entry, reading }) => {
          const value = reading.value
          const gap = value === null || entry.reference === null
            ? null
            : value - entry.reference
          return (
            <div key={entry.id}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-ink">{entry.label}</span>
                <span className="tabular-nums text-lg font-semibold text-ink">
                  {value === null ? '—' : value.toFixed(2)}
                  <span className="ml-0.5 text-xs font-normal text-ink-faint">%</span>
                </span>
              </div>
              <p className="text-xs text-ink-faint">
                {/* Three different nulls, and conflating them misleads. No
                    *reading* means the release did not arrive — routine, and
                    the chart behind it still has history. No *reference* means
                    the estimate it is judged against is itself unpublished,
                    which happens to the neutral rate at hard. */}
                {value === null
                  ? 'No release this meeting. The chart holds what was published before.'
                  : entry.reference === null
                    ? `The ${entry.referenceLabel} is not published this meeting.`
                    : Math.abs(gap!) < 0.05
                      ? `On the ${entry.referenceLabel}.`
                      : `${Math.abs(gap!).toFixed(2)} pp ${gap! > 0 ? 'above' : 'below'} the ${entry.referenceLabel}.`}
              </p>
              <div className="mt-1.5 overflow-x-auto">
                <TrendChart
                  label={entry.label}
                  values={reading.trend}
                  reference={entry.reference}
                  referenceLabel={entry.referenceLabel}
                />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
