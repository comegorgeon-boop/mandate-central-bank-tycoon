import {
  isUnlocked,
  type Difficulty,
  type ObservationSet,
  type SeriesId,
} from '../../../simulation/index.ts'
import type { Register } from '../register.ts'
import { IndicatorPanel } from './IndicatorPanel.tsx'

const LABOR_SERIES: readonly SeriesId[] = [
  'unemployment',
  'employment_growth',
  'wage_growth',
]

export function LaborPanel({
  observation,
  register,
  difficulty,
}: {
  readonly observation: ObservationSet
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
      id="labor"
      title="Labor"
      intro="The employment side of the mandate: how much slack there is, how fast hiring is running, and what wages imply for costs."
      seriesIds={LABOR_SERIES.filter((id) =>
        isUnlocked(id, difficulty, observation.meetingIndex),
      )}
      observation={observation}
      register={register}
      footnote="Unemployment turns late in the cycle. Employment growth turns early but is the most heavily revised series on the table."
    />
  )
}
