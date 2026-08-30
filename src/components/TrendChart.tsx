/**
 * A small trend chart for one published series.
 *
 * Unlike the decorative Sparkline, this one carries information the text
 * around it does not: the shape of the path over the mandate. In
 * macroeconomics the direction of travel usually matters more than the level,
 * and a lone number shows no direction at all. So it is described to assistive
 * technology rather than hidden from it, and it is drawn plainly — no fills,
 * no gradients, no axis furniture that would compete with the line.
 *
 * Gaps in the data are gaps in the line. A release that never arrived is not
 * interpolated over: the player should see that the series has a hole in it.
 */

const WIDTH = 320
const HEIGHT = 64
const PAD_X = 2
const PAD_Y = 6

function describe(
  label: string,
  values: readonly (number | null)[],
  decimals: number,
): string {
  const points = values.filter((value): value is number => value !== null)
  if (points.length < 2) return `${label}: not enough published readings to plot a trend.`

  const first = points[0]
  const last = points[points.length - 1]
  const direction =
    Math.abs(last - first) < 10 ** -decimals / 2
      ? 'flat overall'
      : last > first
        ? 'higher'
        : 'lower'

  return (
    `${label} over the mandate: ${points.length} readings, ` +
    `from ${first.toFixed(decimals)} to ${last.toFixed(decimals)}, ${direction}. ` +
    `Range ${Math.min(...points).toFixed(decimals)} to ` +
    `${Math.max(...points).toFixed(decimals)}.`
  )
}

export function TrendChart({
  label,
  values,
  decimals = 2,
  reference = null,
  referenceLabel = 'objective',
}: {
  readonly label: string
  readonly values: readonly (number | null)[]
  readonly decimals?: number
  /** A horizontal line to read the series against — the inflation target, say. */
  readonly reference?: number | null
  readonly referenceLabel?: string
}) {
  const points = values
    .map((value, index) => ({ value, index }))
    .filter((point): point is { value: number; index: number } =>
      point.value !== null && Number.isFinite(point.value),
    )

  if (points.length < 2) {
    return (
      <p className="mt-2 text-xs text-neutral-600">
        Not enough published readings yet to show a trend.
      </p>
    )
  }

  const numbers = points.map((point) => point.value)
  // The reference line has to be inside the scale, or it would be drawn off the
  // chart and silently mislead about where the series sits against it.
  const candidates = reference === null ? numbers : [...numbers, reference]
  const min = Math.min(...candidates)
  const max = Math.max(...candidates)
  const span = max - min || 1
  const lastIndex = values.length - 1 || 1

  const x = (index: number): number => (index / lastIndex) * (WIDTH - PAD_X * 2) + PAD_X
  const y = (value: number): number =>
    HEIGHT - PAD_Y - ((value - min) / span) * (HEIGHT - PAD_Y * 2)

  // Consecutive runs only: a missing release leaves a visible break in the line.
  const segments: string[] = []
  let run: string[] = []
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (value === null || !Number.isFinite(value)) {
      if (run.length > 1) segments.push(run.join(' '))
      run = []
      continue
    }
    run.push(`${x(index).toFixed(1)},${y(value).toFixed(1)}`)
  }
  if (run.length > 1) segments.push(run.join(' '))

  const latest = points[points.length - 1]

  return (
    <figure className="mt-2">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={describe(label, values, decimals)}
        className="h-16 w-full text-neutral-300"
      >
        {reference !== null && (
          <line
            x1={PAD_X}
            x2={WIDTH - PAD_X}
            y1={y(reference)}
            y2={y(reference)}
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="3 3"
            className="text-neutral-600"
          />
        )}
        {segments.map((segment) => (
          <polyline
            key={segment.slice(0, 24)}
            points={segment}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <circle cx={x(latest.index)} cy={y(latest.value)} r="2.5" fill="currentColor" />
      </svg>

      <figcaption className="mt-1 flex justify-between text-xs text-neutral-500">
        <span className="tabular-nums">
          low {min.toFixed(decimals)} · high {max.toFixed(decimals)}
        </span>
        <span>
          {reference !== null && (
            <span className="tabular-nums">
              dashed line: {referenceLabel} {reference.toFixed(decimals)}
            </span>
          )}
        </span>
      </figcaption>
    </figure>
  )
}
