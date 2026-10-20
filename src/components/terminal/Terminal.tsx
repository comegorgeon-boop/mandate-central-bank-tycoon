import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { RollingNumber, useChangeFlash } from '../engraving/motion.tsx'

/**
 * The terminal: the furniture every screen in the game is built from.
 *
 * ## The reference, and the one thing it turns on
 *
 * A dealing-room terminal — amber on near-black, the genre rather than any
 * one maker's machine. Four things make it that and not a web page:
 *
 *  1. **Panels pave.** They are tiled edge to edge with a one-pixel rule
 *     between them and no margin outside them, so the screen is a grid of
 *     lit surfaces rather than a column of cards floating in a void. There is
 *     no gutter, no radius, no shadow.
 *  2. **Monospace carries everything numeric** — the figures *and* their
 *     labels — set in columns with the decimal points under each other.
 *  3. **Amber is the only colour that is not a verdict.** Green rises, red
 *     falls, light grey is read. Nothing else has a colour.
 *  4. **Values flash when they change**, half a second, then back to normal.
 *
 * ## The reservation that shapes the API
 *
 * > "un terminal est DENSE, et les chiffres me noient. Les deux se concilient
 * > parce que la densité d'un terminal est STABLE EN POSITION : on apprend où
 * > regarder et on ignore le reste. Donc les colonnes ne bougent JAMAIS d'une
 * > réunion à l'autre."
 *
 * That is the real constraint and it is why `Row` takes a fixed label width
 * rather than letting flexbox decide. A dense screen is only readable if a
 * number is *in the same place every time* — then the eye saturates on the
 * two or three cells it cares about and genuinely does not see the rest. A
 * dense screen whose columns reflow is unreadable at any density, because
 * every reading starts with a search.
 *
 * So: the label column is a constant, values are right-aligned and
 * `tabular-nums`, and a row that has nothing to say this meeting renders an
 * em dash rather than collapsing. **Nothing here may ever size to content.**
 */

/** The label column, in ch. One number, used by every row in the game. */
const LABEL_CH = 17

/**
 * A panel: a lit surface with a title strip, tiled against its neighbours.
 *
 * `span` is in grid columns on a wide screen; everything is full width on a
 * phone. Panels never carry their own margin — the grid's one-pixel gap, set
 * by the ground showing through, is the only separation there is.
 */
export function Panel({
  title,
  right,
  span = 1,
  children,
  className = '',
}: {
  readonly title: string
  /** A reading or a status, set hard right in the title strip. */
  readonly right?: React.ReactNode
  readonly span?: 1 | 2 | 3
  readonly children: React.ReactNode
  readonly className?: string
}) {
  const spanClass =
    span === 3 ? 'sm:col-span-3' : span === 2 ? 'sm:col-span-2' : 'sm:col-span-1'
  return (
    <section
      className={`flex min-w-0 flex-col bg-panel ${spanClass} ${className}`}
      aria-label={title}
    >
      <header className="flex items-baseline justify-between gap-2 border-b border-edge-panel bg-raised px-2 py-1">
        <h2 className="truncate font-mono text-2xs font-semibold uppercase tracking-[0.18em] text-accent-onwood">
          {title}
        </h2>
        {right !== undefined && (
          <span className="shrink-0 font-mono text-2xs tabular-nums text-ink-muted">
            {right}
          </span>
        )}
      </header>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  )
}

/**
 * The grid panels pave. One column on a phone, three on a wide screen.
 *
 * The gap is one pixel of the page ground, which is darker than any panel —
 * so the rules between panels are the machine showing through rather than
 * borders drawn on top of it. That is why panels need no border of their own
 * and why the whole thing reads as one surface.
 */
export function PanelGrid({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-px bg-page sm:grid-cols-3">{children}</div>
  )
}

/**
 * One line of the terminal: a label in a fixed column, a value hard right.
 *
 * The label column is `LABEL_CH` wide *always*, whatever the label says, and
 * the value is right-aligned and tabular — which is what puts the decimal
 * points under each other down a panel without a table.
 */
