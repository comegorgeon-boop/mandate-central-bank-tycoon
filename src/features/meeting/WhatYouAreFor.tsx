import { orientation, type RunConfig } from '../../simulation/index.ts'

/**
 * What the player is trying to do — the five lines, rendered.
 *
 * Two placements, one component:
 *
 *  - **before the first meeting**, on the briefing, where it is the first thing
 *    read and is not optional;
 *  - **behind one gesture at every meeting**, because the question was not
 *    asked once. *"Mon ami n'a pas posé la question une fois, il l'a posée en
 *    boucle."*
 *
 * `compact` is the second of those: the same five points, tighter, inside a
 * disclosure rather than as a page.
 *
 * The content is `simulation/explain/orientation.ts` and is derived from the
 * configuration — the objective from the institution, the lag from the kernel,
 * the term from `TENURE`. Nothing here writes a figure of its own, because an
 * orientation screen is the one text a player takes entirely on trust and this
 * project has shipped the same quantity stated three ways before.
 */
export function WhatYouAreFor({
  config,
  compact = false,
}: {
  readonly config: RunConfig
  readonly compact?: boolean
}) {
  const points = orientation(config)

  return (
    <ol
      className={compact ? 'space-y-2.5' : 'space-y-4'}
      aria-label="What you are trying to do"
    >
      {points.map((point, index) => (
        <li key={point.title} className="flex gap-3">
          {/* The number is the only ornament. It says "there are five of these
              and this is the second", which is most of what makes a short
              briefing feel finishable rather than open-ended. */}
          <span
            aria-hidden="true"
            className={`shrink-0 font-mono tabular-nums ${
              compact ? 'text-2xs text-ink-faint' : 'text-xs text-onwood-faint'
            }`}
          >
            {index + 1}
          </span>
          <div>
            <h3
              className={
                compact
                  ? 'text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft'
                  : 'text-sm font-semibold text-onwood'
              }
            >
              {point.title}
            </h3>
            <p
              className={`mt-0.5 ${
                compact
                  ? 'text-sm leading-relaxed text-ink-soft'
                  : 'text-sm leading-relaxed text-onwood-soft'
              }`}
            >
              {point.body}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}
