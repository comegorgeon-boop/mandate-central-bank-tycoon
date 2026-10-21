import { useState } from 'react'
import { motion } from 'motion/react'
import type { InflationExplanation, LiveShock } from '../../simulation/index.ts'
import { meaningOf } from '../../simulation/index.ts'
import type { SeriesId } from '../../simulation/index.ts'
import { Panel, Row } from './Terminal.tsx'
import { RollingNumber, useReducedMotion } from '../engraving/motion.tsx'

/**
 * The explaining furniture: the order, the cause, the live shocks, the card.
 *
 * ## The brief these four pieces come from
 *
 * > "MOINS DE CHIFFRES, BEAUCOUP PLUS D'EXPLICATIONS SUR CEUX QUI RESTENT."
 *
 * And the four rules that let a lot more explanation exist without the screen
 * turning back into a document:
 *
 *  a. the quick meeting's word budget does **not** rise; the heavy meeting's
 *     may, because that is where explaining belongs
 *  b. an explanation is an **event**, not furniture — it appears when its
 *     number moves, holds, and withdraws
 *  c. **when it can be shown it is not written.** A spread that widens is a
 *     bar that widens; the sentence is the caption on a moving picture
 *  d. all of it lives in the terminal — no help box, no modal, no tour
 */

/**
 * The first sentence of a line that is full of decimal points.
 *
 * `detail.match(/^[^.]*\./)` is the obvious version and it is wrong here in a
 * way that was visible the moment it rendered: every order opens with a
 * figure, so *"1.4 points above the 2.0 % objective."* was truncated to
 * **"1."** — a banner that commanded "Bring inflation back down." and then
 * explained itself with a single digit.
 *
 * A sentence ends at a period followed by a space and a capital, or at the
 * end of the string. A decimal point is followed by a digit and so is never
 * one.
 */
function firstSentence(text: string): string {
  return text.match(/^.*?\.(?=\s+[A-Z]|\s*$)/)?.[0] ?? text
}

/**
 * The order banner: full width, amber, imperative.
 *
 * The loudest thing on the screen, and deliberately the only amber-filled
 * element above the action bar. "Le bandeau d'alerte en haut du terminal,
 * pleine largeur, en ambre."
 */
