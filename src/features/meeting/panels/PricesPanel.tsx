import type { ObservationSet, SeriesId } from '../../../simulation/index.ts'
import { IndicatorPanel } from './IndicatorPanel.tsx'

/**
 * Prices.
 *
 * One-year expectations sit next to the inflation prints rather than with the
 * five-year anchor, because they are not really a price series at all: they
 * are the deflator that turns the nominal policy rate into the real one, and
 * reading them beside inflation is what makes a stance legible.
 */
const PRICE_SERIES: readonly SeriesId[] = [
  'headline_inflation',
  'core_inflation',
  'inflation_expectations_1y',
  'inflation_expectations',
  'wage_growth',
  'import_prices',
]

export function PricesPanel({
  observation,
  inflationTarget,
}: {
  readonly observation: ObservationSet
  readonly inflationTarget: number
}) {
  return (
    <IndicatorPanel
      id="prices"
      title="Prices"
      intro={`Where inflation is, what is driving it, and whether expectations are still holding at the ${inflationTarget.toFixed(1)} % objective.`}
      seriesIds={PRICE_SERIES}
      observation={observation}
      references={{
        headline_inflation: inflationTarget,
        core_inflation: inflationTarget,
        inflation_expectations_1y: inflationTarget,
        inflation_expectations: inflationTarget,
      }}
      footnote="Price statistics describe a period that has already passed and are revised afterwards. Expectations and market pricing are the timelier read."
    />
  )
}
