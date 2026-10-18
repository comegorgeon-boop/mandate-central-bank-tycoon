import type { PackageProjection } from '../../simulation/index.ts'

/**
 * What the package is expected to do, shown before it is confirmed.
 *
 * The learning mandate's promise is that a decision can be anticipated and
 * then checked. This is the "anticipate" half: the model's own answer to what
 * this package does, produced by running the engine forward twice — once with
 * the package, once holding — and differencing them. See
 * `simulation/policy/projection.ts`.
 *
 * The counterfactual is shown, not just the outcome, because the outcome alone
 * is unreadable: inflation at 2.6 % in a year means nothing until you know it
 * would have been 2.9 % had you sat still. The difference is the decision.
 */
export function ProjectionPanel({
  projection,
}: {
  readonly projection: PackageProjection
}) {
  return (
    <section
      aria-labelledby="projection-heading"
      className="mt-4 rounded-lg border border-edge bg-sunk p-3"
    >
      <h3
        id="projection-heading"
        className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-soft"
      >
        What this package is expected to do
      </h3>

      {projection.unchanged ? (
        <p className="mt-2 text-sm text-ink-soft">
          Nothing measurable, in {projection.horizonMeetings} meetings. This
          package leaves the economy where holding would have left it — which is
          a legitimate decision when there is nothing to correct, and a wasted
          meeting when there is.
        </p>
      ) : (
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="text-left text-2xs uppercase tracking-wide text-ink-faint">
              <th scope="col" className="pb-1 font-medium">
                In {projection.horizonMeetings} meetings
              </th>
              <th scope="col" className="pb-1 text-right font-medium">
                Today
              </th>
              <th scope="col" className="pb-1 text-right font-medium">
                If you hold
              </th>
              <th scope="col" className="pb-1 text-right font-medium">
                With this
              </th>
            </tr>
          </thead>
          <tbody>
            {projection.series.map((entry) => {
              const difference = entry.withPackage - entry.holding
              const meaningful =
                Math.abs(difference) >= 10 ** -entry.decimals / 2
              return (
                <tr key={entry.seriesId} className="border-t border-edge">
                  <th
                    scope="row"
                    className="py-1.5 pr-2 text-left font-normal text-ink"
                  >
                    {entry.label}
                  </th>
                  <td className="py-1.5 text-right tabular-nums text-ink-faint">
                    {entry.now.toFixed(entry.decimals)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-ink-soft">
                    {entry.holding.toFixed(entry.decimals)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums font-medium text-ink">
                    {entry.withPackage.toFixed(entry.decimals)}
                    {meaningful && (
                      <span className="ml-1 text-2xs text-ink-soft">
                        ({difference > 0 ? '+' : '−'}
                        {Math.abs(difference).toFixed(entry.decimals)})
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      <p className="mt-2 text-2xs leading-relaxed text-ink-faint">
        The model run forward twice from here — once with this package, once
        holding everything — with no further shocks in either. It is what your
        decision does, all else equal, and the economy will not hold all else
        equal. Compare it with what actually arrives.
      </p>
    </section>
  )
}
