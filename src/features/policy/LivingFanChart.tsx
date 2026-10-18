import { useId } from 'react'
import type { LivingFan } from '../../simulation/index.ts'

/**
 * The forecast, and where your hand on the dial is taking it.
 *
 * Two paths on one set of axes: the fan the staff published, and the central
 * path under the move currently selected. Drag the slider and the second one
 * bends away from the first while you watch.
 *
 * ## The rule this is built to
 *
 * *Every animation must carry information, or it is wallpaper.* There is no
 * transition here, no easing, no entrance. What moves is the line, and it
 * moves because the number moved — the shape **is** the information, and the
 * movement is the player's own hand. A fan that slid in prettily on mount
 * would be decoration; a fan that bends as you drag is the consequence of a
 * decision arriving before the decision.
 *
 * ## And the rule about width
 *
 * The band never narrows. Uncertainty is a property of the economy, not of
 * having made up your mind, and a fan that tightened when the player tightened
 * would be flattering them. Both paths carry the same spread; only the centre
 * moves. See `simulation/policy/livingFan.ts`.
 */

const WIDTH = 320
const HEIGHT = 150
const PAD = { left: 4, right: 6, top: 10, bottom: 22 }

function describe(fan: LivingFan): string {
  const last = fan.bands[fan.bands.length - 1]
  const move = last.moved - last.held
  const horizon = `${last.horizonMeetings} meetings`
  const from = fan.now === null ? 'no reading published yet' : `${fan.now.toFixed(1)} now`
  if (Math.abs(move) < 0.05) {
    return (
      `${fan.label}: the published forecast runs from ${from} ` +
      `to ${last.held.toFixed(1)} in ${horizon}. The move currently selected ` +
      `does not shift it measurably.`
    )
  }
  return (
    `${fan.label}: the published forecast ends at ${last.held.toFixed(1)} in ` +
    `${horizon}. The move currently selected takes it to ${last.moved.toFixed(1)}, ` +
    `${Math.abs(move).toFixed(2)} points ${move > 0 ? 'higher' : 'lower'}.`
  )
}

export function LivingFanChart({ fan }: { readonly fan: LivingFan }) {
  const id = useId()
  const maxHorizon = fan.bands[fan.bands.length - 1].horizonMeetings
  // Where the lines start. With a published reading it is today; without one
  // it is the nearest horizon the staff have put a number on, which is the
  // honest answer rather than a point invented to anchor a curve.
  const start =
    fan.now === null
      ? { horizon: fan.bands[0].horizonMeetings, held: fan.bands[0].held, moved: fan.bands[0].moved }
      : { horizon: 0, held: fan.now, moved: fan.now }

  const values = [
    start.held,
    ...fan.bands.flatMap((band) => [band.p10, band.p90, band.held, band.moved]),
    ...(fan.reference === null ? [] : [fan.reference]),
  ]
  const low = Math.min(...values)
  const high = Math.max(...values)
  const span = Math.max(0.6, high - low)
  const pad = span * 0.12

  const x = (horizon: number): number =>
    PAD.left +
    (horizon / maxHorizon) * (WIDTH - PAD.left - PAD.right)
  const y = (value: number): number =>
    PAD.top +
    ((high + pad - value) / (span + 2 * pad)) * (HEIGHT - PAD.top - PAD.bottom)

  /** A filled band between two series, starting from today's single point. */
  const area = (
    lower: (b: LivingFan['bands'][number]) => number,
    upper: (b: LivingFan['bands'][number]) => number,
  ): string => {
    const top = fan.bands.map((b) => `${x(b.horizonMeetings)},${y(upper(b))}`)
    const bottom = [...fan.bands]
      .reverse()
      .map((b) => `${x(b.horizonMeetings)},${y(lower(b))}`)
    return `M ${x(start.horizon)},${y(start.held)} L ${top.join(' L ')} L ${bottom.join(' L ')} Z`
  }

  const line = (read: (b: LivingFan['bands'][number]) => number, from: number): string =>
    `M ${x(start.horizon)},${y(from)} L ` +
    fan.bands.map((b) => `${x(b.horizonMeetings)},${y(read(b))}`).join(' L ')

  const last = fan.bands[fan.bands.length - 1]
  const moved = Math.abs(last.moved - last.held) >= 0.02

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-labelledby={`${id}-desc`}
      >
        <desc id={`${id}-desc`}>{describe(fan)}</desc>

        {/* The band the staff published. Two shades, so the shape reads as a
            distribution rather than as an error bar. */}
        <path d={area((b) => b.p10, (b) => b.p90)} className="fill-ink-faint opacity-15" />
        <path d={area((b) => b.p30, (b) => b.p70)} className="fill-ink-faint opacity-20" />

        {fan.reference !== null && (
          <line
            x1={x(0)}
            x2={x(maxHorizon)}
            y1={y(fan.reference)}
            y2={y(fan.reference)}
            className="stroke-edge-strong"
            strokeWidth={1}
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* What happens if you do nothing. */}
        <path
          d={line((b) => b.held, start.held)}
          fill="none"
          className="stroke-ink-faint"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />

        {/* And what happens if you do this. Drawn second, so it sits on top. */}
        <path
          d={line((b) => b.moved, start.moved)}
          fill="none"
          className={moved ? 'stroke-accent' : 'stroke-ink-faint'}
          strokeWidth={moved ? 2.25 : 1.5}
          vectorEffect="non-scaling-stroke"
        />

        {fan.now !== null && (
          <circle cx={x(0)} cy={y(fan.now)} r={2.5} className="fill-ink" />
        )}

        {/* The horizons, named on the axis. Without them the chart is a shape
            with no units and the reader has to take "in eight meetings" from
            the caption and map it onto a width by guessing. */}
        {fan.bands.map((band) => (
          <text
            key={band.horizonMeetings}
            x={x(band.horizonMeetings)}
            y={HEIGHT - 6}
            textAnchor={band === fan.bands[fan.bands.length - 1] ? 'end' : 'middle'}
            className="fill-ink-faint text-[9px]"
          >
            +{band.horizonMeetings}
          </text>
        ))}
      </svg>

      {/* The endpoints, printed. The chart is the shape and these are the
          numbers: a reader who cannot see the chart loses nothing, and a
          reader who can does not have to estimate off an axis. */}
      <figcaption className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 text-2xs text-ink-faint">
        <span>
          {fan.label} ·{' '}
          {fan.now === null ? (
            'no release yet'
          ) : (
            <>
              now{' '}
              <span className="tabular-nums text-ink-soft">{fan.now.toFixed(1)}</span>
            </>
          )}
          {fan.reference !== null && (
            <>
              {' '}· {fan.referenceLabel}{' '}
              <span className="tabular-nums">{fan.reference.toFixed(1)}</span>
            </>
          )}
        </span>
        <span>
          in {last.horizonMeetings} meetings:{' '}
          <span className="tabular-nums text-ink-soft">{last.held.toFixed(1)}</span>
          {moved && (
            <>
              <span aria-hidden="true" className="mx-1">→</span>
              <span className="tabular-nums font-semibold text-accent-strong">
                {last.moved.toFixed(1)}
              </span>
            </>
          )}
        </span>
      </figcaption>
    </figure>
  )
}
