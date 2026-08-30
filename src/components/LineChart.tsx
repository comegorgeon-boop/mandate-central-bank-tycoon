/**
 * A minimal multi-series line chart for the post-mandate report.
 *
 * No library and no animation. Series are distinguished by both colour and
 * dash pattern, and every chart carries a text summary, so nothing here
 * depends on colour perception alone.
 */

export interface ChartSeries {
  readonly label: string
  readonly values: readonly number[]
  /** SVG dash pattern; undefined draws a solid line. */
  readonly dash?: string
  readonly className: string
}

export interface ChartReference {
  readonly label: string
  readonly value: number
}

const WIDTH = 640
const HEIGHT = 180
const PAD_X = 44
const PAD_Y = 14

function summarise(series: ChartSeries, unit: string): string {
  const values = series.values.filter((value) => Number.isFinite(value))
  if (values.length === 0) return `${series.label}: no data.`
  const first = values[0]
  const last = values[values.length - 1]
  const min = Math.min(...values)
  const max = Math.max(...values)
  return (
    `${series.label}: started at ${first.toFixed(2)} ${unit}, ended at ` +
    `${last.toFixed(2)} ${unit}, ranging from ${min.toFixed(2)} to ${max.toFixed(2)}.`
  )
}

export function LineChart({
  title,
  unit,
  series,
  reference,
}: {
  readonly title: string
  readonly unit: string
  readonly series: readonly ChartSeries[]
  readonly reference?: ChartReference
}) {
  const all = series.flatMap((line) => line.values).filter(Number.isFinite)
  if (all.length === 0) return null

  const candidates = reference === undefined ? all : [...all, reference.value]
  const rawMin = Math.min(...candidates)
  const rawMax = Math.max(...candidates)
  const padding = (rawMax - rawMin) * 0.1 || 0.5
  const min = rawMin - padding
  const max = rawMax + padding
  const span = max - min || 1

  const longest = Math.max(...series.map((line) => line.values.length))
  const lastIndex = longest - 1 || 1

  const x = (index: number): number =>
    PAD_X + (index / lastIndex) * (WIDTH - PAD_X - 8)
  const y = (value: number): number =>
    HEIGHT - PAD_Y - ((value - min) / span) * (HEIGHT - PAD_Y * 2)

  const summary = series.map((line) => summarise(line, unit)).join(' ')

  return (
    <figure className="mt-5">
      <figcaption className="text-sm font-medium text-neutral-200">
        {title} <span className="font-normal text-neutral-500">({unit})</span>
      </figcaption>

      <div className="mt-2 overflow-x-auto">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          width="100%"
          role="img"
          aria-label={`${title}. ${summary}`}
          className="min-w-[420px]"
        >
          <line
            x1={PAD_X}
            y1={HEIGHT - PAD_Y}
            x2={WIDTH - 8}
            y2={HEIGHT - PAD_Y}
            className="stroke-neutral-700"
            strokeWidth="1"
          />
          <text x="4" y={y(max) + 4} className="fill-neutral-500 text-[10px]">
            {max.toFixed(1)}
          </text>
          <text x="4" y={y(min) + 4} className="fill-neutral-500 text-[10px]">
            {min.toFixed(1)}
          </text>

          {reference !== undefined && (
            <>
              <line
                x1={PAD_X}
                y1={y(reference.value)}
                x2={WIDTH - 8}
                y2={y(reference.value)}
                className="stroke-neutral-600"
                strokeWidth="1"
                strokeDasharray="2 3"
              />
              <text
                x={WIDTH - 8}
                y={y(reference.value) - 4}
                textAnchor="end"
                className="fill-neutral-500 text-[10px]"
              >
                {reference.label}
              </text>
            </>
          )}

          {series.map((line) => (
            <polyline
              key={line.label}
              points={line.values
                .map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`)
                .join(' ')}
              fill="none"
              strokeWidth="1.75"
              strokeDasharray={line.dash}
              strokeLinejoin="round"
              className={line.className}
            />
          ))}
        </svg>
      </div>

      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-400">
        {series.map((line) => (
          <li key={line.label} className="flex items-center gap-1.5">
            <svg width="18" height="6" aria-hidden="true" focusable="false">
              <line
                x1="0"
                y1="3"
                x2="18"
                y2="3"
                strokeWidth="2"
                strokeDasharray={line.dash}
                className={line.className}
              />
            </svg>
            {line.label}
          </li>
        ))}
      </ul>

      <p className="sr-only">{summary}</p>
    </figure>
  )
}
