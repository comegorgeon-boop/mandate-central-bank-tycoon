import type { AreaObservation, MemberObservation } from '../../../simulation/index.ts'

/**
 * The area is not one economy.
 *
 * The ECB's actual problem, put on screen: one rate, set for members whose
 * inflation, unemployment and borrowing costs differ by more than the rate
 * itself can bridge. Until this existed the euro area was modelled and
 * displayed as a single block with a "fragmentation" number attached, which is
 * the problem's shadow rather than the problem.
 *
 * Three columns, and the order is the argument. **Inflation** first, because
 * it is the objective and because the spread between the highest and lowest
 * member is the sentence that makes the difficulty concrete — 1.2 % in one
 * member and 4.8 % in another, aggregate 2.9 %, and one rate for all of it.
 * **Unemployment** second, because it is the other half of what the rate does
 * to them. **Sovereign spread** third, and it is the one that matters most in
 * a crisis: it is a *price*, so it is exact and immediate, while the two
 * statistics beside it arrived a meeting or two late. In a fragmentation
 * episode the spreads move first and the national statistics confirm it a
 * quarter after the market already knew.
 *
 * Weights are shown because they are the answer to the question the panel
 * provokes. A member in serious trouble can move the aggregate almost not at
 * all, and the reason is that it is a tenth of the area — which is not a bug
 * to be explained away but the thing the chair has to hold in their head.
 *
 * The countries are real; their economic structure is real; **their situations
 * here are invented**, and the panel says so.
 */

function Cell({
  value,
  gap,
  decimals = 2,
  suffix = ' %',
}: {
  readonly value: number | null
  readonly gap: number | null
  readonly decimals?: number
  readonly suffix?: string
}) {
  if (value === null) {
    return <span className="text-ink-faint">—</span>
  }
  return (
    <span className="tabular-nums text-ink">
      {value.toFixed(decimals)}
      <span className="text-2xs text-ink-faint">{suffix}</span>
      {gap !== null && Math.abs(gap) >= 0.05 && (
        <span
          className={`ml-1 text-2xs tabular-nums ${
            gap > 0 ? 'text-accent-strong' : 'text-ink-faint'
          }`}
        >
          {gap > 0 ? '+' : '−'}
          {Math.abs(gap).toFixed(decimals)}
        </span>
      )}
    </span>
  )
}

function Row({
  member,
  widest,
}: {
  readonly member: MemberObservation
  readonly widest: number
}) {
  return (
    <tr className="border-t border-edge">
      <th scope="row" className="py-1.5 pr-2 text-left font-medium text-ink">
        {member.name}
        <span className="ml-1.5 text-2xs font-normal text-ink-faint">
          {(member.weight * 100).toFixed(0)} % of the area
        </span>
      </th>
      <td className="px-2 py-1.5 text-right">
        <Cell value={member.inflation} gap={member.inflationGap} />
      </td>
      <td className="px-2 py-1.5 text-right">
        <Cell value={member.unemployment} gap={member.unemploymentGap} />
      </td>
      <td className="py-1.5 pl-2 text-right">
        <span
          className={`tabular-nums ${
            member.spread >= widest && widest > 0
              ? 'font-semibold text-accent-strong'
              : 'text-ink'
          }`}
        >
          {member.spread}
          <span className="text-2xs text-ink-faint"> bp</span>
        </span>
      </td>
    </tr>
  )
}

