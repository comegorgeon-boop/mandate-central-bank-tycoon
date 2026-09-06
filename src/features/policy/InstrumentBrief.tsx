import type { InstrumentDefinition, InstrumentRange } from '../../simulation/index.ts'
import { formatMagnitude, formatStep } from './InstrumentStepper.tsx'

/**
 * What one instrument is for, what its numbers mean, and how it can go wrong.
 *
 * The four questions a player has about a dial they have never used, answered
 * in the order they are asked: what does it do, how much is a lot, what if I
 * overdo it, and how long until anything happens. Before this the desk answered
 * only the mechanism — "lends to banks against lending performance" — which
 * tells a reader who already knows what the tool is that they were right.
 *
 * Shared by the policy rate's dedicated control and by every standing
 * instrument's stepper, so the same four answers appear for all of them rather
 * than for whichever ones a screen happened to write copy for.
 *
 * The purpose sentence is always visible; the rest is one click away. Screen
 * density is its own complaint — showing all four for six instruments at once
 * is how a desk becomes unreadable — and a `<details>` costs nothing to open,
 * keyboard included, and is searchable by the browser's own find.
 */
export function InstrumentBrief({
  instrument,
  range,
  value,
}: {
  readonly instrument: InstrumentDefinition
  readonly range: InstrumentRange
  /** The magnitude currently selected, for the beyond-precedent warning. */
  readonly value: number
}) {
  const { plausibleMax } = instrument
  const beyondPrecedent =
    plausibleMax !== undefined && Math.abs(value) > plausibleMax + 1e-9

  return (
    <div className="mt-1">
      <p className="text-sm text-ink">{instrument.purpose}</p>

      {beyondPrecedent && (
        <p className="mt-1.5 text-sm font-medium text-accent-strong">
          Beyond precedent. {formatMagnitude(value, instrument.unit)} is past the{' '}
          {formatMagnitude(plausibleMax, instrument.unit)} that has ever been done
          outside an emergency. Allowed, and it will be read as a statement about
          how bad you think this is.
        </p>
      )}

      <details className="group mt-1.5">
        <summary className="cursor-pointer list-none text-xs text-accent-strong underline decoration-dotted underline-offset-2 marker:content-none">
          <span className="group-open:hidden">How much is a lot, and what can go wrong</span>
          <span className="hidden group-open:inline">Close</span>
        </summary>
        <dl className="mt-2 space-y-2 border-l-2 border-edge-accent pl-3 text-sm">
          <div>
            <dt className="text-2xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
              The dial
            </dt>
            <dd className="text-ink-soft">
              {instrument.rangeNote} This desk allows{' '}
              {formatMagnitude(range.min, instrument.unit)} to{' '}
              {formatMagnitude(range.max, instrument.unit)}
              {instrument.unit === 'ordinal'
                ? '.'
                : `, in steps of ${formatStep(range.increment, instrument.unit)}.`}
            </dd>
          </div>
          <div>
            <dt className="text-2xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
              If you overdo it
            </dt>
            <dd className="text-ink-soft">{instrument.abuseRisk}</dd>
          </div>
          <div>
            <dt className="text-2xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
              How it works
            </dt>
            <dd className="text-ink-soft">
              {instrument.description} Peak effect in {instrument.lagMeetings[0]}–
              {instrument.lagMeetings[1]} meetings.
            </dd>
          </div>
        </dl>
      </details>
    </div>
  )
}
