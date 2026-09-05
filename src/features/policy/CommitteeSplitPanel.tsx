import { committeeAgrees, type CommitteeView } from '../../simulation/index.ts'

/**
 * The committee, divided, with no resolution offered.
 *
 * The hard mandate's replacement for the staff recommendation, and deliberately
 * not simply its absence. Withdrawing advice outright would leave the player
 * with a blank screen and nothing to reason against, which teaches nothing; a
 * split committee gives them several colleagues who have read the same numbers
 * and reached different conclusions, which is what a governing council actually
 * looks like when the data are ambiguous — and deciding which of them is right
 * is the skill the mode is about.
 *
 * Nothing here marks a view as correct, orders them by plausibility, or offers
 * an average. The wings are labelled by how heavily they weight the inflation
 * miss, so the disagreement is legible as a disagreement about the *mandate*
 * rather than about the facts. Where the data are unambiguous the three
 * converge on their own, and the panel says so instead of manufacturing an
 * argument.
 */
export function CommitteeSplitPanel({
  views,
  selectedMove,
}: {
  readonly views: readonly CommitteeView[]
  /** What the player currently has selected, for an honest comparison. */
  readonly selectedMove: number
}) {
  if (views.length === 0) return null

  const agreed = committeeAgrees(views)
  const moveText = (basisPoints: number): string =>
    basisPoints === 0
      ? 'Hold'
      : `${basisPoints > 0 ? '+' : '−'}${Math.abs(basisPoints)} bp`

  return (
    <section
      aria-labelledby="committee-heading"
      className="mt-5 rounded border border-edge bg-sunk p-4"
    >
      <p className="text-xs uppercase tracking-wide text-ink-faint">
        Around the table
      </p>
      <h3 id="committee-heading" className="mt-1 text-base font-semibold text-ink">
        {agreed
          ? 'The committee is of one mind this meeting.'
          : 'The committee is divided.'}
      </h3>

      <ul className="mt-3 space-y-3">
        {views.map((view) => {
          const matches = selectedMove === view.basisPoints
          return (
            <li
              key={view.voice}
              className="border-l-2 border-edge pl-3"
            >
              <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="font-medium text-ink">{view.voice}</span>
                <span className="tabular-nums text-ink">
                  {moveText(view.basisPoints)}
                </span>
                {matches && (
                  <span className="text-xs text-ink-faint">
                    — what you have selected
                  </span>
                )}
              </p>
              <p className="mt-1 text-sm text-ink-soft">{view.reasoning}</p>
            </li>
          )
        })}
      </ul>

      <p className="mt-3 text-xs text-ink-faint">
        {agreed
          ? 'They differ in how heavily they weight the inflation miss against ' +
            'everything else, and on this data that difference does not change the ' +
            'answer. It will not always be so.'
          : 'They are reading the same published numbers. What separates them is how ' +
            'heavily each weights the inflation miss against everything else — which ' +
            'is a question about the mandate, not about the data. No recommendation ' +
            'is put to you: the chair decides.'}
      </p>
    </section>
  )
}
