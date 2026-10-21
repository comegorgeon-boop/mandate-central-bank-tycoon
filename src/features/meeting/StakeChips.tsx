import type { SurpriseStake } from './surprise.ts'

/**
 * What is on the table, as a quantity you can see rather than a number.
 *
 * ## The tokens are `onwood`, and that is not a style preference
 *
 * This panel sits on `bg-inset`, which is **walnut in both directions** — the
 * one surface in the token file that does not flip with the theme. Paper
 * tokens (`text-ink*`, `text-good-strong`) render dark-on-dark there. This
 * project has shipped exactly one invisible panel, for exactly this reason,
 * and it is in the journal; the first draft of this file reproduced it.
 *
 * > "DES JETONS, PAS DES NOMBRES. La crédibilité est une pile qu'on voit
 * > fondre quand je surprends le marché. La mise d'un pari est poussée sur le
 * > tapis. Les quantités ont un volume, pas qu'un chiffre."
 *
 * So the stake is drawn as a row of chips with the figure beside it, not
 * instead of it: a player who wants the number still has it, and a player who
 * is only looking gets the size without reading. One chip is one point of
 * credibility, which makes the row a direct measure rather than a scale
 * nobody is told about.
 *
 * ## It appears only when there is a bet
 *
 * Inside the band the market treats as priced-in there is nothing at stake,
 * and this renders nothing at all. That is deliberate and it is the light
 * rule: **mark the change, not the state.** A stake panel that sat there at
 * every meeting saying "0" would be the wallpaper this whole pass exists to
 * remove.
 */
export function StakeChips({ stake }: { readonly stake: SurpriseStake }) {
  if (!stake.beyondPriced) return null

  const chips = Math.max(1, Math.round(stake.trust))
  const direction = stake.surprise > 0 ? 'above' : 'below'

  return (
    <section
      aria-label="What this move puts at stake"
      data-stake=""
      className="mt-5 border-l-2 border-edge-accent bg-inset px-3 py-2"
    >
      <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-onwood-faint">
        On the table
      </p>

      <p className="mt-1 text-sm text-onwood">
        {Math.round(Math.abs(stake.surprise) * 100)} bp {direction} what the market has priced.
      </p>

      <dl className="mt-3 space-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <dt className="text-xs uppercase tracking-wide text-onwood-faint">To win</dt>
          <dd className="text-sm font-semibold tabular-nums text-good-onwood">
            +{stake.reach.toFixed(2)} reach
          </dd>
          <dd className="text-xs text-onwood-soft">
            long rates move on the day, not before it
          </dd>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <dt className="text-xs uppercase tracking-wide text-onwood-faint">To lose</dt>
          <dd
            aria-hidden="true"
            className="flex items-center gap-[3px]"
            data-chips={chips}
          >
            {Array.from({ length: Math.min(chips, 8) }, (_, index) => (
              <span
                key={index}
                className="inline-block h-3 w-3 border border-edge-accent bg-accent-surface"
              />
            ))}
            {chips > 8 && (
              <span className="ml-1 text-xs tabular-nums text-onwood-soft">+{chips - 8}</span>
            )}
          </dd>
          <dd className="text-sm font-semibold tabular-nums text-bad-onwood">
            {stake.trust.toFixed(1)} market trust
          </dd>
          <dd className="text-xs text-onwood-soft">
            and {stake.volatility.toFixed(0)} points of volatility, either way
          </dd>
        </div>
      </dl>
    </section>
  )
}
