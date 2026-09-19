import {
  isUnlocked,
  type Difficulty,
  type ObservationSet,
  type SeriesId,
} from '../../../simulation/index.ts'
import type { Register } from '../register.ts'
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
  register,
  difficulty,
}: {
  readonly observation: ObservationSet
  readonly inflationTarget: number
  readonly register: Register
  /**
   * Decides how much of the dashboard has filled in.
   *
   * Easy only: from medium a chair has the whole table and the difficulty is
   * reading it. See `observation/unlock.ts`.
   */
  readonly difficulty: Difficulty
}) {
  return (
    <IndicatorPanel
      id="prices"
      title="Prices"
      intro={`Where inflation is, what is driving it, and whether expectations are still holding at the ${inflationTarget.toFixed(1)} % objective.`}
      seriesIds={PRICE_SERIES.filter((id) =>
        isUnlocked(id, difficulty, observation.meetingIndex),
      )}
      observation={observation}
      references={{
        headline_inflation: inflationTarget,
        core_inflation: inflationTarget,
        inflation_expectations_1y: inflationTarget,
        inflation_expectations: inflationTarget,
      }}
      register={register}
      footnote="Price statistics describe a period that has already passed and are revised afterwards. Expectations and market pricing are the timelier read."
    />
  )
}
