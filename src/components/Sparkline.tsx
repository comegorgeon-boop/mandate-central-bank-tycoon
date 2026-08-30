/**
 * A minimal trend sparkline.
 *
 * Decorative by design: every value it draws is also printed as text next to
 * it, so it carries no information of its own and is hidden from assistive
 * technology rather than given a redundant label.
 */
export function Sparkline({
  values,
  width = 72,
  height = 20,
}: {
  readonly values: readonly (number | null)[]
  readonly width?: number
  readonly height?: number
}) {
  const points = values
    .map((value, index) => ({ value, index }))
    .filter((point): point is { value: number; index: number } =>
      point.value !== null && Number.isFinite(point.value),
    )

  if (points.length < 2) {
    return <span className="inline-block text-neutral-600" style={{ width }}>—</span>
  }

  const numbers = points.map((point) => point.value)
  const min = Math.min(...numbers)
  const max = Math.max(...numbers)
  const span = max - min || 1
  const lastIndex = values.length - 1 || 1
  const pad = 2

  const path = points
    .map((point) => {
      const x = (point.index / lastIndex) * (width - pad * 2) + pad
      const y = height - pad - ((point.value - min) / span) * (height - pad * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
    >
      <polyline
        points={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