export function OrderBanner({
  command,
  detail,
  severity,
  compact = false,
  warnings = [],
}: {
  readonly command: string
  readonly detail: string
  readonly severity: 'calm' | 'watch' | 'urgent'
  /**
   * Severe end-condition warnings, absorbed from the standing line.
   *
   * These are the alarms that say a mandate is about to end, and they used
   * to live in a panel above this banner. An alarm above the instruction is
   * an alarm that gets read second — and an alarm in its own box is an alarm
   * the eye learns to skip. They belong inside the one thing the screen
   * promises is worth reading.
   */
  readonly warnings?: readonly string[]
  /**
   * On the quick surface, the first sentence only.
   *
   * The quick meeting's prose budget is twenty-four words and it is frozen —
   * *"24 mots, c'est gelé"* — and the order is what that budget is **for**.
   * It replaced the meeting line, so it inherits the line's allowance and not
   * a new one. The rest of the detail is not lost: it is on the heavy
   * surface, which is explicitly allowed to grow and is where explaining
   * belongs.
   */
  readonly compact?: boolean
}) {
  const edge =
    severity === 'urgent'
      ? 'border-bad'
      : severity === 'watch'
        ? 'border-edge-accent'
        : 'border-edge'

  return (
    <section
      aria-label="What this meeting is for"
      data-order=""
      className={`border-y-2 ${edge} bg-raised px-2 py-1.5`}
    >
      <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-accent-strong">
        {command}
      </p>
      <p className="mt-0.5 font-mono text-xs leading-relaxed text-ink-soft">
        {compact ? firstSentence(detail) : detail}
      </p>
      {warnings.length > 0 && (
        <ul className="mt-1 border-t border-bad pt-1">
          {warnings.map((warning) => (
            <li
              key={warning}
              role="alert"
              className="font-mono text-2xs leading-relaxed text-bad"
            >
              {warning}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * The cause of inflation, as a segmented bar.
 *
 * > "LA CAUSE EST UNE IMAGE. […] Je VOIS que l'énergie en fait les trois
 * > quarts, je ne le lis pas."
 *
 * Which is rule (c) in its purest form. The same fact as a sentence —
 * "energy accounts for roughly three quarters of the current miss" — is a
 * clause the player has to parse, hold and compare against last meeting's
 * clause. As a bar it is one glance, and the comparison across meetings is
 * free because the segments are in the same order every time.
 *
 * Segments are keyed and ordered by `id`, not by size, so a leg that grows
 * does not jump across the bar. A bar whose segments reorder cannot be read
 * across meetings at all, which would defeat the whole point of drawing it.
 */
const CAUSE_ORDER = ['energy', 'demand', 'wages', 'expectations', 'currency'] as const

const CAUSE_FILL: Record<string, string> = {
  energy: 'var(--color-amber-400)',
  demand: 'var(--color-down-400)',
  wages: 'var(--color-amber-600)',
  expectations: 'var(--color-term-text-2)',
  currency: 'var(--color-term-text-3)',
}

export function CauseBar({
  explanation,
  compact = false,
}: {
  readonly explanation: InflationExplanation
  /** On a quick meeting the bar appears without its legend. */
  readonly compact?: boolean
}) {
  const reduced = useReducedMotion()
  const ordered = CAUSE_ORDER.map((id) =>
    explanation.causes.find((cause) => cause.id === id),
  ).filter((cause): cause is NonNullable<typeof cause> => cause !== undefined)

  return (
    <div data-cause-bar="">
      {/*
        Taller than a progress bar, because the segments carry their names.

        > "LA BARRE « WHAT IS CAUSING IT » N'EST PAS ÉTIQUETÉE. Je vois des
        > segments, je ne sais pas lesquels. Chaque segment porte son nom en
        > deux mots, sinon l'image ne dit rien — et c'était tout l'intérêt."

        Exactly right, and it was the whole point of drawing it. An unlabelled
        stack of coloured blocks is not a decomposition, it is a progress bar
        with ideas — and a progress bar of nothing in particular is worse than
        the sentence it replaced, because at least the sentence said "energy".
      */}
      <div
        className="flex h-5 w-full overflow-hidden border border-edge"
        role="img"
        aria-label={ordered
          .map((c) => `${c.label} ${(c.share * 100).toFixed(0)} per cent`)
          .join(', ')}
      >
        {ordered.map((cause) => (
          <motion.span
            key={cause.id}
            initial={reduced ? false : { width: 0 }}
            animate={{ width: `${cause.share * 100}%` }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            style={{ background: CAUSE_FILL[cause.id], color: 'var(--color-term-void)' }}
            className="flex items-center justify-center overflow-hidden whitespace-nowrap px-1 font-mono text-[9px] font-semibold uppercase tracking-[0.06em]"
            title={`${cause.label}: ${cause.points >= 0 ? '+' : '−'}${Math.abs(cause.points).toFixed(2)} points`}
          >
            {/* The name goes *in* the segment when it fits. Below about a
                sixth of the bar it cannot, and the legend underneath carries
                it instead — so every segment is named either way, which is
                the rule, rather than only the ones that happen to be wide. */}
            {cause.share >= 0.17 ? cause.label : ''}
          </motion.span>
        ))}
      </div>

      {/* The legend names everything the bar could not, and repeats the
          shares. It is a list of labels rather than prose, so it costs the
          quick meeting's word budget nothing — which is why it can be here
          on both surfaces instead of only the heavy one. */}
      <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
        {ordered
          .filter((cause) => cause.share > 0.02)
          .map((cause) => (
            <li
              key={cause.id}
              className="flex items-center gap-1 font-mono text-2xs text-ink-soft"
            >
              <span
                aria-hidden="true"
                className="inline-block h-2 w-2 shrink-0"
                style={{ background: CAUSE_FILL[cause.id] }}
              />
              {cause.label}{' '}
              <span className="tabular-nums text-ink-faint">
                {(cause.share * 100).toFixed(0)}%
              </span>
              {!compact && (
                <span className="tabular-nums text-ink-faint">
                  ({cause.points >= 0 ? '+' : '−'}
                  {Math.abs(cause.points).toFixed(2)})
                </span>
              )}
            </li>
          ))}
      </ul>
    </div>
  )
}

/**
 * The live shocks panel: what is hitting, for how much longer, and what to do.
 *
 * The time left is a **draining bar and not a number**, which the brief asks
 * for and which is right for a reason worth stating: "4 meetings left" is a
 * fact to remember, a bar that is a third full is a thing you can see without
 * reading. It is rule (c) again, applied to duration.
 */
export function ShockPanel({
  shocks,
  compact = false,
}: {
  readonly shocks: readonly LiveShock[]
  /**
   * On the quick surface, the data without the paragraph.
   *
   * The shock still shows what it is, what it is doing to both figures and
   * how long it has left — none of which is prose, all of which is the
   * picture. What is held back is the *treatment*, which is thirty-five words
   * and was a third of the quick meeting's entire budget on its own.
   *
   * This is not a demotion of the most important thing on the screen. It is
   * rule (c): when it can be shown it is not written. The draining bar and
   * the two signed figures are the shock; the paragraph is the lesson, and
   * the lesson belongs where there is room to read it.
   */
  readonly compact?: boolean
}) {
  const reduced = useReducedMotion()

  return (
    <Panel
      title="Live shocks"
      span={2}
      right={shocks.length === 0 ? 'clear' : `${shocks.length} running`}
    >
      {shocks.length === 0 ? (
        <p className="px-2 py-2 font-mono text-2xs text-ink-faint">
          {compact ? 'Nothing still arriving.' : 'Nothing is still arriving. Everything in the figures is the economy itself.'}
        </p>
      ) : (
        <ul>
          {shocks.map((shock) => (
            <li key={shock.eventId} className="border-b border-edge px-2 py-1.5 last:border-b-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate font-mono text-xs font-semibold text-ink">
                  {shock.title}
                </span>
                <span className="shrink-0 font-mono text-2xs uppercase tracking-[0.14em] text-accent-strong">
                  {shock.character}
                </span>
              </div>

              <div className="mt-1 flex items-center gap-3 font-mono text-2xs tabular-nums">
                <span className={shock.onInflation >= 0 ? 'text-bad' : 'text-good'}>
                  prices {shock.onInflation >= 0 ? '+' : '−'}
                  {Math.abs(shock.onInflation).toFixed(2)}
                </span>
                <span className={shock.onJobs >= 0 ? 'text-bad' : 'text-good'}>
                  jobs {shock.onJobs >= 0 ? '+' : '−'}
                  {Math.abs(shock.onJobs).toFixed(2)}
                </span>
                {/* The draining bar. Not a number: a bar a third full is a
                    thing you see, where "4 meetings left" is a thing you have
                    to read and remember. */}
                <span
                  className="ml-auto flex h-1.5 w-20 shrink-0 border border-edge"
                  role="img"
                  aria-label={`about ${shock.meetingsLeft} meetings left`}
                  title={`about ${shock.meetingsLeft} meetings left`}
                >
                  <motion.span
                    initial={reduced ? false : { width: '100%' }}
                    animate={{ width: `${shock.remaining * 100}%` }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    style={{ background: 'var(--color-amber-500)' }}
                  />
                </span>
              </div>

              {!compact && (
                <p className="mt-1 font-mono text-2xs leading-relaxed text-ink-soft">
                  {shock.treatment}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

/**
 * An indicator row that opens its own card.
 *
 * > "Et un appui sur n'importe quel indicateur donne une fiche courte : ce que
 * > c'est, ce que ça change pour moi, ce que ça donne dans la vraie économie.
 * > C'est ça le glossaire, pas une page que personne n'ouvre."
 *
 * The card is *inside the row*, not a modal and not a separate page, which is
 * rule (d). A glossary nobody opens is a glossary somewhere else.
 */
export function ExplainedRow({
  seriesId,
  label,
  children,
}: {
  readonly seriesId: SeriesId
  readonly label: string
  readonly children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const meaning = meaningOf(seriesId)

  if (meaning === null) {
    return <Row label={label}>{children}</Row>
  }

  return (
    <>
      <Row
        label={label}
        onClick={() => setOpen((value) => !value)}
        title={meaning.is}
      >
        {children}
        <span aria-hidden="true" className="ml-1 text-ink-faint">
          {open ? '−' : '+'}
        </span>
      </Row>
      {open && (
        <div className="border-b border-edge bg-sunk px-2 py-1.5">
          <p className="font-mono text-2xs leading-relaxed text-ink-soft">
            {meaning.is}
          </p>
          <p className="mt-1 font-mono text-2xs leading-relaxed text-ink">
            {meaning.means}
          </p>
          <p className="mt-1 border-l-2 border-edge-accent pl-2 font-mono text-2xs leading-relaxed text-accent-strong">
            {meaning.do}
          </p>
        </div>
      )}
    </>
  )
}

/** A headline figure with its arrow and its cause, which is rank one. */
export function HeadlineFigure({
  label,
  value,
  decimals = 1,
  suffix = '%',
  because,
  invert = true,
  direction,
}: {
  readonly label: string
  readonly value: number
  readonly decimals?: number
  readonly suffix?: string
  /** The cause, in a few words. Never shown without it. */
  readonly because: string | null
  readonly invert?: boolean
  readonly direction: 'up' | 'down' | 'flat'
}) {
  const good = invert ? direction === 'down' : direction === 'up'
  const arrow = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '→'

  return (
    <div className="min-w-0 px-2 py-2">
      <p className="font-mono text-2xs uppercase tracking-[0.16em] text-ink-faint">
        {label}
      </p>
      <p className="flex items-baseline gap-2">
        <span className="font-mono text-3xl font-semibold tabular-nums text-ink">
          <RollingNumber value={value} decimals={decimals} suffix={suffix} />
        </span>
        <span
          className={`font-mono text-lg ${
            direction === 'flat'
              ? 'text-ink-faint'
              : good
                ? 'text-good'
                : 'text-bad'
          }`}
          aria-label={direction === 'flat' ? 'unchanged' : direction === 'up' ? 'rising' : 'falling'}
        >
          {arrow}
        </span>
      </p>
      {/* Never alone. The figure and why it is there arrive together or the
          player is back to reading a readout. */}
      {because !== null && (
        <p className="mt-0.5 font-mono text-2xs leading-snug text-ink-soft">
          {because}
        </p>
      )}
    </div>
  )
}