export function Row({
  label,
  children,
  tone = 'plain',
  onClick,
  title,
}: {
  readonly label: string
  readonly children: React.ReactNode
  readonly tone?: 'plain' | 'quiet'
  /** Makes the row a button — for an indicator that opens its own card. */
  readonly onClick?: () => void
  readonly title?: string
}) {
  const body = (
    <>
      <span
        style={{ width: `${LABEL_CH}ch` }}
        className={`shrink-0 truncate font-mono text-2xs uppercase tracking-[0.1em] ${
          tone === 'quiet' ? 'text-ink-muted' : 'text-ink-secondary'
        }`}
      >
        {label}
      </span>
      <span className="min-w-0 flex-1 truncate text-right font-mono text-xs tabular-nums text-ink-primary">
        {children}
      </span>
    </>
  )

  if (onClick !== undefined) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        className="flex w-full items-baseline gap-2 border-b border-edge-panel px-2 py-[3px] text-left last:border-b-0 hover:bg-raised"
      >
        {body}
      </button>
    )
  }

  return (
    <div
      title={title}
      className="flex items-baseline gap-2 border-b border-edge-panel px-2 py-[3px] last:border-b-0"
    >
      {body}
    </div>
  )
}

/**
 * A figure that rolls to its value and flashes when it changes.
 *
 * Green up, red down, half a second, then back to grey. **Light marks the
 * change, never the state** — a cell that is permanently coloured is
 * wallpaper by the third meeting, and a cell that flares for five hundred
 * milliseconds is the one thing on a dense screen the eye cannot miss.
 *
 * `invert` is for the figures where up is bad. Inflation rising is not a
 * green event, and a terminal that painted it green because the number went
 * up would be teaching the opposite of the game.
 */
export function Figure({
  value,
  decimals = 2,
  suffix = '',
  prefix = '',
  invert = false,
  size = 'normal',
  className = '',
}: {
  readonly value: number
  readonly decimals?: number
  readonly suffix?: string
  readonly prefix?: string
  /** True where a rise is bad news: inflation, unemployment, spreads. */
  readonly invert?: boolean
  readonly size?: 'normal' | 'hero'
  readonly className?: string
}) {
  const flash = useChangeFlash(value)
  const rising = flash === 'up'
  const falling = flash === 'down'
  const good = invert ? falling : rising
  const bad = invert ? rising : falling

  const colour =
    good ? 'text-good-onwood' : bad ? 'text-bad-onwood' : 'text-ink-primary'

  return (
    <span
      className={`tabular-nums transition-colors duration-150 ${colour} ${
        size === 'hero' ? 'font-mono text-4xl font-semibold leading-none sm:text-5xl' : ''
      } ${className}`}
    >
      <RollingNumber value={value} decimals={decimals} prefix={prefix} suffix={suffix} />
    </span>
  )
}

/** An arrow, for a reading that has a direction. Never on its own. */
export function Arrow({
  direction,
  invert = false,
}: {
  readonly direction: 'up' | 'down' | 'flat'
  readonly invert?: boolean
}) {
  if (direction === 'flat') {
    return (
      <span aria-label="unchanged" className="text-ink-muted">
        →
      </span>
    )
  }
  const good = invert ? direction === 'down' : direction === 'up'
  return (
    <span
      aria-label={direction === 'up' ? 'rising' : 'falling'}
      className={good ? 'text-good-onwood' : 'text-bad-onwood'}
    >
      {direction === 'up' ? '▲' : '▼'}
    </span>
  )
}

/**
 * The notch: a one-frame pulse each time a stepped control passes a detent.
 *
 * The brief asks for the dial to *click* at every 25 basis points, and there
 * is no sound in this game and never will be — so the click is visual. A
 * short scale impulse on the figure, 90 ms, triggered on the step index
 * rather than the value, so dragging across six notches gives six pulses and
 * not one long smear.
 */
export function useNotch(step: number) {
  const reduced = useReducedMotion()
  const [pulse, setPulse] = useState(0)
  const previous = useRef(step)

  useEffect(() => {
    if (step === previous.current) return
    previous.current = step
    if (reduced) return
    setPulse((n) => n + 1)
  }, [step, reduced])

  return pulse
}

/** Wraps a figure so it ticks when `pulse` changes. */
export function Notched({
  pulse,
  children,
}: {
  readonly pulse: number
  readonly children: React.ReactNode
}) {
  const reduced = useReducedMotion()
  if (reduced) return <>{children}</>
  return (
    <motion.span
      key={pulse}
      initial={{ scale: 1.045 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.09, ease: 'easeOut' }}
      style={{ display: 'inline-block', transformOrigin: 'right center' }}
    >
      {children}
    </motion.span>
  )
}
