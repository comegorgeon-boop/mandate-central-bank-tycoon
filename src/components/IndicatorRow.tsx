import {
  getSeries,
  type IndicatorObservation,
  type ReleaseCategory,
} from '../simulation/index.ts'
import { plainHeadline, type Register } from '../features/meeting/register.ts'
import { TrendChart } from './TrendChart.tsx'
import { meaningOf } from '../simulation/index.ts'

/**
 * One published indicator.
 *
 * It carries four things, in the order a player needs them: the number, how it
 * has moved over the mandate, what a move in it means for them, and how much
 * to trust it — where it comes from, how late it is, how wide its error bar is,
 * and whether an earlier print has since been corrected.
 *
 * The trend chart is not decoration. A single reading shows no direction, and
 * in macroeconomics the direction usually decides the policy.
 *
 * What leads the row is the difficulty's `Register`. On the learning mandate a
 * plain sentence is the headline and the figure is the note underneath it; from
 * medium the figure leads; at hard the plain-language reading of what a move
 * means is withdrawn entirely and only the technical definition remains. See
 * `features/meeting/register.ts`.
 */

const CATEGORY_LABEL: Readonly<Record<ReleaseCategory, string>> = {
  market_data: 'Market price',
  official_statistic: 'Official statistic',
  survey: 'Survey',
  internal_estimate: 'Staff estimate',
}

function lagLabel(meetings: number): string {
  if (meetings <= 0) return 'available at this meeting'
  if (meetings === 1) return 'reflects the period before last'
  return `reflects ${meetings} meetings ago`
}

function formatValue(value: number | null, decimals: number): string {
  return value === null ? '—' : value.toFixed(decimals)
}

function formatChange(
  value: number | null,
  previous: number | null,
  decimals: number,
): string | null {
  if (value === null || previous === null) return null
  const change = value - previous
  if (Math.abs(change) < 10 ** -decimals / 2) return 'unchanged'
  return `${change > 0 ? '+' : '−'}${Math.abs(change).toFixed(decimals)} vs previous`
}

export function IndicatorRow({
  observation,
  reference = null,
  referenceLabel = 'objective',
  register = 'plain',
}: {
  readonly observation: IndicatorObservation
  /** A line to read the series against, such as the inflation objective. */
  readonly reference?: number | null
  readonly referenceLabel?: string
  /** Which language this difficulty publishes its numbers in. */
  readonly register?: Register
}) {
  const decimals = getSeries(observation.seriesId)?.decimals ?? 2
  const meaning = meaningOf(observation.seriesId)
  const change = formatChange(observation.value, observation.previous, decimals)
  const figure = (
    <span className="tabular-nums text-lg text-ink">
      {formatValue(observation.value, decimals)}
      <span className="ml-1 text-xs text-ink-soft">{observation.unit}</span>
    </span>
  )

  return (
    <li className="border-b border-edge py-4 last:border-b-0">
      {register === 'plain' ? (
        <div>
          <p className="font-medium text-ink">
            {plainHeadline(observation, reference, referenceLabel)}
          </p>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span className="text-xs uppercase tracking-wide text-ink-faint">
              {observation.label}
            </span>
            {figure}
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="font-medium text-ink">{observation.label}</span>
          {figure}
        </div>
      )}

      <TrendChart
        label={observation.label}
        values={observation.trend}
        decimals={decimals}
        reference={reference}
        referenceLabel={referenceLabel}
      />

      {/* The card. What it is, what it does to a real person, and what it
          should make you do — the third being the one every version of this
          interface has been missing. The glossary told the player what a
          credit spread *is*; nothing ever told them that a widening one means
          their last two rises are already in the economy.

          Folded, so it costs nothing until it is wanted — which is also why
          it can exist at all: a closed disclosure is outside the word budget,
          because it is available rather than imposed.

          > "C'est ça le glossaire, pas une page que personne n'ouvre." */}
      {meaning !== null && (
        <details className="group mt-2">
          <summary className="cursor-pointer list-none text-xs text-accent-strong underline decoration-dotted underline-offset-2 marker:content-none">
            <span className="group-open:hidden">What this means for the decision</span>
            <span className="hidden group-open:inline">Close</span>
          </summary>
          <p className="mt-1 text-xs text-ink-soft">{meaning.is}</p>
          <p className="mt-1 text-sm text-ink">{meaning.means}</p>
          <p className="mt-1 border-l-2 border-edge-accent pl-2 text-sm text-accent-strong">
            {meaning.do}
          </p>
        </details>
      )}

      <p className="mt-2 text-xs text-ink-faint">
        {observation.missing ? (
          <span className="text-accent-strong">
            This release did not arrive in time for the meeting.
          </span>
        ) : (
          <>
            {change !== null && <span>{change}. </span>}
            {observation.uncertainty > 0 && (
              <span>Uncertainty ±{observation.uncertainty.toFixed(decimals)}. </span>
            )}
            <span>
              {CATEGORY_LABEL[observation.category]},{' '}
              {lagLabel(observation.publicationLagMeetings)}.
            </span>
          </>
        )}
      </p>

      {observation.revision !== null && (
        <p className="mt-1 text-xs text-accent-strong">
          Revision: the reading {observation.revision.periodsAgo} period
          {observation.revision.periodsAgo === 1 ? '' : 's'} ago was first published at{' '}
          {observation.revision.firstPrint.toFixed(decimals)} and now reads{' '}
          {observation.revision.current.toFixed(decimals)}.
        </p>
      )}

      {/* What a move means, and what the series is.
       *
       * Both fold, and this is the single largest density change in the
       * interface. Each row used to carry three paragraphs — the reading, the
       * provenance, and the dictionary entry — so a panel of six indicators
       * was about eighteen hundred characters of prose wrapped around six
       * numbers, at every meeting, on four of the seven tabs. The player's
       * standing complaint is that the game reads like an accounting
       * document, and this is most of where that came from.
       *
       * Nothing is removed. What a move means is a *reading*, needed when a
       * number surprises you; what a series is is a *definition*, needed once.
       * Neither is needed in the two seconds it takes to check that core
       * inflation is where you left it, and both are one click away — keyboard
       * included, and findable by the browser's own search, which a tooltip is
       * not.
       *
       * The provenance line above does *not* fold: how late a number is and
       * how wide its error bar is are properties of this reading rather than
       * of the series, and the whole game is about not trusting a number more
       * than it deserves.
       */}
      <details className="group mt-1">
        <summary className="cursor-pointer list-none text-2xs text-ink-faint underline decoration-dotted underline-offset-2 marker:content-none">
          <span className="group-open:hidden">
            {register === 'technical' ? 'What this series is' : 'What it means, and what it is'}
          </span>
          <span className="hidden group-open:inline">Close</span>
        </summary>
        {/* Hard reads nothing for you: the technical register keeps the
            definition and drops the reading, exactly as before. */}
        {register !== 'technical' && (
          <p className="mt-1.5 text-sm text-ink-soft">{observation.meaning}</p>
        )}
        <p className="mt-1 text-xs text-ink-faint">{observation.definition}</p>
      </details>
    </li>
  )
}
