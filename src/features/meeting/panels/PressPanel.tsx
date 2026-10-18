import { useMemo, useState } from 'react'
import {
  buildPressPage,
  type PressDesk,
  type PressStory,
  type RunSession,
} from '../../../simulation/index.ts'

/**
 * The morning paper, laid out as one.
 *
 * The news used to arrive in three places that did not know about each other:
 * a banner for the major event, a flat list of wire lines on the transition
 * screen, and warning clues somewhere else again. Nothing ranked them, so a
 * sovereign crisis and a routine data release carried identical weight, and a
 * player reported having stopped reading any of it by the fifth meeting.
 *
 * This is one page with a hierarchy, and the hierarchy is the whole point: the
 * lead is set in display type and the chaff is a single line in a column at
 * the bottom, so what matters is findable without reading. Everything on it is
 * derived by `simulation/press/pressPage.ts` from events that fired and
 * figures that were published — deterministic templates, no model, no call.
 *
 * The filler is real filler. It is marked as immaterial in the data and it is
 * printed anyway, because a page where everything matters never teaches
 * anybody to rank, and ranking is the skill.
 */

const DESK_LABEL: Readonly<Record<PressDesk, string>> = {
  economy: 'Economy',
  markets: 'Markets',
  institution: 'The Bank',
  world: 'World',
  business: 'Business',
}

function Lead({ story }: { readonly story: PressStory }) {
  return (
    <article className="border-b-2 border-edge pb-4">
      <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-accent-strong">
        {DESK_LABEL[story.desk]}
      </p>
      <h3 className="mt-1 font-display text-2xl leading-tight font-semibold text-ink sm:text-3xl">
        {story.headline}
      </h3>
      {story.standfirst !== null && (
        <p className="mt-2 text-base leading-relaxed text-ink-soft">
          {story.standfirst}
        </p>
      )}
    </article>
  )
}

function Major({ story }: { readonly story: PressStory }) {
  return (
    <article>
      <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
        {DESK_LABEL[story.desk]}
      </p>
      <h4 className="mt-0.5 font-display text-lg leading-snug font-semibold text-ink">
        {story.headline}
      </h4>
      {story.standfirst !== null && (
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">{story.standfirst}</p>
      )}
    </article>
  )
}

function Minor({ story }: { readonly story: PressStory }) {
  return (
    <article className="border-t border-edge pt-2.5">
      <h4 className="text-sm font-semibold text-ink">
        <span className="mr-2 text-2xs font-semibold uppercase tracking-[0.12em] text-ink-faint">
          {DESK_LABEL[story.desk]}
        </span>
        {story.headline}
      </h4>
      {story.standfirst !== null && (
        <p className="mt-0.5 text-sm text-ink-soft">{story.standfirst}</p>
      )}
    </article>
  )
}

export function PressPanel({ session }: { readonly session: RunSession }) {
  const page = useMemo(
    () =>
      buildPressPage({
        state: session.state,
        observation: session.observation,
        newswire: session.newswire,
        majorEvent: session.majorEvent,
        minorEvents: session.minorEvents,
      }),
    [session],
  )
  const [showBriefs, setShowBriefs] = useState(false)

  const lead = page.stories.find((story) => story.prominence === 'lead') ?? null
  const majors = page.stories.filter((story) => story.prominence === 'major')
  const minors = page.stories.filter((story) => story.prominence === 'minor')
  const briefs = page.stories.filter((story) => story.prominence === 'brief')

  return (
    <section aria-labelledby="press-heading">
      <header className="border-b-4 border-double border-edge pb-2 text-center">
        <h2
          id="press-heading"
          className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl"
        >
          {page.masthead}
        </h2>
        <p className="mt-0.5 text-2xs uppercase tracking-[0.2em] text-ink-faint">
          {page.dateline}
        </p>
      </header>

      <div className="mt-4 space-y-4">
        {lead !== null ? (
          <Lead story={lead} />
        ) : (
          <p className="text-sm text-ink-soft">
            A quiet quarter: nothing happened that bears on the decision. That is
            itself worth noticing — most quarters in a central bank's life are
            like this one, and the ones that are not announce themselves.
          </p>
        )}

        {majors.length > 0 && (
          <div className="grid gap-4 border-b border-edge pb-4 sm:grid-cols-2">
            {majors.map((story) => (
              <Major key={story.id} story={story} />
            ))}
          </div>
        )}

        {minors.length > 0 && (
          <div className="space-y-2.5">
            {minors.map((story) => (
              <Minor key={story.id} story={story} />
            ))}
          </div>
        )}
      </div>

      {briefs.length > 0 && (
        <div className="mt-5 border-t border-edge pt-3">
          <button
            type="button"
            aria-expanded={showBriefs}
            onClick={() => setShowBriefs((open) => !open)}
            className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-faint underline decoration-dotted underline-offset-2 hover:text-ink-soft"
          >
            Also reported ({briefs.length})
          </button>
          {showBriefs && (
            <ul className="mt-2 space-y-1">
              {briefs.map((story) => (
                <li key={story.id} className="text-sm text-ink-faint">
                  <span className="mr-2 text-2xs uppercase tracking-[0.12em]">
                    {DESK_LABEL[story.desk]}
                  </span>
                  {story.headline}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-ink-faint">
            {showBriefs
              ? 'None of these bears on the decision. A paper is mostly this, and the quarter you spend learning to skip it is the quarter you start reading the rest properly.'
              : 'Collapsed by default. None of it bears on the decision.'}
          </p>
        </div>
      )}
    </section>
  )
}
