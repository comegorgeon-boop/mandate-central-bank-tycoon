import type { EventContext, GameEvent } from '../types/events.ts'
import type { LatentState } from '../types/state.ts'
import { HEADLINE, IS_CURVE, PHILLIPS } from '../config/model.ts'

/**
 * Which way an event pushes inflation, read off its declared effects.
 *
 * This exists to be tested against, not to be used by the engine. The
 * procedural catalog is written by hand, and a hand-written catalog drifts one
 * way: a spectacular bad news story is easier to invent than a convincing good
 * one. On the first measured build the easy-eligible events fired 188 times
 * with a cost-push effect against 6 times with a relieving one, and that 31:1
 * ratio — not the shock processes, which are symmetric by construction —
 * produced almost the whole inflation drift the player was asked to fight.
 *
 * `events.balance.test.ts` uses this to measure the realised ratio over many
 * seeded runs and fails if it leaves its band, so the next batch of events
 * cannot reintroduce the same skew silently.
 */

/**
 * Percentage points of headline inflation per unit of each latent variable,
 * at the peak of its effect.
 *
 * Derived from the model's own coefficients rather than chosen, so that
 * retuning the engine retunes this with it. Demand-side variables are routed
 * through the output gap they open — a disturbance of one unit settles the gap
 * at `1 / meanReversion` — and then through the Phillips curve's slope.
 *
 * These are rough on purpose. The classification only needs the sign and a
 * sense of scale; nothing downstream depends on the second digit.
 */
const GAP_PER_DEMAND_UNIT = 1 / IS_CURVE.meanReversion
const INFLATION_PER_GAP = PHILLIPS.gapSlope

export const INFLATION_WEIGHTS: Partial<Record<keyof LatentState, number>> = {
  // Direct.
  inflationHeadline: 1,
  inflationCore: 1,
  expectedInflationShort: 1,
  expectedInflationLong: 1,

  // A cost-push shock hits headline through its own amplifier and core through
  // the Phillips curve, less the demand it destroys on the way.
  supplyShock:
    HEADLINE.supplyAmplifier + 1 - IS_CURVE.supply * GAP_PER_DEMAND_UNIT * INFLATION_PER_GAP,

  // Roughly the two institutions' import pass-through.
  importPriceInflation: 0.1,
  wageGrowth: PHILLIPS.wagePressure,

  // Demand-side, through the gap.
  outputGap: INFLATION_PER_GAP,
  demandShock: GAP_PER_DEMAND_UNIT * INFLATION_PER_GAP,
  confidenceShock: IS_CURVE.confidence * GAP_PER_DEMAND_UNIT * INFLATION_PER_GAP,
  fiscalImpulse: IS_CURVE.fiscal * GAP_PER_DEMAND_UNIT * INFLATION_PER_GAP,
  creditGrowth: IS_CURVE.credit * GAP_PER_DEMAND_UNIT * INFLATION_PER_GAP,

  // Extra supply capacity is disinflationary.
  productivityShock: -INFLATION_PER_GAP,
  potentialGrowth: -INFLATION_PER_GAP,
}

/**
 * Net effect on inflation of everything an event declares, immediate and
 * delayed, in percentage points of headline.
 *
 * Delayed effects count in full. An event whose spike is immediate and whose
 * relief arrives three meetings later is balanced over its life, and reading
 * only the immediate half would call it inflationary.
 */
export function inflationImpulse(event: GameEvent, ctx: EventContext): number {
  let total = 0

  const accumulate = (variable: keyof LatentState, delta: number): void => {
    total += (INFLATION_WEIGHTS[variable] ?? 0) * delta
  }

  for (const effect of event.immediate(ctx)) accumulate(effect.variable, effect.delta)
  for (const spec of event.delayed(ctx)) {
    for (const effect of spec.effects) accumulate(effect.variable, effect.delta)
  }

  return total
}

export type InflationDirection = 'inflationary' | 'disinflationary' | 'neutral'

/**
 * Events whose net impulse is smaller than this count as neither, in
 * percentage points of headline inflation.
 *
 * A banking scare or a market melt-up is a real event with a real cost that is
 * simply not mainly about prices. Forcing everything into one of two buckets
 * would make the ratio below meaningless.
 */
export const NEUTRAL_BAND = 0.25

export function classifyEvent(
  event: GameEvent,
  ctx: EventContext,
): InflationDirection {
  const impulse = inflationImpulse(event, ctx)
  if (impulse > NEUTRAL_BAND) return 'inflationary'
  if (impulse < -NEUTRAL_BAND) return 'disinflationary'
  return 'neutral'
}