export function DispersionPanel({ area }: { readonly area: AreaObservation }) {
  const { highestInflation, lowestInflation, inflationRange } = area
  const spread =
    highestInflation !== null &&
    lowestInflation !== null &&
    highestInflation.id !== lowestInflation.id

  return (
    <section aria-labelledby="dispersion-heading">
      <h3 id="dispersion-heading" className="text-lg font-semibold text-ink">
        One rate, six economies
      </h3>

      {spread ? (
        <p className="mt-1 text-sm text-ink-soft">
          Inflation runs at{' '}
          <span className="font-semibold tabular-nums text-ink">
            {lowestInflation.inflation!.toFixed(2)} %
          </span>{' '}
          in {lowestInflation.article}
          {lowestInflation.name} and{' '}
          <span className="font-semibold tabular-nums text-ink">
            {highestInflation.inflation!.toFixed(2)} %
          </span>{' '}
          in {highestInflation.article}
          {highestInflation.name} — {inflationRange.toFixed(2)} points apart
          {area.aggregate.inflation !== null && (
            <>
              , against an area figure of{' '}
              <span className="font-semibold tabular-nums text-ink">
                {area.aggregate.inflation.toFixed(2)} %
              </span>
            </>
          )}
          . One policy rate for all of it.
        </p>
      ) : (
        <p className="mt-1 text-sm text-ink-soft">
          National releases have not arrived yet this meeting. The spreads
          below are prices and are exact.
        </p>
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[26rem] text-sm">
          <caption className="sr-only">
            National inflation, unemployment and sovereign spreads across the
            currency area, with each member&rsquo;s distance from the area
            aggregate.
          </caption>
          <thead>
            <tr className="text-2xs uppercase tracking-[0.12em] text-ink-faint">
              <th scope="col" className="pb-1 pr-2 text-left font-semibold">
                Member
              </th>
              <th scope="col" className="px-2 pb-1 text-right font-semibold">
                Inflation
              </th>
              <th scope="col" className="px-2 pb-1 text-right font-semibold">
                Unemployment
              </th>
              <th scope="col" className="pb-1 pl-2 text-right font-semibold">
                Spread
              </th>
            </tr>
          </thead>
          <tbody>
            {area.members.map((member) => (
              <Row key={member.id} member={member} widest={area.widestSpread} />
            ))}
            {/* The aggregate on the same rows as the members it averages.
                The panel's whole point is that the number the mandate targets
                is one no member is actually living, and that only lands if the
                two are adjacent. */}
            <tr className="border-t-2 border-edge-accent">
              <th scope="row" className="py-1.5 pr-2 text-left font-semibold text-ink">
                The area
                <span className="ml-1.5 text-2xs font-normal text-ink-faint">
                  what the mandate targets
                </span>
              </th>
              <td className="px-2 py-1.5 text-right font-semibold">
                <Cell value={area.aggregate.inflation} gap={null} />
              </td>
              <td className="px-2 py-1.5 text-right font-semibold">
                <Cell value={area.aggregate.unemployment} gap={null} />
              </td>
              <td className="py-1.5 pl-2 text-right text-2xs text-ink-faint">
                widest {area.widestSpread} bp
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <dl className="mt-3 grid gap-3 border-t border-edge pt-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-2xs uppercase tracking-[0.12em] text-ink-faint">
            Inflation dispersion
          </dt>
          <dd className="tabular-nums text-ink">
            {area.inflationDispersion.toFixed(2)} pp
            <span className="ml-1 text-xs text-ink-soft">
              from the area&rsquo;s own figure, on average
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-2xs uppercase tracking-[0.12em] text-ink-faint">
            Unemployment dispersion
          </dt>
          <dd className="tabular-nums text-ink">
            {area.unemploymentDispersion.toFixed(2)} pp
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-xs text-ink-faint">
        National price and labour statistics arrive with the same delay as the
        area&rsquo;s and carry more measurement error — they are the same survey
        on a smaller sample. Sovereign spreads are prices: exact, and known the
        moment they are quoted. In a fragmentation episode the spreads move
        first and the statistics confirm it a quarter later.
      </p>

      <p className="mt-2 text-xs text-ink-faint">
        A simulation. The countries and their economic structure — size, debt
        burden, industrial share, energy import dependence, how sharply
        employment moves over the cycle — are real; the situations shown here
        are invented for play and are not a description of any actual moment.
      </p>
    </section>
  )
}
