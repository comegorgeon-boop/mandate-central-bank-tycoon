import { useMemo } from 'react'
import {
  projectInstrument,
  projectionTarget,
  standingLevel,
  type InstrumentEffect,
  type PolicyAction,
  type SimulationState,
} from '../../simulation/index.ts'
import { formatMagnitude } from './InstrumentStepper.tsx'
import { formatMeetings } from './lag.ts'

/**
 * What each instrument in this package is expected to do, on its own.
 *
 * Shown on the confirmation screen at every difficulty, deliberately. The
 * information ladder withdraws readings *of the economy* as the mode hardens —
 * what the shock is, what the staff think, where the true output gap sits —
 * because reading a situation is the skill those modes are testing. What a
 * lever does is not a reading of the situation. A chair on their first day
 * knows what a rate rise is for; withholding it does not make the mandate
 * harder, it makes the interface worse.
 *
 * Each figure is the engine's own answer, produced by running it twice from
 * this exact state — once with that one change, once without it — and
 * differencing. See `simulation/policy/instrumentEffect.ts`.
 */

/** A change in a series, in whatever the series is measured in. */
function formatDelta(delta: number, unit: string, decimals: number): string {
  const sign = delta > 0 ? '+' : '−'
  const magnitude = Math.abs(delta)
  if (unit === 'bp') return `${sign}${magnitude.toFixed(0)} bp`
  if (unit === 'index') return `${sign}${magnitude.toFixed(decimals)} pts`
  if (unit === 'pp' || unit.startsWith('%')) {
    return `${sign}${magnitude.toFixed(decimals)} pp`
  }
  return `${sign}${magnitude.toFixed(decimals)}`
}

function EffectRows({ effect }: { readonly effect: InstrumentEffect }) {
  return (
    <ul className="mt-2 space-y-1">
      {effect.lines.map((line) => (
        <li
          key={line.seriesId}
          className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm"
        >
          <span className={line.mandate ? 'font-medium text-ink' : 'text-ink-soft'}>
            {line.label}
          </span>
          <span className="tabular-nums text-ink">
            {line.negligible ? (
              <span className="text-ink-faint">no measurable change</span>
            ) : (
              formatDelta(line.delta, line.unit, line.decimals)
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * How much of today's miss one move closes.
 *
 * Without it the rows are honest and useless. A 50 bp rise reports −0.03 pp on
 * inflation at its own horizon, which is the correct number and reads as
 * "nothing happened" — the real lesson is that no single move fixes a 1.2 pp
 * miss, and that a mandate is a sequence of these rather than one decision.
 * Saying so requires putting the contribution next to the gap it is aimed at,
 * which is arithmetic the screen can do and the player should not have to.
 */
function scaleLine(effect: InstrumentEffect, target: number): string | null {
  const inflation = effect.lines.find((line) => line.seriesId === 'headline_inflation')
  if (inflation === undefined || inflation.negligible) return null

  const miss = inflation.now - target
  if (Math.abs(miss) < 0.2) return null

  // Toward target is a contribution of the opposite sign to the miss.
  const closes = (-inflation.delta * Math.sign(miss)) / Math.abs(miss)
  const percent = Math.round(Math.abs(closes) * 100)
  if (percent < 1) return null

  const gap = `${Math.abs(miss).toFixed(2)} pp ${miss > 0 ? 'above' : 'below'} target`
  return closes > 0
    ? `Inflation is ${gap}. This move closes about ${percent} % of that. A mandate is a run of these, not one of them.`
    : `Inflation is ${gap}, and this move widens it by about ${percent} % — check that is what you meant.`
}

export function InstrumentEffectPanel({
  state,
  actions,
}: {
  readonly state: SimulationState
  /** The package's actions. Guidance is excluded: it has its own preview. */
  readonly actions: readonly PolicyAction[]
}) {
  const effects = useMemo(() => {
    const results: InstrumentEffect[] = []
    for (const action of actions) {
      if (action.instrument === 'forward_guidance') continue
      const from =
        action.instrument === 'policy_rate'
          ? 0
          : (standingLevel(state.stance, action.instrument) ?? 0)
      const effect = projectInstrument(state, action, from)
      if (effect !== null) results.push(effect)
    }
    return results
  }, [state, actions])

  if (effects.length === 0) return null

  const target = projectionTarget(state)

  return (
    <section
      aria-labelledby="instrument-effect-heading"
      className="mt-4 rounded border border-edge-accent bg-sunk p-3"
    >
      <h3
        id="instrument-effect-heading"
        className="text-xs font-semibold uppercase tracking-wide text-accent-strong"
      >
        What each instrument is expected to do
      </h3>
      <p className="mt-1 text-xs text-ink-faint">
        Each figure is that one change against leaving it alone. Everything else
        in the package is held equal, so the rows do not add up to the decision —
        they say what each dial contributes to it. Each is read at its own
        horizon, because a rate rise and a liquidity facility do not arrive on
        the same schedule.
      </p>

      <div className="mt-3 space-y-4">
        {effects.map((effect) => (
          <div key={effect.instrument}>
            <p className="flex flex-wrap items-baseline justify-between gap-x-4">
              <span className="font-medium text-ink">{effect.label}</span>
              <span className="tabular-nums text-sm text-ink-soft">
                {effect.instrument === 'policy_rate'
                  ? formatMagnitude(effect.to, effect.unit)
                  : `${formatMagnitude(effect.from, effect.unit)} → ${formatMagnitude(effect.to, effect.unit)}`}
              </span>
            </p>
            <p className="text-2xs uppercase tracking-[0.1em] text-ink-faint">
              by {formatMeetings(effect.horizonMeetings)} from now
            </p>
            {effect.negligible ? (
              <p className="mt-1 text-sm text-ink-soft">
                Nothing this instrument reaches moves measurably in that time. That
                is the instrument telling you it is not the one this situation
                needs — or that the change is too small to register.
              </p>
            ) : (
              <>
                <EffectRows effect={effect} />
                {(() => {
                  const scale = scaleLine(effect, target)
                  return scale === null ? null : (
                    <p className="mt-1.5 text-xs text-ink-soft">{scale}</p>
                  )
                })()}
              </>
            )}
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-ink-faint">
        Other things will happen over the same quarters, and the economy owes this
        projection nothing. What it is honest about is direction and rough size.
      </p>
    </section>
  )
}
