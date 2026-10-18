import type { LatentState, RunConfig } from '../../../simulation/index.ts'
import { FISCAL, getInstitution } from '../../../simulation/index.ts'
import { Sparkline } from '../../../components/Sparkline.tsx'

/**
 * The public finances, and the one line on them that is the player's doing.
 *
 * ## Why this is on the screen at all, given it is not in the mandate
 *
 * Because the unpleasant arithmetic is real and invisible otherwise. A chair
 * who raises by two points raises the interest bill of the government they
 * serve — not this quarter, but over the years the debt stock takes to roll
 * over — and if that government will not close the gap, the bill is paid by
 * inflation in the end (Sargent and Wallace, 1981). A game that models the
 * mechanism and never shows it has modelled a rumour.
 *
 * **Nothing here is scored.** `calculateScore.ts` does not read one of these
 * numbers. They reach the mandate through two channels and only two: the
 * event generator, which draws a fiscal-dominance episode more readily as the
 * ratio climbs, and the pressure gauge. A central bank graded on the deficit
 * would be a treasury, and the panel says so in one line rather than leaving
 * the player to wonder what it is going to cost them.
 *
 * ## The one line that is yours
 *
 * Debt service. The primary balance is the government's: structural, plus the
 * automatic stabilisers, plus whatever has been decided. The interest bill is
 * the stock times the average coupon on it, and the average coupon converges
 * on the rate *you* set at a speed set by the average maturity. So the panel
 * puts them on separate rows, marks one of them, and says how long the lag is
 * — because the lag is the mechanism and a player who does not know it is
 * eight years long will read the first year's non-response as proof there is
 * no link.
 */

function format(value: number, digits = 1): string {
  return value.toFixed(digits)
}

/** The maturities the two institutions have, in words. */
const ORDINAL_SHARE: Readonly<Record<number, string>> = {
  6: 'a sixth',
  8: 'an eighth',
}

export function PublicFinancesPanel({
  config,
  latent,
  history,
}: {
  readonly config: RunConfig
  readonly latent: LatentState
  /** The path so far, for the two sparklines. */
  readonly history: readonly LatentState[]
}) {
  const institution = getInstitution(config.institution)
  const maturity = FISCAL.publicFinances.maturityYears[config.institution]
  const deficit = latent.debtService - latent.primaryBalance
  const opened = history[0] ?? latent
  const serviceMove = latent.debtService - opened.debtService

  const rows: readonly {
    readonly label: string
    readonly value: string
    readonly note: string
    readonly yours: boolean
    readonly series?: readonly number[]
  }[] = [
    {
      label: 'Government debt',
      value: `${format(latent.publicDebt)} % of GDP`,
      note:
        history.length <= 1
          ? 'What you inherited. Where it goes from here is partly yours.'
          : Math.abs(latent.publicDebt - opened.publicDebt) < 0.05
            ? 'Unchanged since the mandate opened, which means the deficit and nominal growth are cancelling.'
            : latent.publicDebt > opened.publicDebt
              ? `Up ${format(latent.publicDebt - opened.publicDebt)} points since the mandate opened.`
              : `Down ${format(opened.publicDebt - latent.publicDebt)} points since the mandate opened. Nominal growth is doing most of that.`,
      yours: false,
      series: history.map((entry) => entry.publicDebt),
    },
    {
      label: 'Deficit',
      value: `${format(deficit)} % of GDP`,
      note: `The primary balance is ${format(latent.primaryBalance)} and the interest bill is ${format(latent.debtService)}.`,
      yours: false,
    },
    {
      label: 'Debt service',
      value: `${format(latent.debtService)} % of GDP`,
      note:
        Math.abs(serviceMove) < 0.05
          ? `The stock is paying ${format(latent.effectiveDebtRate, 2)} % on average, and has barely moved yet.`
          : `${serviceMove > 0 ? 'Up' : 'Down'} ${format(Math.abs(serviceMove), 2)} points since you took the chair. The stock is paying ${format(latent.effectiveDebtRate, 2)} % on average against a market rate of ${format(latent.policyRate + latent.termPremium, 2)} %.`,
      yours: true,
      series: history.map((entry) => entry.debtService),
    },
    {
      label: 'Average maturity',
      value: `${maturity} years`,
      // Written out rather than built with an ordinal suffix: "a 6th of the
      // stock" is how a template reads and "about a sixth" is how a sentence
      // does.
      note: `About ${ORDINAL_SHARE[maturity] ?? `a ${maturity}th`} of the stock reprices each year, so a rate you set today reaches the interest bill over the next ${maturity}.`,
      yours: false,
    },
  ]

  return (
    <section aria-labelledby="finances-heading" className="space-y-4">
      <div>
        <h3 id="finances-heading" className="text-lg font-semibold text-ink">
          The public finances
        </h3>
        <p className="mt-1 text-sm text-ink-soft">
          Not part of your mandate and not in your score. They are here
          because one of these lines moves when you move the rate, and because
          a government that cannot carry its debt eventually asks you to carry
          it instead.
        </p>
      </div>

      <dl className="space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="border-t border-edge pt-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <dt className="text-sm text-ink-soft">
                {row.label}
                {row.yours && (
                  <span className="ml-2 rounded-sm border border-edge-accent px-1 py-px text-2xs uppercase tracking-wide text-accent-strong">
                    yours
                  </span>
                )}
              </dt>
              <dd className="tabular-nums text-base font-semibold text-ink">
                {row.value}
              </dd>
            </div>
            <p className="mt-0.5 text-xs text-ink-faint">{row.note}</p>
            {row.series !== undefined && row.series.length > 2 && (
              <div className="mt-1">
                <Sparkline values={row.series} label={row.label} decimals={1} />
              </div>
            )}
          </div>
        ))}
      </dl>

      <p className="text-xs text-ink-faint">
        The {institution.shortName} does not set any of this. What it sets is the
        rate the stock rolls over at — and at this debt ratio, a point on the
        rate is worth about{' '}
        <span className="tabular-nums">
          {format(latent.publicDebt / 100, 2)} points
        </span>{' '}
        of GDP a year once the whole stock has turned over.
      </p>
    </section>
  )
}
