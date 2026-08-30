import { IndicatorRow } from '../../../components/IndicatorRow.tsx'
import type { ObservationSet, SeriesId } from '../../../simulation/index.ts'

/**
 * Shared layout for the information panels.
 *
 * Which series a panel shows is data, passed in by the panel; how an
 * indicator is rendered lives in IndicatorRow. Adding the Growth or Financial
 * Conditions panels later is a matter of listing different series ids.
 */
export function IndicatorPanel({
  id,
  title,
  intro,
  seriesIds,
  observation,
  footnote,
  references = {},
  referenceLabel = 'objective',
}: {
  readonly id: string
  readonly title: string
  readonly intro: string
  readonly seriesIds: readonly SeriesId[]
  readonly observation: ObservationSet
  readonly footnote?: string
  /** Per-series line to read the trend against, such as the inflation target. */
  readonly references?: Partial<Record<SeriesId, number>>
  readonly referenceLabel?: string
}) {
  const rows = seriesIds
    .map((seriesId) => observation.indicators[seriesId])
    .filter((row) => row !== undefined)

  return (
    <section aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className="text-lg font-semibold text-neutral-50">
        {title}
      </h2>
      <p className="mt-1 text-sm text-neutral-400">{intro}</p>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-400">
          No releases are available for this panel at this meeting.
        </p>
      ) : (
        <ul className="mt-3">
          {rows.map((row) => (
            <IndicatorRow
              key={row.seriesId}
              observation={row}
              reference={references[row.seriesId] ?? null}
              referenceLabel={referenceLabel}
            />
          ))}
        </ul>
      )}

      {footnote !== undefined && (
        <p className="mt-4 text-xs text-neutral-600">{footnote}</p>
      )}
    </section>
  )
}
