import type { RegimeObjective } from '../objective.ts'

/**
 * What winning looks like at this meeting, stated before the decision.
 *
 * Placed above the tabs rather than inside one, next to the stance strip, for
 * the same reason the stance strip is there: an objective that is only visible
 * on the panel you happen to have open is an objective you will forget you are
 * being judged against.
 *
 * It is deliberately loud only when the regime has displaced the standing
 * objective. A banner repeating "get inflation to 2 %" at every meeting of
 * every mandate is furniture; one that changes, and says why it changed, is
 * information.
 */
export function ObjectivePanel({ objective }: { readonly objective: RegimeObjective }) {
  return (
    <section
      aria-labelledby="objective-heading"
      className={`rounded border p-3 ${
        objective.displaced
          ? 'border-accent bg-accent-surface'
          : 'border-edge-room bg-room'
      }`}
    >
      {/* `on-accent-surface` rather than `accent-onwood`, because
          `bg-accent-surface` is the one surface in the token file that changes
          material between the two directions — walnut in one, cream paper in
          the other — and brass-on-dark read at 1.43:1 on the cream. See the
          token's own note. */}
      <p
        className={`text-xs uppercase tracking-wide ${
          objective.displaced ? 'text-on-accent-surface' : 'text-onwood-faint'
        }`}
      >
        {objective.displaced ? 'The objective has moved' : 'What you are playing for'}
      </p>
      <h2
        id="objective-heading"
        className={`mt-1 text-base font-semibold ${
          objective.displaced ? 'text-on-accent-surface' : 'text-onwood'
        }`}
      >
        {objective.goal}
      </h2>
      <p
        className={`mt-1 text-sm ${
          objective.displaced ? 'text-on-accent-surface-soft' : 'text-onwood-soft'
        }`}
      >
        {objective.reason}
      </p>
    </section>
  )
}
