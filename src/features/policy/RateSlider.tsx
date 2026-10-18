import { useId } from 'react'

/**
 * The rate, as a slider with the two references marked on the track.
 *
 * Thirteen buttons in two wrapped rows was the widest control on the desk and
 * the least legible: a row of rectangles gives a reader no sense of *distance*,
 * and distance is the whole content of a rate decision. How far is this from
 * where you are? How far from what the rule says? How far from what markets
 * have already priced? Those three questions have one answer each on a track
 * and none at all on a keypad.
 *
 * ## Why a native range input
 *
 * Keyboard arrows, Home and End, page up and down, the correct ARIA role, the
 * platform's own focus ring and every assistive technology's idea of what a
 * slider is — all of it for free and none of it reimplemented slightly wrong.
 * `step` is the detent: this snaps to the increment the engine allows, because
 * central banks move in quarter points and a continuous dial would be a
 * control offering values the validator rejects.
 *
 * ## The two ghosts
 *
 * The Taylor benchmark and the rate markets have priced, drawn on the track
 * rather than quoted in a sentence somewhere else. The gap between the handle
 * and the market ghost **is** the surprise — that is what a surprise is — and
 * a player should be able to see it as a length rather than subtract two
 * numbers to find it.
 *
 * Both are references and neither is an instruction. The Taylor rule is a
 * rule of thumb that accounts for nothing beyond inflation and the gap, and
 * the priced path is what others believe, not what is right. The copy says so.
 *
 * ## And one thing that is not a reference
 *
 * `forbidden` shades the part of the track that *costs something to stand in*.
 * It exists for the gold standard of 1929-33, where there is a floor under the
 * rate that the player did not choose and crossing it drains the gold stock —
 * and the whole point of that mechanic is that the constraint is visible
 * before it is crossed rather than explained afterwards. A band, not a tick,
 * because everything below the floor is the danger and not just the floor
 * itself.
 *
 * Deliberately **not** a limit on the input. The player may cut through it;
 * they simply pay. A control that refused would be a different game, and a
 * duller one: the Federal Reserve of 1931 could have held the rate down and
 * chose not to.
 */

export interface GhostMarker {
  readonly id: 'taylor' | 'market'
  readonly label: string
  /** Where it sits, in basis points of move from the current rate. */
  readonly basisPoints: number
  /** The rate it corresponds to, for the readout. */
  readonly rate: number
}

/** A region of the track that is reachable and costly. See the note above. */
export interface ForbiddenZone {
  /** Everything strictly below this move, in basis points, is in the zone. */
  readonly belowBasisPoints: number
  /** What the edge is called, in the player's words. */
  readonly label: string
}

/** Track width, in percent, inside which two labels would collide. */
const LABEL_WIDTH = 22

function percent(basisPoints: number, min: number, max: number): number {
  if (max <= min) return 50
  return ((basisPoints - min) / (max - min)) * 100
}

function signedBp(basisPoints: number): string {
  if (basisPoints === 0) return 'no change'
  return `${basisPoints > 0 ? '+' : '−'}${Math.abs(basisPoints)} bp`
}

