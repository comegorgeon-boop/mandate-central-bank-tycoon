/**
 * A minimal trend sparkline.
 *
 * Every value it draws is also printed as text beside it, so it carries no
 * information of its own — but "decorative" is not the same as "unlabelled",
 * and the shape of a series *is* what a reader takes from it at a glance. It
 * therefore gets a short text equivalent describing the movement, and is
 * hidden from assistive technology only when that equivalent is present.
 */

/**
 * How the line is coloured.
 *
 * The *realised* verdict, not the series' semantics. An earlier version took
 * "which way is good for this series" and coloured a falling equity index
 * green, because rising is good for equities — which is precisely backwards
 * for the reader, who sees a green line going down. Callers work out the
 * verdict and pass it; this only draws it.
 */
export type SparklineTone = 'neutral' | 'good' | 'bad'

const TONE_CLASS: Readonly<Record<SparklineTone, string>> = {
  neutral: 'text-ink-faint',
  good: 'text-good',
  bad: 'text-bad',
}

/**
 * The movement, in words.
 *
 * Deliberately about *shape* rather than about the endpoints, which the row
 * already prints: a reader who cannot see the line wants to know whether it is
 * climbing steadily or has just turned, not to have the number read twice.
 */
function describe(values: readonly (number | null)[], decimals: number): string {
  const points = values.filter(
    (value): value is number => value !== null && Number.isFinite(value),
  )
  if (points.length < 2) return 'Not enough readings yet to show a trend.'

  const first = points[0]
  const last = points[points.length - 1]
  const min = Math.min(...points)
  const max = Math.max(...points)
  const tolerance = 10 ** -decimals / 2

  const overall =
    Math.abs(last - first) < tolerance
      ? 'ends where it started'
      : last > first
        ? `rises from ${first.toFixed(decimals)} to ${last.toFixed(decimals)}`
        : `falls from ${first.toFixed(decimals)} to ${last.toFixed(decimals)}`

  const turned =
    max - Math.max(first, last) > tolerance
      ? `, after peaking at ${max.toFixed(decimals)}`
      : Math.min(first, last) - min > tolerance
        ? `, after a trough at ${min.toFixed(decimals)}`
        : ''

  return `Trend over ${points.length} readings: ${overall}${turned}.`
}

export function Sparkline({
  values,
  label,
  decimals = 2,
  tone = 'neutral',
  width = 72,
  height = 22,
}: {
  readonly values: readonly (number | null)[]
  /** The series this belongs to, for the text equivalent. */
  readonly label?: string
  readonly decimals?: number
  readonly tone?: SparklineTone
  readonly width?: number
  readonly height?: number
}) {
  const points = values
    .map((value, index) => ({ value, index }))
    .filter(
      (point): point is { value: number; index: number } =>
        point.value !== null && Number.isFinite(point.value),
    )

  if (points.length < 2) {
    return (
      <span className="inline-block text-ink-faint" style={{ width }}>
        —
      </span>
    )
  }

  const numbers = points.map((point) => point.value)
  const min = Math.min(...numbers)
  const max = Math.max(...numbers)
  const span = max - min || 1
  const lastIndex = values.length - 1 || 1
  const pad = 3

  const at = (point: { value: number; index: number }) => ({
    x: (point.index / lastIndex) * (width - pad * 2) + pad,
    y: height - pad - ((point.value - min) / span) * (height - pad * 2),
  })

  const path = points
    .map((point) => {
      const { x, y } = at(point)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  const head = at(points[points.length - 1])
  const summary = `${label ? `${label}. ` : ''}${describe(values, decimals)}`

  return (
    <span className={`inline-flex shrink-0 ${TONE_CLASS[tone]}`}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={summary}
        focusable="false"
      >
        <polyline
          points={path}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* The latest reading, marked. On a line of a dozen points the eye
            needs telling which end is now. */}
        <circle cx={head.x} cy={head.y} r="1.9" fill="currentColor" />
      </svg>
    </span>
  )
}
