import type { FrontPage, Stance } from '../../simulation/index.ts'

/**
 * The front pages, the morning after.
 *
 * The meeting's paper reports the world; this reports the committee, and it is
 * written by people with a view. In a currency area they do not have the same
 * one: a decision that reads as obviously correct from the aggregate reads as
 * a betrayal from inside the member already in the worst recession in the
 * union, and the difficulty of the job is that both readings are fair.
 *
 * Laid out as mastheads side by side so the disagreement is the first thing
 * seen, before either argument is read. Each carries the figures it is arguing
 * from, in small type underneath, because a newspaper with a view is exactly
 * the thing a player should be checking rather than believing.
 */

const STANCE_STYLE: Readonly<Record<Stance, string>> = {
  vindicated: 'border-good bg-good-surface',
  approving: 'border-edge bg-sunk',
  uneasy: 'border-accent bg-accent-surface',
  hostile: 'border-bad bg-bad-surface',
}

const STANCE_TEXT: Readonly<Record<Stance, string>> = {
  vindicated: 'text-good-strong',
  approving: 'text-ink',
  uneasy: 'text-accent-strong',
  hostile: 'text-bad-strong',
}

const STANCE_LABEL: Readonly<Record<Stance, string>> = {
  vindicated: 'Vindicated',
  approving: 'Can live with it',
  uneasy: 'Unconvinced',
  hostile: 'Hostile',
}

export function FrontPagesPanel({ pages }: { readonly pages: readonly FrontPage[] }) {
  if (pages.length === 0) return null
  const [lead, ...others] = pages

  return (
    <section aria-labelledby="frontpages-heading" className="mt-5">
      <h3
        id="frontpages-heading"
        className="text-xs font-semibold uppercase tracking-wide text-ink-soft"
      >
        {others.length > 0 ? 'The morning after, in three papers' : 'The morning after'}
      </h3>

      <article
        className={`animate-rise mt-2 rounded-lg border-l-4 p-3 ${STANCE_STYLE[lead.stance]}`}
      >
        <p className="text-2xs uppercase tracking-[0.16em] text-ink-faint">
          {lead.masthead}
        </p>
        <h4
          className={`mt-0.5 font-display text-xl leading-tight font-semibold ${STANCE_TEXT[lead.stance]}`}
        >
          {lead.headline}
        </h4>
        <p className="mt-1 text-sm leading-relaxed text-ink">{lead.standfirst}</p>
        <p className="mt-1 text-2xs text-ink-faint">{lead.evidence}</p>
      </article>

      {others.length > 0 && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {others.map((page) => (
            <article
              key={page.id}
              className={`animate-rise rounded-lg border-l-4 p-3 ${STANCE_STYLE[page.stance]}`}
            >
              <p className="flex items-baseline justify-between gap-2 text-2xs uppercase tracking-[0.14em] text-ink-faint">
                <span>{page.masthead}</span>
                <span className={STANCE_TEXT[page.stance]}>
                  {STANCE_LABEL[page.stance]}
                </span>
              </p>
              <h4
                className={`mt-0.5 font-display text-base leading-snug font-semibold ${STANCE_TEXT[page.stance]}`}
              >
                {page.headline}
              </h4>
              <p className="mt-1 text-sm leading-relaxed text-ink">{page.standfirst}</p>
              <p className="mt-1 text-2xs text-ink-faint">{page.evidence}</p>
            </article>
          ))}
        </div>
      )}

      {others.length > 0 && (
        <p className="mt-2 text-xs text-ink-faint">
          One rate, and they are not reading the same economy. What decides each
          paper&rsquo;s line is arithmetic — that member&rsquo;s own inflation
          against its own unemployment — so the figures under each are the ones
          to check it against.
        </p>
      )}
    </section>
  )
}