export function RateSlider({
  label,
  currentRate,
  value,
  min,
  max,
  step,
  markers,
  forbidden = null,
  explains = true,
  onChange,
}: {
  readonly label: string
  readonly currentRate: number
  /** The selected move, in basis points. */
  readonly value: number
  readonly min: number
  readonly max: number
  readonly step: number
  readonly markers: readonly GhostMarker[]
  readonly forbidden?: ForbiddenZone | null
  /** Whether the control explains its own marks. See the note at the bottom. */
  readonly explains?: boolean
  readonly onChange: (basisPoints: number) => void
}) {
  const id = useId()
  const resulting = currentRate + value / 100

  // A ghost outside the range the desk allows is still worth drawing: pinned
  // to the end of the track and labelled as beyond it, because "the rule wants
  // more than this desk can do in one meeting" is information, and a marker
  // that silently vanished would read as "the rule agrees with you".
  const placed = markers.map((marker) => {
    const clamped = Math.min(max, Math.max(min, marker.basisPoints))
    return {
      ...marker,
      clamped,
      offScale: clamped !== marker.basisPoints,
      left: percent(clamped, min, max),
    }
  })

  // Two references can land on the same point of the track — a committee that
  // agrees with the market is not a rare state — and two labels centred there
  // print on top of each other. The second one is lifted a line, which keeps
  // both readable without moving either tick off the value it marks.
  const drawn = placed.map((marker, index) => ({
    ...marker,
    stacked: placed
      .slice(0, index)
      .some((earlier) => Math.abs(earlier.left - marker.left) < LABEL_WIDTH),
  }))

  const market = markers.find((marker) => marker.id === 'market') ?? null
  const surprise = market === null ? null : value - market.basisPoints

  // The costly region, as a share of the track. Clamped to it: a floor above
  // the top of the range shades the whole track, which is the honest picture
  // of a meeting where every move available is one that drains reserves.
  const zone =
    forbidden === null
      ? null
      : {
          ...forbidden,
          width: Math.max(
            0,
            Math.min(100, percent(forbidden.belowBasisPoints, min, max)),
          ),
          inside: value < forbidden.belowBasisPoints,
        }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        <span className="tabular-nums text-sm text-ink-soft">
          {currentRate.toFixed(2)} %
          <span aria-hidden="true" className="mx-1.5 text-ink-faint">
            →
          </span>
          <span className="font-semibold text-ink">{resulting.toFixed(2)} %</span>
        </span>
      </div>

      {/* The track. The ghosts are drawn under the input and the input itself
          is transparent-tracked, so the handle sits over them rather than
          beside them — a reference the handle cannot reach is a reference the
          player cannot read a distance against. */}
      <div className="relative mt-9 px-0.5 pb-1">
        {drawn.map((marker) => (
          <div
            key={marker.id}
            className={`pointer-events-none absolute flex flex-col ${
              marker.stacked ? '-top-[2.35rem]' : '-top-5'
            }`}
            // The tick is centred on its value; the *label* is anchored to
            // whichever side keeps it on the page. A label centred on a mark
            // at 95 % of the track hangs off the edge of the panel, which is
            // how the reference furthest from the handle — the one worth
            // reading — became the one you could not read.
            // Anchored a hair inside the track at either extreme: a marker
            // pinned exactly to 100 % puts its own off-scale arrow half off
            // the panel, which is the one glyph carrying the information that
            // it is off-scale.
            style={{
              left: marker.left > 70 ? undefined : `${Math.max(1, marker.left)}%`,
              right: marker.left > 70 ? `${Math.max(1, 100 - marker.left)}%` : undefined,
              alignItems: marker.left > 70 ? 'flex-end' : 'flex-start',
              transform: marker.left > 70 ? 'none' : 'translateX(-1px)',
            }}
          >
            <span
              className={`text-2xs whitespace-nowrap ${
                marker.id === 'market' ? 'text-accent-strong' : 'text-ink-faint'
              }`}
            >
              {marker.offScale && marker.left <= 70 ? '◂ ' : ''}
              {marker.label}
              {marker.offScale && marker.left > 70 ? ' ▸' : ''}
            </span>
            <span
              aria-hidden="true"
              className={`mt-0.5 w-px ${marker.stacked ? 'h-[1.6rem]' : 'h-3'} ${
                marker.id === 'market' ? 'bg-accent' : 'bg-edge-accent'
              }`}
            />
          </div>
        ))}

        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-valuetext={
            `${signedBp(value)}, taking the rate to ${resulting.toFixed(2)} per cent` +
            // Said in the value text, not only drawn: a keyboard player
            // arrowing down through the floor has to be told they have
            // crossed it, and a shaded band tells them nothing.
            (zone?.inside === true ? `. Below the floor: ${zone.label}` : '')
          }
          className="w-full accent-[var(--accent)]"
        />

        {/* The costly region, drawn as a strip *under* the dial rather than
            over it.
            The first version painted a tinted band across the groove itself,
            and on the meeting that matters — the rate already at its floor,
            so that every move on the track is below the gold floor — it
            covered the whole control and hid the handle. A dial you cannot
            read is worse than a constraint you cannot see. Underneath, it is
            a rule along the bottom of the track saying how much of the dial
            costs something, which is the same information and does not take
            the instrument with it. */}
        {zone !== null && zone.width > 0 && (
          <div aria-hidden="true" className="relative h-1">
            <div
              className="absolute left-0 top-0 h-0.5 rounded-full bg-bad"
              style={{ width: `${zone.width}%` }}
            />
          </div>
        )}

        <div className="flex justify-between gap-2 text-2xs tabular-nums text-ink-faint">
          <span>{signedBp(min)}</span>
          {zone === null || zone.width <= 0 ? (
            <span>hold</span>
          ) : (
            <span className="text-bad">{zone.label} ◂</span>
          )}
          <span>{signedBp(max)}</span>
        </div>
      </div>

      <p className="mt-1 text-sm text-ink">
        <span className="font-semibold tabular-nums">{signedBp(value)}</span>
        {surprise !== null && (
          <>
            {' · '}
            {Math.abs(surprise) < step / 2 ? (
              <span className="text-ink-soft">
                exactly what markets have priced
              </span>
            ) : (
              <span className="text-accent-strong">
                {signedBp(Math.abs(surprise))} {surprise > 0 ? 'above' : 'below'} what
                markets have priced
              </span>
            )}
          </>
        )}
      </p>

      {/* The gloss on the marks is a thing a reader needs once, and it sat
          under the dial at every meeting of every mandate. On the learning
          mandate it stays; above it, the step note alone — which is a fact
          about the control rather than a lesson about the references. */}
      <p className="mt-0.5 text-2xs text-ink-faint">
        Moves in {step} bp steps — arrow keys work.
        {explains && (
          <>
            {' '}The marks are references, not instructions: the rule of thumb
            accounts for nothing beyond inflation and the gap, and the priced
            path is what others believe rather than what is right.
          </>
        )}
      </p>
    </div>
  )
}
