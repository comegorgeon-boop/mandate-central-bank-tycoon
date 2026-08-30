import type { ObservationSet, SeriesId } from '../../../simulation/index.ts'
import { IndicatorPanel } from './IndicatorPanel.tsx'

const LABOR_SERIES: readonly SeriesId[] = [
  'unemployment',
  'employment_growth',
  'wage_growth',
]

export function LaborPanel({ observation }: { readonly observation: ObservationSet }) {
  return (
    <IndicatorPanel
      id="labor"
      title="Labor"
      intro="The employment side of the mandate: how much slack there is, how fast hiring is running, and what wages imply for costs."
      seriesIds={LABOR_SERIES}
      observation={observation}
      footnote="Unemployment turns late in the cycle. Employment momentum turns early but is the most heavily revised series on the table."
    />
  )
}
