/**
 * A small trend chart for one published series.
 *
 * Unlike the Sparkline, this one carries information the text around it does
 * not: the shape of the path over the mandate, and how far that path has run
 * from the line it is supposed to be near. In macroeconomics the direction of
 * travel usually matters more than the level, and a lone number shows no
 * direction at all.
 *
 * Drawn plainly — no gradients, no legend, no axis furniture competing with
 * the line. The one piece of ink beyond the line itself is a faint band
 * between the series and its reference, because "how far from the objective"
 * is the question every one of these charts is being asked and shading the
 * answer is faster to read than tracing two lines with your eye.
 *
 * Gaps in the data are gaps in the line. A release that never arrived is not
 * interpolated over: the player should see that the series has a hole in it.
 */

const WIDTH = 320
const HEIGHT = 64
const PAD_X = 3
const PAD_Y = 8

/**
 * Drops the leading nulls, which are not missing data.
 *
 * The published trend is always as long as the whole mandate, filled backwards
 * from the current period, so at meeting seven of twelve the first six entries
 * are periods *before the run opened*. They are not releases that failed to
 * arrive and must not be described as such — and plotting them squeezes the
 * line into the right-hand third of a chart that has the whole width available.
 * Interior gaps are left exactly where they are: a release that genuinely did
 * not arrive is something the player needs to see.
 */
function fromFirstReading(
  values: readonly (number | null)[],
): readonly (number | null)[] {
  const first = values.findIndex(
    (value) => value !== null && Number.isFinite(value),
  )
  return first <= 0 ? values : values.slice(first)
}

/**
 * How many plottable readings a series has.
 *
 * Exported because the panel above a row of these needs the *same* rule to
 * decide whether to say "no trends yet" — and a caller that counted
 * differently from the chart would put that sentence over a drawn line, or
 * leave three empty tracks with nothing explaining them.
 */
export function readings(values: readonly (number | null)[]): number {
  return fromFirstReading(values).filter(
    (value) => value !== null && Number.isFinite(value),
  ).length
}

function describe(
  label: string,
  values: readonly (number | null)[],
  decimals: number,
  reference: number | null,
  referenceLabel: string,
): string {
  const points = values.filter((value): value is number => value !== null)
  if (points.length < 2) return `${label}: not enough published readings to plot a trend.`

  const first = points[0]
  const last = points[points.length - 1]
  const tolerance = 10 ** -decimals / 2
  const direction =
    Math.abs(last - first) < tolerance
      ? 'flat overall'
      : last > first
        ? 'higher'
        : 'lower'

  // Only gaps *inside* the plotted window; the leading nulls are already gone.
  const missing = values.length - points.length
  const gaps =
    missing > 0
      ? ` ${missing} release${missing === 1 ? '' : 's'} did not arrive.`
      : ''

  // Where it stands against the line it is judged by, which is the whole point
  // of the chart and therefore the last thing said rather than the first.
  const against =
    reference === null
      ? ''
      : Math.abs(last - reference) < tolerance
        ? ` It ends on the ${referenceLabel}.`
        : ` It ends ${Math.abs(last - reference).toFixed(decimals)} ${
            last > reference ? 'above' : 'below'
          } the ${referenceLabel} of ${reference.toFixed(decimals)}.`

  return (
    `${label} over the mandate: ${points.length} readings, ` +
    `from ${first.toFixed(decimals)} to ${last.toFixed(decimals)}, ${direction}. ` +
    `Range ${Math.min(...points).toFixed(decimals)} to ` +
    `${Math.max(...points).toFixed(decimals)}.${gaps}${against}`
  )
}

export function TrendChart({
  label,
  values: published,
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
  const values = fromFirstReading(published)
  const points = values
    .map((value, index) => ({ value, index }))
    .filter(
      (point): point is { value: number; index: number } =>
        point.value !== null && Number.isFinite(point.value),
    )

  if (points.length < 2) {
    // Nothing to draw yet, and deliberately *nothing said* either. This used
    // to print "Not enough published readings yet to show a trend." — once per
    // series, so the opening meeting of every mandate carried three identical
    // sentences in one panel, which is the accountancy-document register this
    // interface is trying to leave. The caller says it once, above all three.
    //
    // An empty track rather than nothing at all: the columns keep their
    // heights, so the panel does not jump the first time a chart appears.
    return (
      <div
        aria-hidden="true"
        className="mt-2 h-10 rounded-sm border border-dashed border-edge-room"
      />
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
  const segments: { readonly line: string; readonly band: string }[] = []
  let run: { readonly index: number; readonly value: number }[] = []
  const flush = (): void => {
    if (run.length > 1) {
      const line = run.map((p) => `${x(p.index).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
      const band =
        reference === null
          ? ''
          : `${line} ${x(run[run.length - 1].index).toFixed(1)},${y(reference).toFixed(1)} ` +
            `${x(run[0].index).toFixed(1)},${y(reference).toFixed(1)}`
      segments.push({ line, band })
    }
    run = []
  }
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (value === null || !Number.isFinite(value)) {
      flush()
      continue
    }
    run = [...run, { index, value }]
  }
  flush()

  const latest = points[points.length - 1]

  return (
    <figure className="mt-2">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={describe(label, values, decimals, reference, referenceLabel)}
        className="h-16 w-full text-ink-soft"
      >
        {/* The distance from the reference, shaded. Very faint: it is an
            answer to "how far off", not a second line to read. */}
        {reference !== null &&
          segments.map(
            (segment) =>
              segment.band !== '' && (
                <polygon
                  key={`band-${segment.line.slice(0, 24)}`}
                  points={segment.band}
                  className="fill-current opacity-10"
                />
              ),
          )}

        {reference !== null && (
          <line
            x1={PAD_X}
            x2={WIDTH - PAD_X}
            y1={y(reference)}
            y2={y(reference)}
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
            className="text-ink-faint"
          />
        )}

        {segments.map((segment) => (
          <polyline
            key={segment.line.slice(0, 24)}
            points={segment.line}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            // Drawn left to right as the panel arrives, which is the direction
            // time runs on it. `pathLength` normalises the geometry to 1 so
            // the dash animation in `tokens.css` needs no measurement — and
            // `prefers-reduced-motion` switches the whole thing off with the
            // one rule that governs every other animation in the build.
            pathLength={1}
            className="animate-draw"
          />
        ))}

        {/* The latest reading, marked with a vertical tick rather than a dot.
            The viewBox is stretched horizontally to whatever width the row
            has, so a circle would render as an ellipse of unpredictable
            eccentricity — a tick is the same shape at every width. */}
        <line
          x1={x(latest.index)}
          x2={x(latest.index)}
          y1={y(latest.value) - 4}
          y2={y(latest.value) + 4}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          className="text-ink"
        />
      </svg>

      <figcaption className="mt-1 flex flex-wrap justify-between gap-x-3 text-2xs text-ink-faint">
        <span className="tabular-nums">
          meeting 1–{values.length} · low {min.toFixed(decimals)} · high{' '}
          {max.toFixed(decimals)}
        </span>
        {reference !== null && (
          <span className="tabular-nums">
            dashed: {referenceLabel} {reference.toFixed(decimals)}
          </span>
        )}
      </figcaption>
    </figure>
  )
}
