import type { GoldStandard } from '../types/scenario.ts'
import type { RunConfig } from '../types/core.ts'
import type { SimulationState } from '../types/state.ts'
import type { ResolvedEventRecord } from '../types/events.ts'
import { clampLatentState } from '../config/bounds.ts'
import { applyEffects } from '../engine/advanceTrueState.ts'
import { scenarioOf } from './scenarios.ts'

/**
 * The gold standard, as a constraint the player can see and cross.
 *
 * One rule: **there is a floor under the policy rate, and standing below it
 * costs you gold.** Gold leaving is not a number on a gauge here — it is the
 * banking system losing reserves, credit contracting, the spread widening and
 * the currency under pressure, which are four things the player already reads
 * and already knows how to act on. See the note on `GoldStandard` in
 * `types/scenario.ts` for why it is built this way rather than as a fifth.
 *
 * The floor is a schedule. It steps up on 21 September 1931, when Britain left
 * gold and sterling fell a quarter, because that is what actually raised the
 * rate New York had to pay to keep its gold — and the Federal Reserve raised
 * the discount rate from 1.5 % to 3.5 % over two weeks in October, in the third
 * year of a depression. A player who holds the rate down through that pays for
 * it; a player who follows the floor up pays for that too, in output. That is
 * the trap, and it is the trap as it existed.
 *
 * ## Why it is charged on the *nominal* rate
 *
 * Because gold moved on nominal interest differentials, not real ones. A
 * depositor in London comparing New York with Paris compared the rates paid,
 * and 10 % deflation did nothing for them. This is the one place in the engine
 * where the nominal rate matters on its own, and it is the reason the scenario
 * is a decision problem at all: the *real* rate the economy needs and the
 * *nominal* rate the gold stock needs point in opposite directions, hard, for
 * four years.
 */

/** The floor in force at a meeting, or null outside a gold-standard mandate. */
export function goldFloorAt(config: RunConfig, meetingIndex: number): number | null {
  const gold = scenarioOf(config)?.goldStandard ?? null
  if (gold === null) return null
  return floorOf(gold, meetingIndex)
}

function floorOf(gold: GoldStandard, meetingIndex: number): number {
  let rate = gold.floor[0]?.rate ?? 0
  for (const step of gold.floor) {
    if (step.fromMeeting <= meetingIndex) rate = step.rate
  }
  return rate
}

/** The marker's label, for the slider. */
export function goldLabel(config: RunConfig): string | null {
  return scenarioOf(config)?.goldStandard?.label ?? null
}

/**
 * Charge a meeting spent below the floor.
 *
 * Applied once per meeting, after the decision and before the economy is
 * advanced, so the drain is a consequence of the rate the committee actually
 * voted. It consumes no randomness: the same rate below the same floor always
 * costs the same, which is what makes the floor something a player can learn
 * rather than gamble against.
 *
 * Returns a newswire record when it bites, because an invisible penalty is not
 * a mechanic. The wire line says what left and why, and names nobody.
 */
export function applyGoldDrain(state: SimulationState): {
  readonly state: SimulationState
  readonly resolved: readonly ResolvedEventRecord[]
} {
  const scenario = scenarioOf(state.config)
  const gold = scenario?.goldStandard ?? null
  if (gold === null) return { state, resolved: [] }

  const floor = floorOf(gold, state.meetingIndex)
  const below = floor - state.latent.policyRate
  if (below <= 0.01) return { state, resolved: [] }

  // One coefficient scales the whole response; the shares between the four
  // quantities are fixed here so the document has one number to argue. They
  // are in the units each quantity is measured in: stress and the spread are
  // index points and percentage points, credit growth is percent a year, the
  // exchange rate is an index.
  const bite = gold.drainPerPoint * below
  const effects = [
    { variable: 'bankingStress' as const, delta: 7 * bite },
    { variable: 'creditSpread' as const, delta: 0.45 * bite },
    { variable: 'creditGrowth' as const, delta: -2.2 * bite },
    // And the market notices, which is what a reserve drain looks like from
    // outside: a convertibility nobody is sure will hold.
    { variable: 'marketVolatility' as const, delta: 3.5 * bite },
    // **Not the exchange rate.** The first version moved it down with every
    // drain, and that is the one thing a gold standard definitionally does not
    // do: the parity is fixed, which is the whole constraint. What gives is
    // the *stock* of gold, and the stock of gold gives through the banking
    // system. Measured, the mistake was not cosmetic — the compounding
    // currency move ended seven of twelve replays of the historical path in
    // `currency_dysfunction`, a failure the 1930s dollar never had.
  ]

  const diagnostics = [...state.diagnostics]
  const latent = clampLatentState(
    applyEffects(state.latent, effects),
    state.stepIndex,
    diagnostics,
  )

  const resolved: ResolvedEventRecord = {
    eventId: `gold_drain_${state.meetingIndex}`,
    family: 'banking_failure',
    meetingIndex: state.meetingIndex,
    title: 'Gold is leaving',
    newswire:
      `With the rate ${below.toFixed(2)} points under what the exchanges are ` +
      `paying, gold is being withdrawn for shipment abroad. Banks are calling ` +
      `loans to replace the reserves it took with it, and the discount houses ` +
      `are asking more for what credit is left.`,
    immediate: effects,
    delayedStepDelays: [],
    delayed: [],
    members: [],
  }

  return {
    state: {
      ...state,
      latent,
      diagnostics,
      eventLog: [...state.eventLog, resolved],
    },
    resolved: [resolved],
  }
}
