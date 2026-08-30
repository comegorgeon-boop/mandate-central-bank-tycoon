import type { ObservationSet, SeriesId } from '../../../simulation/index.ts'
import { IndicatorPanel } from './IndicatorPanel.tsx'

const PRICE_SERIES: readonly SeriesId[] = [
  'headline_inflation',
  'core_inflation',
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
      footnote="Price statistics describe a period that has already passed and are revised afterwards. Expectations and market pricing are the timelier read."
    />
  )
}
