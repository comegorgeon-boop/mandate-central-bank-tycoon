import { useState } from 'react'
import type { Debate, DoctrineSpeaker } from '../../simulation/index.ts'

/**
 * The committee arguing, at the table.
 *
 * It replaces the single smooth recommendation. Two opposed cases argued well
 * are worth more than one lisse verdict, for the reason a player put plainly:
 * the disagreement is the thing being examined on. A staff line saying "raise
 * 25 bp" teaches a number; two economists disagreeing about whether to raise
 * at all teaches why the number is contested.
 *
 * ## The density constraint
 *
 * This session spent weeks taking text off these screens, and three advisers
 * arguing is a lot of text. So: the seated speakers' *positions* are always
 * visible — a name, a school, a number — and each full argument is one click
 * away. The room's spread is on the surface, because that single figure is
 * the most informative thing here: a committee 300 basis points apart is a
 * different situation from one that agrees, and you should be able to see
 * which without reading a word.
 *
 * The advisers not called are behind one more click, with their numbers, so
 * "what would the supervisor say" is answerable without being unavoidable.
 */

function Speaker({
  speaker,
  open,
  onToggle,
  selectedMove,
}: {
  readonly speaker: DoctrineSpeaker
  readonly open: boolean
  readonly onToggle: () => void
  readonly selectedMove: number
}) {
  const { doctrine, view } = speaker
  const agrees = Math.abs(view.basisPoints - selectedMove) < 13

  return (
    <li className="border-t border-edge first:border-t-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full flex-wrap items-baseline justify-between gap-x-3 py-2 text-left"
      >
        <span>
          <span className="font-medium text-ink">{doctrine.name}</span>
          <span className="ml-2 text-2xs uppercase tracking-[0.1em] text-ink-faint">
            {doctrine.school}
          </span>
        </span>
        <span
          className={`tabular-nums text-sm font-semibold ${
            agrees ? 'text-good-strong' : 'text-ink'
          }`}
        >
          {view.basisPoints === 0
            ? 'hold'
            : `${view.basisPoints > 0 ? '+' : '−'}${Math.abs(view.basisPoints)} bp`}
        </span>
      </button>

      {open && (
        <div className="animate-rise pb-3">
          <p className="text-sm leading-relaxed text-ink">{view.argument}</p>
          {speaker.rebuttal !== null && (
            <p className="mt-2 border-l-2 border-edge-accent pl-3 text-sm italic leading-relaxed text-ink-soft">
              {speaker.rebuttal}
            </p>
          )}
          <p className="mt-2 text-xs text-ink-faint">{view.evidence}</p>
          <p className="mt-1 text-2xs text-ink-faint">
            {doctrine.authorities.join(' · ')}
          </p>
        </div>
      )}
    </li>
  )
}

export function DebatePanel({
  debate,
  selectedMove,
}: {
  readonly debate: Debate
  /** What the player currently has on the dial, so agreement can be marked. */
  readonly selectedMove: number
}) {
  const [open, setOpen] = useState<string | null>(
    debate.speakers[0]?.doctrine.id ?? null,
  )
  const [showRest, setShowRest] = useState(false)

  if (debate.speakers.length === 0) return null

  return (
    <section aria-labelledby="debate-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 id="debate-heading" className="text-sm font-semibold text-ink">
          The committee
        </h3>
        <span className="text-xs text-ink-soft">
          {debate.disagreement === 0
            ? 'agreed'
            : `${debate.disagreement} bp apart`}
        </span>
      </div>

      <ul className="mt-1">
        {debate.speakers.map((speaker) => (
          <Speaker
            key={speaker.doctrine.id}
            speaker={speaker}
            selectedMove={selectedMove}
            open={open === speaker.doctrine.id}
            onToggle={() =>
              setOpen((current) =>
                current === speaker.doctrine.id ? null : speaker.doctrine.id,
              )
            }
          />
        ))}
      </ul>

      {debate.silent.length > 0 && (
        <div className="mt-2 border-t border-edge pt-2">
          <button
            type="button"
            aria-expanded={showRest}
            onClick={() => setShowRest((value) => !value)}
            className="text-2xs font-semibold uppercase tracking-[0.12em] text-ink-faint underline decoration-dotted underline-offset-2 hover:text-ink-soft"
          >
            The rest of the room ({debate.silent.length})
          </button>
          {showRest && (
            <ul className="mt-2 space-y-1">
              {debate.silent.map(({ doctrine, view }) => (
                <li
                  key={doctrine.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm"
                >
                  <span className="text-ink-soft">
                    {doctrine.name}
                    <span className="ml-2 text-2xs uppercase tracking-[0.1em] text-ink-faint">
                      {doctrine.school}
                    </span>
                  </span>
                  <span className="tabular-nums text-ink-soft">
                    {view.basisPoints === 0
                      ? 'hold'
                      : `${view.basisPoints > 0 ? '+' : '−'}${Math.abs(view.basisPoints)} bp`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
