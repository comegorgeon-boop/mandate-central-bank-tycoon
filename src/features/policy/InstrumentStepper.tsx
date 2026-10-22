import type { InstrumentDefinition, InstrumentRange } from '../../simulation/index.ts'
import { InstrumentBrief } from './InstrumentBrief.tsx'

/**
 * One instrument's control, rendered from its definition alone.
 *
 * A stepper rather than a row of buttons, because the ranges differ by two
 * orders of magnitude — an ordinal facility has four positions and an asset
 * purchase programme has seventeen — and a component that renders a button per
 * position would be unusable for half the toolkit. A stepper is also the only
 * shape here that is keyboard-operable without further work: two real buttons
 * and a readout.
 *
 * Nothing about any specific instrument is known here. Unit, bounds, step,
 * label and description all come from `config/instruments.ts`, so opening a new
 * instrument to a difficulty never means editing a screen.
 */

/** How a magnitude reads in each of the instrument units. */
export function formatMagnitude(
  value: number,
  unit: InstrumentDefinition['unit'],
): string {
  switch (unit) {
    case 'basis_points':
      return `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value)} bp`
    case 'percent_of_gdp':
      return `${value.toFixed(1)} % of GDP`
    case 'index_points':
      return `${value.toFixed(1)} pts`
    case 'ordinal':
      return ORDINAL_LABEL[Math.round(value)] ?? String(value)
  }
}

/**
 * A step size rather than a value, so it never carries a sign.
 *
 * `formatMagnitude` signs basis points, which is right for a level and wrong
 * for an increment: "in steps of +25 bp" reads as a direction.
 */
export function formatStep(value: number, unit: InstrumentDefinition['unit']): string {
  switch (unit) {
    case 'basis_points':
      return `${Math.abs(value)} bp`
    case 'percent_of_gdp':
      return `${Math.abs(value).toFixed(1)} pp of GDP`
    case 'index_points':
      return `${Math.abs(value).toFixed(1)} pts`
    case 'ordinal':
      return 'one position'
  }
}

/**
 * The ordinal facilities are escalation ladders, not quantities, so their
 * positions are named rather than numbered. Shared across all of them: every
 * ordinal instrument in the toolkit is an escalation from "off" to "as far as
 * this institution goes".
 */
const ORDINAL_LABEL: Readonly<Record<number, string>> = {
  0: 'Standard terms',
  1: 'Eased',
  2: 'Escalated',
  3: 'Full backstop',
}

export function InstrumentStepper({
  instrument,
  range,
  label,
  value,
  standing,
  onChange,
}: {
  readonly instrument: InstrumentDefinition
  readonly range: InstrumentRange
  readonly label: string
  readonly value: number
  /** Where this instrument stands going into the meeting, for the comparison. */
  readonly standing: number
  readonly onChange: (next: number) => void
}) {
  const clamp = (next: number): number =>
    Math.min(range.max, Math.max(range.min, Number(next.toFixed(4))))
  const changed = Math.abs(value - standing) > 1e-9

  return (
    <div className="border-b border-edge py-3 last:border-b-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="font-medium text-ink">{label}</span>
        <span className="flex items-center gap-2">
          <button
            type="button"
            aria-label={`Lower ${label}`}
            disabled={value <= range.min + 1e-9}
            onClick={() => onChange(clamp(value - range.increment))}
            /* A quieter token rather than `disabled:opacity-30`, which
               composited this glyph to 2.3:1 against the chassis. Both halves
               of that looked right and the product did not — the fifth time in
               this project, and the first to get past the lint rule written
               for it, because a variant prefix is not whitespace. */
            className="h-8 w-8 rounded border border-edge text-ink hover:bg-sunk disabled:cursor-not-allowed disabled:text-ink-faint"
          >
            −
          </button>
          <output
            aria-label={`${label}, currently selected`}
            className="min-w-32 text-center tabular-nums text-ink"
          >
            {formatMagnitude(value, instrument.unit)}
          </output>
          <button
            type="button"
            aria-label={`Raise ${label}`}
            disabled={value >= range.max - 1e-9}
            onClick={() => onChange(clamp(value + range.increment))}
            /* A quieter token rather than `disabled:opacity-30`, which
               composited this glyph to 2.3:1 against the chassis. Both halves
               of that looked right and the product did not — the fifth time in
               this project, and the first to get past the lint rule written
               for it, because a variant prefix is not whitespace. */
            className="h-8 w-8 rounded border border-edge text-ink hover:bg-sunk disabled:cursor-not-allowed disabled:text-ink-faint"
          >
            +
          </button>
        </span>
      </div>

      <InstrumentBrief instrument={instrument} range={range} value={value} />

      <p className="mt-1.5 text-xs text-ink-faint">
        {changed ? (
          <span className="text-accent-strong">
            Changing from {formatMagnitude(standing, instrument.unit)}. The projected
            effect of this move alone is on the confirmation screen.
          </span>
        ) : (
          <>In force at {formatMagnitude(standing, instrument.unit)}, unchanged.</>
        )}
      </p>
    </div>
  )
}
