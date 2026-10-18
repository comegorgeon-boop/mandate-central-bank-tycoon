import type { EventContext, GameEvent } from '../types/events.ts'
import { BANKING, VOLATILITY } from '../config/model.ts'

/**
 * Procedural event templates.
 *
 * Every entry is state-dependent: `isEligible` gates it on the economy,
 * `weight` scales how likely it is given the current state, and both the
 * immediate and delayed effects are computed from the context rather than
 * being fixed constants. An event never plays out identically twice, and no
 * outcome is scripted independently of the economy it lands in.
 *
 * Delays are expressed in internal sub-steps: four sub-steps make one
 * inter-meeting interval, so `delaySteps: 6` lands midway through the second
 * interval rather than neatly at the next meeting.
 *
 * All content is fictional. No real people, companies or current events.
 *
 * This is a starter catalogue with one worked reference per family; the full
 * set required for the MVP is added in the content pass.
 */

const ONE_MEETING = 4
const TWO_MEETINGS = 8
const THREE_MEETINGS = 12
const FOUR_MEETINGS = 16

/**
 * How much likelier a crisis is once its first act has already happened.
 *
 * The six `tier: 'major'` events are also drawn as **opening crises**, before
 * the first meeting and therefore before any predecessor can exist — so they
 * cannot carry `requires`, which would make them unreachable mid-mandate
 * rather than merely rarer. The chain is expressed in the weight instead: a
 * systemic bank failure out of a clear sky stays possible, because it is, and
 * becomes several times likelier as the third act of a run that was not
 * contained.
 *
 * Multiplicative rather than additive, so it scales whatever state-dependence
 * the event already had instead of swamping it.
 */
function afterOnset(ctx: EventContext, onset: string, factor = 2.5): number {
  return (ctx.occurrences[onset] ?? 0) > 0 ? factor : 1
}

/**
 * How much likelier the relief is when the episode was actually contained.
 *
 * The mirror of `afterOnset`, and the half of a chain that is easy to forget.
 * An escalation that fires when the player failed makes failure cost
 * something; on its own it makes success merely *less bad*, which is not the
 * same as a reward and does not feel like one. So the same onset that opens
 * the escalation also weights the relief — but only while the variable the
 * episode is about has come back.
 *
 * The escalation id is part of the test, and it is the part that was missing
 * first time round. Without it the condition reduces to "the variable is fine
 * *right now*", which is true on most meetings for most players — including
 * the passive ones — so the reward went to everybody and measured out as the
 * euro-area passive completion rate rising three points. A player who let the
 * episode escalate has not contained it, whatever the reading says today.
 *
 * It is also what keeps the draw honest. At hard an event fires most
 * meetings, so the probability is fixed and the catalogue is a *mix*: three
 * adverse second acts added to the pool do not add events, they displace
 * them, and the mix shifts adverse for everybody including the player who
 * contained the shock. Weighting the relief restores the balance where it was
 * earned instead of flattening it everywhere.
 */
function whenContained(
  ctx: EventContext,
  onset: string,
  escalation: string,
  contained: boolean,
  factor = 1.4,
): number {
  return (ctx.occurrences[onset] ?? 0) > 0 &&
    (ctx.occurrences[escalation] ?? 0) === 0 &&
    contained
    ? factor
    : 1
}

export const EVENT_CATALOG: readonly GameEvent[] = [
  // ---- Energy and commodities --------------------------------------------
  {
    id: 'energy_price_spike',
    shockCharacter: 'supply',
    family: 'energy_commodity',
    title: 'Energy price spike',
    newswire:
      'Wholesale gas and crude benchmarks jump after an unplanned outage at a ' +
      'major export terminal. Retail prices are expected to follow within weeks.',
    clue: 'Energy futures have moved into steep backwardation, a classic precursor of a price spike.',
    institutions: ['fed', 'ecb'],
    minDifficulty: 'easy',
    baseWeight: 1.0,
    cooldownMeetings: 3,
    maxOccurrences: 3,
    isEligible: () => true,
    // More likely when geopolitical risk is already elevated.
    weight: (ctx) => 0.6 + ctx.latent.geopoliticalRisk / 50,
    immediate: (ctx) => [
      { variable: 'supplyShock', delta: 1.6 },
      { variable: 'importPriceInflation', delta: 4.5 * (ctx.institution === 'ecb' ? 1.3 : 1) },
      { variable: 'confidenceShock', delta: -0.5 },
    ],
    delayed: () => [
      { delaySteps: ONE_MEETING, effects: [{ variable: 'supplyShock', delta: 0.7 }] },
      {
        delaySteps: TWO_MEETINGS,
        effects: [
          { variable: 'supplyShock', delta: -0.6 },
          { variable: 'outputGap', delta: -0.35 },
        ],
      },
    ],
    followUps: ['second_round_effects', 'energy_price_relief'],
    requires: [],
  },
  {
    id: 'energy_price_relief',
    shockCharacter: 'supply',
    family: 'energy_commodity',
    title: 'Energy prices fall back',
    newswire:
      'New supply comes online ahead of schedule and mild weather cuts demand. ' +
      'Wholesale energy prices retrace much of the past year of gains.',
    clue: null,
    institutions: ['fed', 'ecb'],
    minDifficulty: 'easy',
    baseWeight: 1.0,
    cooldownMeetings: 3,
    maxOccurrences: 3,
    // The counterpart to `energy_price_spike`, and deliberately as free to fire
    // as it is. It used to be gated on `supplyShock > 0.4` and to remove only
    // 0.8 of whatever was outstanding, so a shock reverting at 1.2/year had
    // usually decayed below the gate before the relief could fire: it landed 6
    // times against the spike's 62 over 150 runs. Good news that needs
    // permission to happen is not good news the player will ever meet.
    isEligible: () => true,
    // Still likelier after a run-up — new supply follows high prices — but the
    // floor matches the spike's own likelihood, because a counterpart that
    // fires four times for the spike's five is quietly a smaller event.
    weight: (ctx) =>
      (0.75 + Math.max(0, ctx.latent.supplyShock) / 2) *
      whenContained(
    ctx,
    'energy_price_spike',
    'second_round_effects',
    ctx.latent.expectedInflationShort <= 4.0,
  ),
    // Paired with the spike by MAGNITUDE, not just by name. The spike delivers
    // +1.7 of supplyShock over its life no matter the state; a relief whose
    // floor gave back only 0.7 in the calm economy it usually fires in
    // delivered half its counterpart, and that gap — invisible to any check
    // that counts firings — was most of the catalog's inflation drift.
    // `events/balance.test.ts` now measures the pair in delivered impulse.
    immediate: (ctx) => [
      {
        variable: 'supplyShock',
        // Floor at the spike's own opening move; larger when a run-up has left
        // more to give back. Energy overshoots in both directions.
        delta: -Math.min(2.2, 1.4 + Math.max(0, ctx.latent.supplyShock) * 0.4),
      },
      { variable: 'importPriceInflation', delta: -4.5 * (ctx.institution === 'ecb' ? 1.3 : 1) },
      { variable: 'confidenceShock', delta: 0.5 },
    ],
    // The mirror of the spike's tail: the retracement keeps going, then part
    // of it gives back as producers shut marginal supply back in.
    delayed: () => [
      { delaySteps: ONE_MEETING, effects: [{ variable: 'supplyShock', delta: -0.7 }] },
      {
        delaySteps: TWO_MEETINGS,
        effects: [
          { variable: 'supplyShock', delta: 0.6 },
          { variable: 'outputGap', delta: 0.35 },
        ],
      },
    ],
    followUps: [],
    requires: [],
  },

  // ---- Productivity -------------------------------------------------------
  {
    id: 'productivity_surge',
    shockCharacter: 'supply',
    family: 'productivity',
    title: 'Productivity surprises to the upside',
    newswire:
      'Revised national accounts show output per hour rising faster than any ' +
      'estimate on record for this stage of the cycle.',
    clue: null,
    institutions: ['fed', 'ecb'],
    minDifficulty: 'easy',
    baseWeight: 0.7,
    cooldownMeetings: 6,
    maxOccurrences: 2,
    isEligible: () => true,
    weight: () => 1,
    immediate: () => [
      { variable: 'productivityShock', delta: 0.8 },
      { variable: 'potentialGrowth', delta: 0.3 },
    ],
    // Disinflationary, but only once it has fed through to unit labour costs.
    delayed: () => [
      {
        delaySteps: TWO_MEETINGS,
        effects: [
          { variable: 'inflationCore', delta: -0.25 },
          { variable: 'outputGap', delta: -0.2 },
        ],
      },
    ],
    followUps: [],
    requires: [],
  },

  // ---- Supply chains ------------------------------------------------------
  {
    id: 'supply_chain_disruption',
    shockCharacter: 'supply',
    family: 'supply_chain',
    title: 'Shipping disruption lengthens delivery times',
    newswire:
      'A prolonged closure on a major shipping route forces carriers onto longer ' +
      'passages. Manufacturers report the worst delivery delays in years.',
    clue: 'Freight rates on the main container routes have doubled in a fortnight.',
    institutions: ['fed', 'ecb'],
    minDifficulty: 'easy',
    baseWeight: 0.9,
    cooldownMeetings: 4,
    maxOccurrences: 2,
    isEligible: () => true,
    weight: (ctx) => 0.7 + ctx.latent.geopoliticalRisk / 60,
    immediate: (ctx) => [
      { variable: 'supplyShock', delta: 1.1 },
      { variable: 'importPriceInflation', delta: 3.0 * (ctx.institution === 'ecb' ? 1.3 : 1) },
    ],
    delayed: () => [
      {
        delaySteps: TWO_MEETINGS,
        effects: [
          { variable: 'outputGap', delta: -0.4 },
          { variable: 'supplyShock', delta: 0.4 },
        ],
      },
      { delaySteps: THREE_MEETINGS, effects: [{ variable: 'supplyShock', delta: -0.8 }] },
    ],
    followUps: ['supply_rupture', 'supply_chain_normalisation'],
    requires: [],
  },
  {
    id: 'supply_chain_normalisation',
    shockCharacter: 'supply',
    family: 'supply_chain',
    title: 'Shipping capacity catches up with demand',
    newswire:
      'New vessel deliveries and reopened routes clear the backlog at the major ' +
      'ports. Delivery times fall back to their pre-disruption range.',
    clue: 'Container rates on the main routes have halved as new capacity comes into service.',
    institutions: ['fed', 'ecb'],
    minDifficulty: 'easy',
    baseWeight: 0.9,
    cooldownMeetings: 4,
    maxOccurrences: 2,
    // The mirror of `supply_chain_disruption`, and as free to fire as it is.
    isEligible: () => true,
    // Likelier when supply is actually strained — capacity is ordered against
    // a backlog, not against calm seas. Keying this on *low* geopolitical risk
    // was what unbalanced the realised counts: escalations keep risk elevated
    // for whole mandates, so the normalisation rarely outweighed a disruption
    // whose own weight rises with that same risk.
    weight: (ctx) =>
      (0.9 + Math.max(0, ctx.latent.supplyShock) / 2) *
      whenContained(
    ctx,
    'supply_chain_disruption',
    'supply_rupture',
    ctx.latent.supplyShock < 1.0,
  ),
    immediate: (ctx) => [
      { variable: 'supplyShock', delta: -1.1 },
      {
        variable: 'importPriceInflation',
        delta: -3.0 * (ctx.institution === 'ecb' ? 1.3 : 1),
      },
    ],
    delayed: () => [
      {
        delaySteps: TWO_MEETINGS,
        effects: [
          { variable: 'outputGap', delta: 0.4 },
          { variable: 'supplyShock', delta: -0.4 },
        ],
      },
      { delaySteps: THREE_MEETINGS, effects: [{ variable: 'supplyShock', delta: 0.8 }] },
    ],
    followUps: [],
    requires: [],
  },

  // ---- Fiscal -------------------------------------------------------------
  {
    id: 'fiscal_expansion',
    shockCharacter: 'demand',
    family: 'fiscal',
    title: 'Legislature passes a large spending package',
    newswire:
      'A multi-year investment and transfer package clears the legislature, ' +
      'front-loaded into the coming budget year.',
    clue: 'Budget negotiations have converged on a package materially larger than forecasters assumed.',
    institutions: ['fed', 'ecb'],
    minDifficulty: 'easy',
    baseWeight: 0.9,
    cooldownMeetings: 5,
    maxOccurrences: 2,
    isEligible: () => true,
    // Politically easier to pass when unemployment is high.
    weight: (ctx) =>
      0.6 + Math.max(0, ctx.latent.unemployment - ctx.latent.naturalUnemployment) / 2,
    immediate: () => [
      { variable: 'fiscalImpulse', delta: 1.4 },
      { variable: 'debtPressure', delta: 5 },
      { variable: 'confidenceShock', delta: 0.4 },
    ],
    delayed: () => [
      { delaySteps: ONE_MEETING, effects: [{ variable: 'outputGap', delta: 0.3 }] },
      {
        delaySteps: THREE_MEETINGS,
        effects: [
          { variable: 'outputGap', delta: 0.35 },
          { variable: 'debtPressure', delta: 4 },
        ],
      },
    ],
    followUps: ['sovereign_repricing', 'fiscal_consolidation'],
    requires: [],
  },
  {
    id: 'fiscal_consolidation',
    shockCharacter: 'demand',
    family: 'fiscal',
    title: 'Legislature agrees a deficit reduction package',
    newswire:
      'A multi-year consolidation clears the legislature after a long standoff, ' +
      'combining spending restraint with a broadening of the tax base.',
    clue: 'Budget negotiations have converged on consolidation ahead of a debt ceiling review.',
    institutions: ['fed', 'ecb'],
    minDifficulty: 'easy',
    baseWeight: 0.9,
    cooldownMeetings: 5,
    maxOccurrences: 2,
    // The mirror of `fiscal_expansion`, and as free to fire as it is.
    isEligible: () => true,
    // Politically easier when the debt burden is the salient problem, which is
    // the mirror of expansion being easier when unemployment is.
    weight: (ctx) =>
      (0.6 + Math.max(0, ctx.latent.debtPressure - 35) / 30) *
      whenContained(
    ctx,
    'fiscal_expansion',
    'sovereign_repricing',
    ctx.latent.publicDebt < 110,
  ),
    immediate: () => [
      { variable: 'fiscalImpulse', delta: -1.4 },
      { variable: 'debtPressure', delta: -5 },
      { variable: 'confidenceShock', delta: -0.4 },
    ],
    delayed: () => [
      { delaySteps: ONE_MEETING, effects: [{ variable: 'outputGap', delta: -0.3 }] },
      {
        delaySteps: THREE_MEETINGS,
        effects: [
          { variable: 'outputGap', delta: -0.35 },
          { variable: 'debtPressure', delta: -4 },
        ],
      },
    ],
    followUps: [],
    requires: [],
  },

  // ---- Banking ------------------------------------------------------------
  {
    id: 'bank_funding_scare',
    shockCharacter: 'financial',
    family: 'banking',
    title: 'Funding scare at a mid-sized lender',
    newswire:
      'A mid-sized lender is forced to deny funding difficulties after an ' +
      'unusually expensive wholesale issue. Peers trade sharply lower.',
    clue: 'Bank funding spreads have widened for three consecutive weeks against a calm broader market.',
    institutions: ['fed', 'ecb'],
    minDifficulty: 'easy',
    baseWeight: 0.8,
    cooldownMeetings: 5,
    maxOccurrences: 2,
    // Fragility has to exist before a scare can find purchase.
    isEligible: (ctx) => ctx.latent.bankingStress > BANKING.base * 1.15,
    weight: (ctx) =>
      0.4 +
      ctx.latent.bankingStress / 35 +
      Math.max(0, ctx.latent.creditSpread - 1.1),
    immediate: (ctx) => [
      { variable: 'bankingStress', delta: 9 + ctx.latent.bankingStress * 0.15 },
      { variable: 'creditSpread', delta: 0.4 },
      { variable: 'marketVolatility', delta: 8 },
    ],
    delayed: () => [
      {
        delaySteps: ONE_MEETING,
        effects: [
          { variable: 'creditGrowth', delta: -1.2 },
          { variable: 'bankingStress', delta: 3 },
        ],
      },
    ],
    followUps: ['deposit_flight'],
    requires: [],
  },
  {
    id: 'deposit_flight',
    shockCharacter: 'financial',
    family: 'banking',
    title: 'Deposits leave the weakest lenders',
    newswire:
      'Weekly data show deposits moving out of the most exposed institutions and ' +
      'into money funds. Supervisors describe the flows as orderly but persistent.',
    clue: 'Money-fund inflows have run at three times their normal pace since the funding scare.',
    institutions: ['fed', 'ecb'],
    minDifficulty: 'medium',
    baseWeight: 1.2,
    cooldownMeetings: 3,
    maxOccurrences: 2,
    // Only reachable after a scare, and only if stress was not contained.
    isEligible: (ctx) => ctx.latent.bankingStress > BANKING.base * 1.6,
    weight: (ctx) => 0.5 + ctx.latent.bankingStress / 30,
    immediate: (ctx) => [
      { variable: 'bankingStress', delta: 12 + ctx.latent.bankingStress * 0.2 },
      { variable: 'creditSpread', delta: 0.6 },
      { variable: 'marketVolatility', delta: 10 },
      { variable: 'reserves', delta: -6 },
    ],
    delayed: () => [
      {
        delaySteps: ONE_MEETING,
        effects: [
          { variable: 'creditGrowth', delta: -2.5 },
          { variable: 'outputGap', delta: -0.5 },
        ],
      },
    ],
    followUps: ['banking_failure'],
    requires: ['bank_funding_scare'],
  },

  // ---- Housing ------------------------------------------------------------
  {
    id: 'housing_correction',
    shockCharacter: 'financial',
    family: 'housing',
    title: 'House prices turn down sharply',
    newswire:
      'Transaction volumes collapse and asking prices are cut across most ' +
      'regions. Developers halt starts on projects approved last year.',
    clue: 'Mortgage approvals have fallen for four straight months while inventory builds.',
    institutions: ['fed', 'ecb'],
    minDifficulty: 'easy',
    baseWeight: 1.0,
    cooldownMeetings: 6,
    maxOccurrences: 2,
    // A correction needs something to correct.
    isEligible: (ctx) => ctx.latent.assetPricePressure > 18,
    weight: (ctx) => 0.3 + ctx.latent.assetPricePressure / 30,
    immediate: (ctx) => [
      { variable: 'assetPricePressure', delta: -ctx.latent.assetPricePressure * 0.45 },
      { variable: 'bankingStress', delta: 6 },
      { variable: 'confidenceShock', delta: -0.8 },
    ],
    delayed: () => [
      {
        delaySteps: TWO_MEETINGS,
        effects: [
          { variable: 'outputGap', delta: -0.6 },
          { variable: 'creditGrowth', delta: -1.5 },
        ],
      },
    ],
    followUps: ['housing_market_crash'],
    requires: [],
  },

  // ---- Geopolitics --------------------------------------------------------
  {
    id: 'geopolitical_escalation',
    shockCharacter: 'supply',
    family: 'geopolitical',
    title: 'Geopolitical tensions escalate',
    newswire:
      'A regional dispute escalates, prompting new trade restrictions between ' +
      'several large economies. Risk assets sell off worldwide.',
    clue: null,
    institutions: ['fed', 'ecb'],
    minDifficulty: 'easy',
    baseWeight: 0.9,
    cooldownMeetings: 4,
    maxOccurrences: 3,
    isEligible: () => true,
    weight: (ctx) => 0.6 + ctx.latent.geopoliticalRisk / 70,
    immediate: () => [
      { variable: 'geopoliticalRisk', delta: 22 },
      { variable: 'marketVolatility', delta: 9 },
      { variable: 'supplyShock', delta: 0.7 },
      { variable: 'confidenceShock', delta: -0.9 },
    ],
    delayed: () => [
      {
        delaySteps: TWO_MEETINGS,
        effects: [
          { variable: 'outputGap', delta: -0.45 },
          { variable: 'geopoliticalRisk', delta: -8 },
        ],
      },
    ],
    followUps: ['geopolitical_crisis_outbreak', 'geopolitical_dealescalation'],
    requires: [],
  },
  {
    id: 'geopolitical_dealescalation',
    shockCharacter: 'supply',
    family: 'geopolitical',
    title: 'Negotiated settlement eases a long-running dispute',
    newswire:
      'Mediated talks produce a phased rollback of trade restrictions between ' +
      'several large economies. Risk assets rally and freight insurance falls.',
    clue: 'Back-channel talks are reported to have reached an outline agreement.',
    institutions: ['fed', 'ecb'],
    minDifficulty: 'easy',
    baseWeight: 0.9,
    cooldownMeetings: 4,
    maxOccurrences: 3,
    // A dispute has to exist before it can be settled, but the bar is set at
    // the level the risk process spends most of its time above, so this is a
    // soft precondition rather than the kind of gate that silenced the energy
    // relief event.
    isEligible: (ctx) => ctx.latent.geopoliticalRisk > 15,
    weight: (ctx) =>
      (0.6 + ctx.latent.geopoliticalRisk / 70) *
      whenContained(
        ctx,
        'geopolitical_escalation',
        'geopolitical_crisis_outbreak',
        ctx.latent.geopoliticalRisk < 45,
      ),
    // Level-symmetric with the escalation: each escalation nets +14 of risk
    // over its life, so a settlement that nets only -12 leaves the risk index
    // ratcheting upward run after run — and since the energy spike and the
    // shipping disruption both scale their firing weight on that index, a
    // ratchet here quietly tilts the whole catalog inflationary.
    immediate: () => [
      { variable: 'geopoliticalRisk', delta: -22 },
      { variable: 'marketVolatility', delta: -7 },
      { variable: 'supplyShock', delta: -0.7 },
      { variable: 'confidenceShock', delta: 0.9 },
    ],
    delayed: () => [
      {
        delaySteps: TWO_MEETINGS,
        effects: [
          { variable: 'outputGap', delta: 0.45 },
          { variable: 'geopoliticalRisk', delta: 8 },
        ],
      },
    ],
    followUps: [],
    requires: [],
  },

  // ---- Exchange rate ------------------------------------------------------
  {
    id: 'currency_pressure',
    shockCharacter: 'demand',
    family: 'exchange_rate',
    title: 'Currency comes under sustained pressure',
    newswire:
      'The currency slides against its main partners as investors reprice the ' +
      'expected policy gap. Importers warn of pass-through to shelf prices.',
    clue: 'Speculative positioning against the currency has reached a multi-year extreme.',
    institutions: ['fed', 'ecb'],
    minDifficulty: 'medium',
    baseWeight: 0.9,
    cooldownMeetings: 4,
    maxOccurrences: 3,
    isEligible: () => true,
    // The open euro-area economy is more exposed to this than the US.
    weight: (ctx) =>
      (ctx.institution === 'ecb' ? 1.4 : 0.9) +
      Math.max(0, ctx.latent.marketVolatility - VOLATILITY.base) / 40,
    immediate: (ctx) => [
      { variable: 'exchangeRate', delta: -7 },
      { variable: 'importPriceInflation', delta: ctx.institution === 'ecb' ? 6 : 3.5 },
      { variable: 'marketVolatility', delta: 5 },
    ],
    // Pass-through is a *tail*, not a quarter. The old version delivered one
    // inflation bump a meeting later and was finished; measured against a
    // control with every other draw held fixed, it changed a competent
    // committee's package in four meetings out of forty-eight, which is the
    // floor `consequence.test.ts` sets and not a currency crisis. Contracts
    // reprice on renewal, so a slide keeps arriving in shelf prices for a year
    // and more — which is also what makes it a decision rather than a
    // headline: the committee has to judge whether to look through it.
    delayed: (ctx) => [
      {
        delaySteps: ONE_MEETING,
        effects: [
          { variable: 'inflationHeadline', delta: ctx.institution === 'ecb' ? 0.35 : 0.15 },
        ],
      },
      {
        delaySteps: TWO_MEETINGS,
        effects: [
          { variable: 'importPriceInflation', delta: ctx.institution === 'ecb' ? 3.4 : 2 },
          { variable: 'inflationHeadline', delta: ctx.institution === 'ecb' ? 0.22 : 0.1 },
        ],
      },
      { delaySteps: THREE_MEETINGS, effects: [{ variable: 'outputGap', delta: 0.2 }] },
      {
        delaySteps: FOUR_MEETINGS,
        effects: [
          { variable: 'inflationHeadline', delta: ctx.institution === 'ecb' ? 0.16 : 0.07 },
        ],
      },
    ],
    followUps: ['capital_flight', 'currency_appreciation'],
    requires: [],
  },
  {
    id: 'currency_appreciation',
    shockCharacter: 'demand',
    family: 'exchange_rate',
    title: 'Currency rallies on safe-haven inflows',
    newswire:
      'The currency climbs against its main partners as investors seek a ' +
      'stable home for capital. Importers pass the savings into shelf prices; ' +
      'exporters warn about lost competitiveness.',
    clue: 'Speculative positioning in favour of the currency has reached a multi-year extreme.',
    institutions: ['fed', 'ecb'],
    minDifficulty: 'medium',
    baseWeight: 0.9,
    cooldownMeetings: 4,
    maxOccurrences: 3,
    // The mirror of `currency_pressure`, paired by magnitude throughout. It
    // was the one direction the exchange rate could not move: every other
    // family had its counterpart, and the missing one showed up as exactly
    // the residual inflation tilt the balance guard flags on medium.
    isEligible: () => true,
    // Inflows favour the currency of a calm, credible bloc — the mirror of
    // pressure building when volatility runs above its base.
    weight: (ctx) =>
      ((ctx.institution === 'ecb' ? 1.4 : 0.9) +
      Math.max(0, VOLATILITY.base - ctx.latent.marketVolatility) / 40) *
      whenContained(
    ctx,
    'currency_pressure',
    'capital_flight',
    ctx.latent.exchangeRate >= 85,
    1.6,
  ),
    immediate: (ctx) => [
      { variable: 'exchangeRate', delta: 7 },
      { variable: 'importPriceInflation', delta: ctx.institution === 'ecb' ? -6 : -3.5 },
      { variable: 'marketVolatility', delta: -3 },
    ],
    // Paired with `currency_pressure` term for term, including its tail: the
    // same repricing that carries a slide into shelf prices for a year carries
    // a rally into them, and a pair that is only symmetric on impact is a
    // one-sided inflation tilt hiding behind a matched name.
    delayed: (ctx) => [
      {
        delaySteps: ONE_MEETING,
        effects: [
          { variable: 'inflationHeadline', delta: ctx.institution === 'ecb' ? -0.35 : -0.15 },
        ],
      },
      {
        delaySteps: TWO_MEETINGS,
        effects: [
          { variable: 'importPriceInflation', delta: ctx.institution === 'ecb' ? -3.4 : -2 },
          { variable: 'inflationHeadline', delta: ctx.institution === 'ecb' ? -0.22 : -0.1 },
        ],
      },
      { delaySteps: THREE_MEETINGS, effects: [{ variable: 'outputGap', delta: -0.2 }] },
      {
        delaySteps: FOUR_MEETINGS,
        effects: [
          { variable: 'inflationHeadline', delta: ctx.institution === 'ecb' ? -0.16 : -0.07 },
        ],
      },
    ],
    followUps: [],
    requires: [],
  },

  // ---- Wages --------------------------------------------------------------
  {
    id: 'wage_round_breakout',
    shockCharacter: 'supply',
    family: 'wages',
    title: 'Wage round settles well above expectations',
    newswire:
      'A landmark sectoral agreement settles far above forecasts, and several ' +
      'other bargaining rounds reopen to match it.',
    clue: 'Two major bargaining rounds have opened with claims well above the settlement norm.',
    institutions: ['fed', 'ecb'],
    minDifficulty: 'easy',
    baseWeight: 1.0,
    cooldownMeetings: 4,
    maxOccurrences: 3,
    // Bargaining power comes from a tight labour market or high past inflation.
    isEligible: (ctx) =>
      ctx.latent.unemployment < ctx.latent.naturalUnemployment + 0.5 ||
      ctx.latent.inflationHeadline > 3.5,
    weight: (ctx) =>
      0.5 +
      Math.max(0, ctx.latent.naturalUnemployment - ctx.latent.unemployment) +
      Math.max(0, ctx.latent.inflationHeadline - 2) / 3,
    immediate: () => [
      { variable: 'wageGrowth', delta: 1.3 },
      { variable: 'expectedInflationShort', delta: 0.2 },
    ],
    delayed: () => [
      { delaySteps: TWO_MEETINGS, effects: [{ variable: 'inflationCore', delta: 0.3 }] },
      { delaySteps: THREE_MEETINGS, effects: [{ variable: 'wageGrowth', delta: 0.4 }] },
    ],
    followUps: ['wage_price_spiral'],
    requires: [],
  },

  // ---- Data revisions -----------------------------------------------------
  {
    id: 'benchmark_revision',
    shockCharacter: 'institutional',
    family: 'data_revision',
    title: 'Benchmark revision rewrites the recent past',
    newswire:
      'The statistical agency completes its benchmark revision. Potential output ' +
      'is re-estimated and the recent cycle looks materially different.',
    clue: null,
    institutions: ['fed', 'ecb'],
    minDifficulty: 'medium',
    baseWeight: 0.8,
    cooldownMeetings: 6,
    maxOccurrences: 2,
    isEligible: () => true,
    weight: () => 1,
    // The truth itself moves: the gap the committee thought it faced was wrong.
    immediate: (ctx) => {
      const direction = ctx.latent.outputGap > 0 ? -1 : 1
      return [
        { variable: 'outputGap', delta: 0.9 * direction },
        { variable: 'potentialGrowth', delta: -0.2 * direction },
        { variable: 'naturalUnemployment', delta: 0.2 * direction },
      ]
    },
    delayed: () => [],
    followUps: [],
    requires: [],
  },

  // ---- Communication ------------------------------------------------------
  {
    id: 'communication_leak',
    shockCharacter: 'institutional',
    family: 'communication',
    title: 'Deliberations leak before the statement',
    newswire:
      'A detailed account of the internal debate appears in the press hours ' +
      'before the scheduled release, including a dissent not yet made public.',
    clue: null,
    institutions: ['fed', 'ecb'],
    minDifficulty: 'medium',
    baseWeight: 0.7,
    cooldownMeetings: 6,
    maxOccurrences: 2,
    isEligible: () => true,
    // Leaks are more likely when the committee is under political pressure.
    weight: (ctx) => 0.5 + ctx.latent.politicalPressure / 60,
    // Rebuilt. Measured against a control with every other draw held fixed,
    // the old version changed a competent committee's package in **zero**
    // meetings out of 120 — the only entry in the catalog that changed
    // nothing at all, ever. It moved credibility by 4 and volatility by 6,
    // which the dynamics absorb inside a quarter, and it moved nothing a
    // decision reads.
    //
    // What a leak actually costs is the thing the old version did not touch:
    // the committee's *word*. If the press has the argument before the
    // statement does, the statement is no longer news — the announcement
    // channel, which is the fastest instrument on the desk, is spent before it
    // is used. That is `marketTrust`, which sets how much of a published path
    // markets price, and it is the anchor, because a committee that cannot
    // hold a discussion in private is one whose commitments are discounted.
    immediate: () => [
      { variable: 'credibility', delta: -7 },
      { variable: 'marketTrust', delta: -22 },
      { variable: 'marketVolatility', delta: 11 },
      { variable: 'politicalPressure', delta: 14 },
      { variable: 'anchoring', delta: -0.09 },
    ],
    // The dissent, once public, is argued over for a quarter and then fades.
    // Market trust returns; the anchor keeps most of the damage, because what
    // was lost is not this quarter's news but the presumption that what the
    // committee says is what the committee decided.
    delayed: () => [
      {
        delaySteps: ONE_MEETING,
        effects: [
          { variable: 'marketVolatility', delta: 4 },
          { variable: 'politicalPressure', delta: 6 },
        ],
      },
      {
        delaySteps: THREE_MEETINGS,
        effects: [
          { variable: 'marketTrust', delta: 14 },
          { variable: 'politicalPressure', delta: -14 },
          { variable: 'anchoring', delta: 0.04 },
        ],
      },
    ],
    followUps: [],
    requires: [],
    dispatchLines: [
      'The dissenting member has declined to comment; the committee has opened ' +
        'an internal review of how the account reached the press.',
      'The review closed without naming a source. Markets have stopped pricing ' +
        'the leak, though the committee is being read more sceptically than before.',
    ],
  },

  // ---- Market cycle -------------------------------------------------------
  {
    id: 'market_melt_up',
    shockCharacter: 'financial',
    family: 'market_cycle',
    title: 'Risk assets melt up',
    newswire:
      'Equity indices post their strongest quarter in years, led by leveraged ' +
      'strategies. Margin balances reach a record.',
    clue: null,
    institutions: ['fed', 'ecb'],
    minDifficulty: 'medium',
    baseWeight: 0.8,
    cooldownMeetings: 5,
    maxOccurrences: 2,
    // Melt-ups need easy money and calm markets.
    isEligible: (ctx) =>
      ctx.latent.marketVolatility < 25 && ctx.latent.creditGrowth > 1.5,
    weight: (ctx) => 0.5 + Math.max(0, ctx.latent.creditGrowth) / 5,
    immediate: () => [
      { variable: 'assetPricePressure', delta: 16 },
      { variable: 'creditGrowth', delta: 1.2 },
      { variable: 'confidenceShock', delta: 0.6 },
    ],
    delayed: () => [
      { delaySteps: TWO_MEETINGS, effects: [{ variable: 'assetPricePressure', delta: 8 }] },
    ],
    followUps: ['market_crash'],
    requires: [],
  },
  {
    id: 'market_crash',
    shockCharacter: 'financial',
    family: 'market_cycle',
    title: 'Leveraged positions unwind',
    newswire:
      'A disorderly unwind of crowded positions wipes out a quarter of gains in ' +
      'three sessions. Dealers step back from making prices.',
    clue: 'Dealer balance sheets are stretched and market depth has thinned sharply.',
    institutions: ['fed', 'ecb'],
    minDifficulty: 'medium',
    baseWeight: 1.1,
    cooldownMeetings: 4,
    maxOccurrences: 2,
    isEligible: (ctx) => ctx.latent.assetPricePressure > 25,
    weight: (ctx) => 0.4 + ctx.latent.assetPricePressure / 35,
    immediate: (ctx) => [
      { variable: 'assetPricePressure', delta: -ctx.latent.assetPricePressure * 0.55 },
      { variable: 'marketVolatility', delta: 22 },
      { variable: 'creditSpread', delta: 0.7 },
      { variable: 'bankingStress', delta: 8 },
    ],
    delayed: () => [
      {
        delaySteps: ONE_MEETING,
        effects: [
          { variable: 'outputGap', delta: -0.5 },
          { variable: 'confidenceShock', delta: -0.8 },
        ],
      },
    ],
    followUps: ['market_panic'],
    requires: ['market_melt_up'],
  },

  // ---- Natural disasters --------------------------------------------------
  {
    id: 'natural_disaster',
    shockCharacter: 'supply',
    family: 'natural_disaster',
    title: 'Severe weather disrupts a major region',
    newswire:
      'An extreme weather event closes ports and power infrastructure across a ' +
      'significant industrial region. Reconstruction spending is announced.',
    clue: null,
    institutions: ['fed', 'ecb'],
    minDifficulty: 'easy',
    baseWeight: 0.7,
    cooldownMeetings: 6,
    maxOccurrences: 2,
    isEligible: () => true,
    weight: () => 1,
    immediate: () => [
      { variable: 'supplyShock', delta: 0.9 },
      { variable: 'outputGap', delta: -0.4 },
      { variable: 'confidenceShock', delta: -0.5 },
    ],
    // Reconstruction turns an initial contraction into later demand, and
    // restores the lost capacity in full: a disaster is a violent *transitory*
    // supply event, not a permanent one, and leaving 0.4 of cost-push behind
    // per firing made it a one-sided inflation tax with no counterpart.
    delayed: () => [
      {
        delaySteps: TWO_MEETINGS,
        effects: [
          { variable: 'fiscalImpulse', delta: 0.6 },
          { variable: 'supplyShock', delta: -0.9 },
        ],
      },
      { delaySteps: THREE_MEETINGS, effects: [{ variable: 'outputGap', delta: 0.3 }] },
    ],
    followUps: [],
    requires: [],
  },

  /*
   * ---- Second acts ------------------------------------------------------
   *
   * Each of these `requires` an onset that happened earlier and is `isEligible`
   * only when the variable that onset was about is *still out of hand*. A
   * committee that brought expectations back, or the currency back, or wage
   * growth back, never meets them — which is the point. They are the
   * consequence of a shock that was allowed to settle in, and the only part of
   * this catalogue where what the player did between two meetings decides what
   * arrives at the third.
   *
   * The test is always a threshold on the state, never a check for a
   * particular policy. A player who anchored expectations by raising, by
   * talking, or by inheriting a credible institution is spared equally: the
   * game is reading the economy, not marking an answer.
   *
   * They are deliberately not `tier: 'major'`. A major is also drawn as an
   * opening crisis, before any predecessor can exist.
   */
  {
    id: 'second_round_effects',
    shockCharacter: 'supply',
    family: 'energy_commodity',
    title: 'The energy shock reaches the rest of the basket',
    newswire:
      'Firms across services and food processing have begun passing energy costs ' +
      'into list prices rather than absorbing them. Core measures, which had been ' +
      'quiet through the spike, turn up.',
    clue: 'Pricing surveys show the share of firms planning increases at its widest in years.',
    institutions: ['fed', 'ecb'],
    minDifficulty: 'medium',
    baseWeight: 0.7,
    cooldownMeetings: 6,
    maxOccurrences: 2,
    // Only reachable if short expectations drifted badly during the spike.
    //
    // The threshold is measured, not chosen. At 3.2 this gate stood open on
    // 22.8 % of competently played meetings against 25.4 % of passive ones —
    // which is not a containment test, it is a tax. At 4.0 it is 9.5 %
    // against 14.4 %: rare under either, and half again as likely when
    // nothing was done. See `dev/gateProbe.ts`.
    isEligible: (ctx) => ctx.latent.expectedInflationShort > 4.0,
    weight: (ctx) => 0.4 + Math.max(0, ctx.latent.expectedInflationShort - 4) * 1.2,
    immediate: () => [
      { variable: 'inflationCore', delta: 0.5 },
      { variable: 'supplyShock', delta: 0.8 },
      { variable: 'expectedInflationShort', delta: 0.25 },
    ],
    // Partly unwound, and the partly is the point. A second-round effect that
    // vanished would not be one; a second-round effect that never unwound
    // would be a permanent increase in the price level for every firing, which
    // is the one-sided inflation tax `natural_disaster` was rewritten to stop
    // being. Half of the core impulse comes back out over a year, and what is
    // left is the thing the committee has to deal with.
    delayed: () => [
      { delaySteps: ONE_MEETING, effects: [{ variable: 'inflationCore', delta: 0.3 }] },
      {
        delaySteps: THREE_MEETINGS,
        effects: [
          { variable: 'supplyShock', delta: -0.8 },
          { variable: 'outputGap', delta: -0.3 },
        ],
      },
      { delaySteps: FOUR_MEETINGS, effects: [{ variable: 'inflationCore', delta: -0.4 }] },
    ],
    followUps: ['wage_price_spiral'],
    requires: ['energy_price_spike'],
  },
  {
    id: 'wage_price_spiral',
    shockCharacter: 'supply',
    family: 'wages',
    title: 'Settlements begin indexing to the last print',
    newswire:
      'Three large agreements now contain explicit price-indexation clauses, ' +
      'the first since the last inflationary era. Employers describe them as ' +
      'the price of settling at all.',
    clue: 'Indexation clauses have reappeared in the largest bargaining rounds.',
    institutions: ['fed', 'ecb'],
    minDifficulty: 'medium',
    baseWeight: 0.65,
    cooldownMeetings: 6,
    maxOccurrences: 2,
    // The anchor has to have slipped. This is the mechanism the whole game is
    // about, so its gate is the long expectation.
    //
    // 2.5, not 3.0. The first version used 3.0 and could never fire at all:
    // long expectations reach 2.46 at the ninetieth percentile of competent
    // play and 2.57 of passive play, so the event was unreachable content
    // dressed as a consequence. At 2.5 it is open on 7.7 % of competent
    // meetings against 12.7 % of passive ones.
    isEligible: (ctx) =>
      ctx.latent.expectedInflationLong > 2.5 && ctx.latent.wageGrowth > 5.0,
    weight: (ctx) =>
      (0.5 + Math.max(0, ctx.latent.expectedInflationLong - 2.5) * 3) *
      // A spiral is likelier once the energy shock has already reached core:
      // that is what bargaining rounds are looking at when they ask for
      // indexation. The breakout is the onset; this is a second push on it.
      afterOnset(ctx, 'second_round_effects', 1.6),
    immediate: () => [
      { variable: 'wageGrowth', delta: 1.0 },
      { variable: 'expectedInflationLong', delta: 0.2 },
      { variable: 'inflationCore', delta: 0.3 },
    ],
    delayed: () => [
      { delaySteps: TWO_MEETINGS, effects: [{ variable: 'inflationCore', delta: 0.35 }] },
      { delaySteps: FOUR_MEETINGS, effects: [{ variable: 'wageGrowth', delta: 0.4 }] },
      {
        delaySteps: FOUR_MEETINGS + TWO_MEETINGS,
        effects: [
          { variable: 'inflationCore', delta: -0.45 },
          { variable: 'wageGrowth', delta: -0.7 },
        ],
      },
    ],
    followUps: [],
    requires: ['wage_round_breakout'],
  },
  {
    id: 'capital_flight',
    shockCharacter: 'financial',
    family: 'exchange_rate',
    title: 'Portfolio outflows accelerate',
    newswire:
      'Weekly fund data show the largest outflow from domestic assets on record ' +
      'for the series. Dealers report thin two-way interest at the long end.',
    clue: 'Foreign holdings of government paper have fallen for four consecutive weeks.',
    institutions: ['fed', 'ecb'],
    minDifficulty: 'medium',
    baseWeight: 0.7,
    cooldownMeetings: 6,
    maxOccurrences: 2,
    // The slide has to still be running. A committee that stabilised the
    // currency — by moving, or by being believed — does not meet this.
    //
    // `exchangeRate` is an **index around 100**, not a percentage deviation.
    // The first version tested `< -6` and so could never be true: the whole
    // event was unreachable. Below 85 is a genuinely weak currency, and it is
    // the best separator in the catalogue — open on 12.9 % of competently
    // played meetings against 26.2 % of passive ones.
    isEligible: (ctx) => ctx.latent.exchangeRate < 85,
    weight: (ctx) => 0.4 + Math.max(0, 90 - ctx.latent.exchangeRate) / 12,
    immediate: () => [
      { variable: 'exchangeRate', delta: -5 },
      { variable: 'termPremium', delta: 0.35 },
      { variable: 'marketVolatility', delta: 9 },
      { variable: 'creditSpread', delta: 0.3 },
    ],
    delayed: (ctx) => [
      {
        delaySteps: ONE_MEETING,
        effects: [
          // Closer to the Fed's than the open-economy asymmetry would suggest,
          // deliberately. `currency_pressure` already carries that asymmetry,
          // and stacking a second euro-area multiplier on its own second act
          // made the ECB's hard mandate turn on the exchange rate alone.
          { variable: 'importPriceInflation', delta: ctx.institution === 'ecb' ? 2.9 : 2.4 },
        ],
      },
      {
        delaySteps: THREE_MEETINGS,
        effects: [
          { variable: 'outputGap', delta: -0.35 },
          { variable: 'marketVolatility', delta: -9 },
        ],
      },
    ],
    followUps: [],
    requires: ['currency_pressure'],
  },

  // ---- Innovation and confidence ------------------------------------------
  {
    id: 'investment_boom',
    shockCharacter: 'demand',
    family: 'innovation',
    title: 'Investment boom in a new general-purpose technology',
    newswire:
      'Capital spending plans are revised sharply higher across sectors as a ' +
      'new general-purpose technology moves into commercial deployment.',
    clue: null,
    institutions: ['fed', 'ecb'],
    minDifficulty: 'easy',
    baseWeight: 0.7,
    cooldownMeetings: 6,
    maxOccurrences: 2,
    isEligible: (ctx) => ctx.latent.creditSpread < 2.5,
    weight: () => 1,
    immediate: () => [
      { variable: 'confidenceShock', delta: 1.0 },
      { variable: 'creditGrowth', delta: 1.5 },
      { variable: 'assetPricePressure', delta: 8 },
    ],
    // Demand first, supply later: inflationary in the short run, not the long.
    delayed: () => [
      { delaySteps: ONE_MEETING, effects: [{ variable: 'outputGap', delta: 0.4 }] },
      {
        delaySteps: THREE_MEETINGS,
        effects: [
          { variable: 'productivityShock', delta: 0.6 },
          { variable: 'potentialGrowth', delta: 0.25 },
        ],
      },
    ],
    followUps: [],
    requires: [],
  },

  // ===== Major events ========================================================
  //
  // Mandate-defining crises rather than background noise: `tier: 'major'`.
  // Rare (`baseWeight` well under the minors' 0.7-1.2) and singular
  // (`maxOccurrences: 1`) as *random* draws — one of them also fires
  // unconditionally at the first meeting of an easy mandate, via
  // `events/openingCrisis.ts`, which is not gated by weight or probability at
  // all.
  //
  // These were briefly scoped `maxDifficulty: 'easy'`, from the session that
  // added them with medium and hard explicitly out of scope. That ceiling is
  // gone: a mode whose whole subject is stagflation and tail risk cannot be
  // the one mode with no mandate-defining crisis in it, and the difficulty
  // work now lives on the axis that belongs to it — `shockMix` decides which
  // *kind* of crisis each mode is fed, `costPushCeiling` decides whether they
  // may pile onto one another, and `openingCrisisCharacters` decides which may
  // open a mandate at all. Each carries a real multi-sentence `newswire` and 2-3 `dispatchLines`
  // so the story keeps developing over the meetings after it breaks, without
  // needing any new persisted state: `events/dispatches.ts` derives what's
  // been revealed so far from `meetingIndex - record.meetingIndex` alone.
  //
  // Magnitudes are roughly 2.5-3x a comparable minor on their primary
  // channel, arced immediate-shock -> complication -> uneasy stabilisation
  // (never a full, clean resolution — a war doesn't just end, a failed bank
  // doesn't just get well). Three of the six (banking failure, housing crash,
  // market panic) hit predominantly unweighted channels in
  // `inflationImpulse.ts` (bankingStress, creditSpread, marketVolatility,
  // assetPricePressure, politicalPressure are not inflation-weighted, same as
  // the existing unpaired `bank_funding_scare`/`housing_correction`/
  // `market_crash`/`communication_leak`), so they need no mirrored good-news
  // counterpart to keep `events/balance.test.ts` inside its band. The other
  // three (geopolitical crisis, domestic political shock, supply rupture) are
  // each written to net back down close to neutral over their own arc for the
  // same reason the existing `energy_price_spike`/`supply_chain_disruption`
  // do. `financialShock` and `demandShock` are nudged where the story is
  // naturally that kind of shock, purely so `observation/diagnose.ts` names it
  // correctly — both are free or cheap against the balance guard.
  {
    id: 'geopolitical_crisis_outbreak',
    shockCharacter: 'supply',
    family: 'geopolitical_crisis',
    title: 'War breaks out along a key trade corridor',
    newswire:
      "Fighting has broken out between two regional powers along one of the world's " +
      'busiest shipping corridors. Insurers have suspended new coverage for vessels ' +
      'transiting the strait, and several governments are drawing up evacuation plans ' +
      'for nationals in the region.',
    clue: 'Naval insurers have quietly widened war-risk premiums across the corridor for three straight weeks.',
    institutions: ['fed', 'ecb'],
    minDifficulty: 'easy',
    tier: 'major',
    baseWeight: 0.15,
    cooldownMeetings: 8,
    maxOccurrences: 1,
    isEligible: () => true,
    weight: (ctx) =>
      (0.5 + ctx.latent.geopoliticalRisk / 60) *
      afterOnset(ctx, 'geopolitical_escalation', 2.5),
    immediate: (ctx) => [
      { variable: 'geopoliticalRisk', delta: 55 },
      { variable: 'marketVolatility', delta: 22 },
      { variable: 'supplyShock', delta: 4.0 },
      { variable: 'importPriceInflation', delta: 10 * (ctx.institution === 'ecb' ? 1.3 : 1) },
      { variable: 'confidenceShock', delta: -2.2 },
    ],
    delayed: (ctx) => [
      // The fighting spreads before it settles.
      {
        delaySteps: ONE_MEETING,
        effects: [
          { variable: 'supplyShock', delta: 1.7 },
          { variable: 'geopoliticalRisk', delta: 12 },
        ],
      },
      // A ceasefire holds, but re-routed shipping and the risk premium it
      // carries do not fully unwind — this is stabilisation, not resolution.
      //
      // The give-back is sized to leave a *premium*, not a permanent tax. At
      // -3.6 this arc netted +2.1 of outstanding cost-push and +6.95 of
      // lifetime inflation impulse — the largest one-directional source in the
      // whole catalog, unmirrored, against the energy spike's +5.58 which the
      // energy relief cancels at -6.59. It was invisible while the majors were
      // scoped to easy and rare; unlocking them above easy put three of the six
      // buckets outside `events/balance.test.ts`'s net-per-meeting band and is
      // what caught it.
      {
        delaySteps: THREE_MEETINGS,
        effects: [
          { variable: 'supplyShock', delta: -5.5 },
          { variable: 'importPriceInflation', delta: -9 * (ctx.institution === 'ecb' ? 1.3 : 1) },
          { variable: 'geopoliticalRisk', delta: -38 },
          { variable: 'outputGap', delta: -0.7 },
        ],
      },
    ],
    followUps: [],
    requires: [],
    dispatchLines: [
      'Shipping lines are re-routing around the corridor, adding weeks to delivery ' +
        'times on some of the busiest routes in the world.',
      'A ceasefire announced overnight is holding for now, though diplomats caution ' +
        'it is fragile and forces on both sides remain mobilised.',
    ],
  },
  {
    id: 'domestic_political_shock',
    shockCharacter: 'demand',
    family: 'domestic_political',
    title: "Government loses its majority in a snap vote",
    newswire:
      "A confidence vote has stripped the governing coalition of its majority, " +
      "throwing fiscal policy and the central bank's own leadership into question. " +
      "Opposition leaders have called for an emergency session and floated replacing " +
      "the bank's leadership within the year.",
    clue: "Coalition whips have failed to guarantee the numbers for next week's budget vote.",
    institutions: ['fed', 'ecb'],
    minDifficulty: 'easy',
    tier: 'major',
    baseWeight: 0.15,
    cooldownMeetings: 8,
    maxOccurrences: 1,
    isEligible: () => true,
    weight: (ctx) => 0.7 + ctx.latent.politicalPressure / 80,
    immediate: () => [
      { variable: 'politicalPressure', delta: 45 },
      { variable: 'credibility', delta: -9 },
      { variable: 'marketTrust', delta: -15 },
      { variable: 'marketVolatility', delta: 14 },
      // Uncertainty over who is actually in charge chills spending before any
      // policy has actually changed — a demand-shaped shock, not a supply one.
      { variable: 'demandShock', delta: -1.4 },
      { variable: 'confidenceShock', delta: -1.4 },
      // The anchor takes the hit on the day, not two quarters later.
      //
      // The standing `anchoringIndependence` channel is the *sustained* cost
      // of elevated pressure, and it is slow by construction — the anchoring
      // index moves at 0.6 a year, so over the two or three meetings this
      // event keeps pressure elevated it barely moves at all. Measured, the
      // event changed a competent committee's package in 31 meetings out of
      // 120 with the channel and 20 without it, which is not the difference
      // between a political crisis and an ordinary quarter. Openly questioning
      // who will run the central bank is *news*: households and markets
      // reprice the institution's commitment the same week, and the direct hit
      // is what represents that.
      { variable: 'anchoring', delta: -0.18 },
    ],
    delayed: () => [
      // A first attempt at forming a government fails.
      {
        delaySteps: ONE_MEETING,
        effects: [
          { variable: 'politicalPressure', delta: 16 },
          { variable: 'marketVolatility', delta: 9 },
          { variable: 'anchoring', delta: -0.08 },
        ],
      },
      // An interim arrangement holds. The institution is not out of the
      // spotlight, but the immediate threat to it has receded. The anchor
      // comes back by less than it lost: a bank that has been publicly
      // threatened once is discounted afterwards, and re-earning that is the
      // chair's job rather than the calendar's.
      {
        delaySteps: THREE_MEETINGS,
        effects: [
          { variable: 'politicalPressure', delta: -30 },
          { variable: 'marketTrust', delta: 8 },
          { variable: 'anchoring', delta: 0.16 },
        ],
      },
    ],
    followUps: [],
    requires: [],
    dispatchLines: [
      'A first attempt to form a caretaker coalition collapsed overnight; markets ' +
        'are pricing weeks of uncertainty before a government is confirmed.',
      'Party leaders have agreed an interim confidence-and-supply arrangement, and ' +
        "the immediate threat to the bank's leadership has receded.",
    ],
  },
  {
    id: 'banking_failure',
    shockCharacter: 'financial',
    family: 'banking_failure',
    title: 'A major regional lender collapses overnight',
    newswire:
      'Regulators seized a major regional lender in an emergency weekend action ' +
      'after a wave of withdrawals emptied its liquidity buffers within hours. ' +
      'Shares in peer institutions were suspended in early trading as counterparties ' +
      'scrambled to assess their exposure.',
    clue: 'Overnight funding costs for mid-sized lenders have detached sharply from the rest of the banking system.',
    institutions: ['fed', 'ecb'],
    minDifficulty: 'easy',
    tier: 'major',
    baseWeight: 0.15,
    cooldownMeetings: 8,
    maxOccurrences: 1,
    // Unlike `bank_funding_scare`, this does not require prior fragility: a
    // single failure can strike a genuinely healthy system without warning.
    isEligible: () => true,
    weight: (ctx) =>
      (0.8 + Math.max(0, ctx.latent.bankingStress - BANKING.base) / 40) *
      afterOnset(ctx, 'deposit_flight', 3),
    immediate: () => [
      { variable: 'bankingStress', delta: 50 },
      { variable: 'creditSpread', delta: 1.6 },
      { variable: 'marketVolatility', delta: 30 },
      { variable: 'confidenceShock', delta: -1.7 },
      // So `diagnoseShock` names this what it is: a financial shock.
      { variable: 'financialShock', delta: 2.6 },
    ],
    delayed: () => [
      // Contagion fear before the backstop is trusted.
      {
        delaySteps: ONE_MEETING,
        effects: [
          { variable: 'bankingStress', delta: 22 },
          { variable: 'creditGrowth', delta: -4.0 },
        ],
      },
      // A backstop calms markets, but a failure this size leaves a lasting
      // scar on the stress index rather than a clean recovery.
      {
        delaySteps: THREE_MEETINGS,
        effects: [
          { variable: 'bankingStress', delta: -24 },
          { variable: 'creditGrowth', delta: 1.8 },
          { variable: 'creditSpread', delta: -0.5 },
        ],
      },
    ],
    followUps: [],
    requires: [],
    dispatchLines: [
      'Two smaller lenders with similar balance-sheet profiles have reported ' +
        'unusually heavy deposit outflows over the past week.',
      'An emergency backstop facility has stopped the bleeding at peer ' +
        "institutions, though the failed lender's resolution will take months to " +
        'complete.',
    ],
  },
  {
    id: 'housing_market_crash',
    shockCharacter: 'financial',
    family: 'housing_crash',
    title: 'Property markets seize up nationwide',
    newswire:
      'Transaction volumes have collapsed across every major metropolitan market ' +
      'and several large developers have halted projects mid-construction. Estate ' +
      "agents describe a buyers' strike as sellers refuse to mark prices down and " +
      'buyers refuse to move until they do.',
    clue: 'Mortgage applications have fallen for five consecutive months while completed-but-unsold inventory keeps building.',
    institutions: ['fed', 'ecb'],
    minDifficulty: 'easy',
    tier: 'major',
    baseWeight: 0.15,
    cooldownMeetings: 8,
    maxOccurrences: 1,
    // Unlike `housing_correction`, this does not require a prior run-up: the
    // floor below is large enough to strike a fairly valued market too.
    isEligible: () => true,
    weight: (ctx) =>
      (0.7 + Math.max(0, ctx.latent.assetPricePressure) / 40) *
      afterOnset(ctx, 'housing_correction', 2.5),
    immediate: (ctx) => [
      {
        variable: 'assetPricePressure',
        delta: -Math.max(32, ctx.latent.assetPricePressure * 0.6),
      },
      { variable: 'bankingStress', delta: 26 },
      { variable: 'confidenceShock', delta: -1.9 },
      { variable: 'financialShock', delta: 1.7 },
    ],
    delayed: () => [
      // Demand destruction takes a couple of quarters to show up in full.
      {
        delaySteps: TWO_MEETINGS,
        effects: [
          { variable: 'outputGap', delta: -1.4 },
          { variable: 'creditGrowth', delta: -3.4 },
        ],
      },
      // Prices find a floor; volumes stay depressed. Partial, not complete.
      {
        delaySteps: FOUR_MEETINGS,
        effects: [
          { variable: 'outputGap', delta: 0.6 },
          { variable: 'creditGrowth', delta: 1.3 },
        ],
      },
    ],
    followUps: [],
    requires: [],
    dispatchLines: [
      'Two mid-sized developers have sought creditor protection, and lenders with ' +
        'concentrated construction-loan exposure are under fresh scrutiny.',
      'Prices have found a floor in the hardest-hit markets, though transaction ' +
        'volumes remain far below their normal pace.',
    ],
  },
  {
    id: 'supply_rupture',
    shockCharacter: 'supply',
    family: 'supply_rupture',
    title: 'Export ban cuts off a critical input overnight',
    newswire:
      'A sudden export ban on a critical industrial input has left manufacturers ' +
      'scrambling for alternatives with almost no notice. Factories dependent on ' +
      'the material report only weeks of buffer stock, and substitutes are neither ' +
      'qualified nor available at scale.',
    clue: 'Buyers have reported abrupt cancellations of scheduled cargoes with no replacement offered.',
    institutions: ['fed', 'ecb'],
    minDifficulty: 'easy',
    tier: 'major',
    baseWeight: 0.15,
    cooldownMeetings: 8,
    maxOccurrences: 1,
    isEligible: () => true,
    weight: (ctx) =>
      (0.6 + ctx.latent.geopoliticalRisk / 70) *
      afterOnset(ctx, 'supply_chain_disruption', 2.5),
    immediate: (ctx) => [
      { variable: 'supplyShock', delta: 4.0 },
      { variable: 'importPriceInflation', delta: 10 * (ctx.institution === 'ecb' ? 1.3 : 1) },
    ],
    delayed: (ctx) => [
      { delaySteps: ONE_MEETING, effects: [{ variable: 'supplyShock', delta: 1.6 }] },
      // Alternate suppliers ramp up, at a lasting premium to the old price —
      // a premium, which is what the newswire says, rather than the permanent
      // +2.0 of outstanding cost-push a -3.6 give-back actually left. See the
      // geopolitical crisis above for how that was caught.
      {
        delaySteps: THREE_MEETINGS,
        effects: [
          { variable: 'supplyShock', delta: -5.4 },
          { variable: 'importPriceInflation', delta: -9 * (ctx.institution === 'ecb' ? 1.3 : 1) },
        ],
      },
    ],
    followUps: [],
    requires: [],
    dispatchLines: [
      'Manufacturers are rationing existing stock and idling production lines that ' +
        'cannot be adapted to substitute materials.',
      'Alternative suppliers are ramping up output and the first substitute ' +
        'cargoes are reaching buyers, though at a steep premium to the old price.',
    ],
  },
  {
    id: 'market_panic',
    shockCharacter: 'financial',
    family: 'market_panic',
    title: 'Leveraged trades unwind in a disorderly rout',
    newswire:
      'A wave of forced selling has swept through leveraged positions across asset ' +
      'classes, with dealers stepping back from making prices as losses cascade ' +
      'through margin calls. Exchanges have triggered circuit breakers more than ' +
      'once in a single session.',
    // Genuinely unforeseeable, unlike `market_crash`: this is not the unwind of
    // a melt-up the player could have seen building.
    clue: null,
    institutions: ['fed', 'ecb'],
    minDifficulty: 'easy',
    tier: 'major',
    baseWeight: 0.15,
    cooldownMeetings: 8,
    maxOccurrences: 1,
    isEligible: () => true,
    weight: (ctx) =>
      (0.5 + Math.max(0, ctx.latent.marketVolatility - VOLATILITY.base) / 40) *
      afterOnset(ctx, 'market_crash', 3),
    immediate: (ctx) => [
      { variable: 'marketVolatility', delta: 44 },
      { variable: 'creditSpread', delta: 1.6 },
      { variable: 'bankingStress', delta: 20 },
      {
        variable: 'assetPricePressure',
        delta: -Math.max(26, ctx.latent.assetPricePressure * 0.5),
      },
      { variable: 'confidenceShock', delta: -2.0 },
      { variable: 'financialShock', delta: 3.0 },
    ],
    delayed: () => [
      {
        delaySteps: ONE_MEETING,
        effects: [
          { variable: 'outputGap', delta: -1.3 },
          { variable: 'confidenceShock', delta: -0.9 },
        ],
      },
      // Circuit breakers and backstops calm trading; the demand hit does not
      // reverse on its own.
      {
        delaySteps: THREE_MEETINGS,
        effects: [
          { variable: 'marketVolatility', delta: -24 },
          { variable: 'creditSpread', delta: -0.7 },
        ],
      },
    ],
    followUps: [],
    requires: [],
    dispatchLines: [
      'Margin desks report a second wave of forced selling as overnight losses ' +
        'triggered further collateral calls.',
      'Circuit breakers and emergency liquidity have restored orderly trading, ' +
        'though positioning across the market remains far lighter than before.',
    ],
  },
  // ---- Asymmetric: shocks that fall on part of a currency area ------------
  //
  // The mechanic that makes one policy rate a genuine problem rather than an
  // arithmetic one. A common shock has a common answer; these do not. Each
  // finds its member by *structure* — the most indebted, the most
  // energy-exposed — so the economics chooses the country rather than a story
  // choosing it. See `events/memberShocks.ts`.
  {
    id: 'sovereign_repricing',
    shockCharacter: 'financial',
    family: 'sovereign',
    title: 'Sovereign spreads reprice across the area',
    newswire:
      'Investors have repriced the debt of the most heavily indebted member ' +
      'sharply wider against the area benchmark, citing a financing programme ' +
      'larger than the market had assumed. Other members are little changed.',
    clue: 'Auction cover ratios have thinned at the long end for the area\'s largest debt issuers.',
    institutions: ['ecb'],
    minDifficulty: 'medium',
    baseWeight: 0.9,
    cooldownMeetings: 4,
    maxOccurrences: 3,
    isEligible: () => true,
    // More likely when the common rate is already high and risk appetite thin,
    // which is when a debt burden stops being a background fact.
    weight: (ctx) =>
      (0.5 + Math.max(0, ctx.latent.policyRate) / 4 + Math.max(0, ctx.latent.marketVolatility - VOLATILITY.base) / 30) *
      afterOnset(ctx, 'fiscal_expansion', 2),
    immediate: () => [
      { variable: 'fragmentation', delta: 60 },
      { variable: 'marketVolatility', delta: 8 },
    ],
    // The area's *own* numbers barely move. That is the lesson: a member can
    // be in serious trouble while the aggregate the committee targets says
    // almost nothing is happening.
    memberEffects: () => [
      { member: 'most_indebted', field: 'spread', magnitude: 190 },
      { member: 'most_indebted', field: 'outputGapOffset', magnitude: -1.2 },
    ],
    delayed: () => [
      {
        delaySteps: TWO_MEETINGS,
        effects: [{ variable: 'fragmentation', delta: 25 }],
      },
      {
        delaySteps: FOUR_MEETINGS,
        effects: [{ variable: 'fragmentation', delta: -55 }],
      },
    ],
    followUps: [],
    requires: [],
  },
  {
    id: 'gas_supply_interruption',
    shockCharacter: 'supply',
    family: 'energy_commodity',
    title: 'Pipeline outage hits the gas-dependent economies',
    newswire:
      'An unplanned interruption on a major import route has cut deliveries to ' +
      'the members that rely on it most. Economies with other supply routes are ' +
      'largely unaffected, and area-wide wholesale prices have moved much less ' +
      'than national ones.',
    clue: 'Storage levels have diverged sharply between members on the same wholesale market.',
    institutions: ['ecb'],
    minDifficulty: 'medium',
    baseWeight: 0.85,
    cooldownMeetings: 5,
    maxOccurrences: 2,
    isEligible: () => true,
    weight: (ctx) => 0.7 + ctx.latent.geopoliticalRisk / 60,
    immediate: () => [{ variable: 'supplyShock', delta: 0.5 }],
    // Two members, which is what the story is about: gas-intensive industry
    // and the economies that import through the interrupted route. The most
    // energy-exposed member is small, so on its own the area would barely
    // register an event whose whole point is that it is felt unevenly.
    memberEffects: () => [
      { member: 'most_energy_exposed', field: 'inflationOffset', magnitude: 2.4 },
      { member: 'most_energy_exposed', field: 'outputGapOffset', magnitude: -0.8 },
      { member: 'most_industrial', field: 'inflationOffset', magnitude: 1.6 },
      { member: 'most_industrial', field: 'outputGapOffset', magnitude: -0.6 },
    ],
    delayed: () => [
      {
        delaySteps: THREE_MEETINGS,
        effects: [{ variable: 'supplyShock', delta: -0.5 }],
      },
    ],
    followUps: ['industrial_export_slump', 'gas_supply_restored'],
    requires: [],
  },
  {
    id: 'gas_supply_restored',
    shockCharacter: 'supply',
    family: 'energy_commodity',
    title: 'Import route reopens and national gas prices retrace',
    newswire:
      'Deliveries have resumed through the interrupted route, and alternative ' +
      'terminal capacity commissioned in the meantime has left the most exposed ' +
      'members better supplied than before. National price differentials across ' +
      'the area have narrowed sharply.',
    clue: null,
    institutions: ['ecb'],
    minDifficulty: 'medium',
    baseWeight: 0.85,
    cooldownMeetings: 5,
    maxOccurrences: 2,
    // The counterpart, and paired with the interruption term for term. The
    // catalog's standing rule is that no event writes the inflation outcome by
    // itself: an asymmetric impulse with no mirror is a one-sided inflation
    // tax that `events/balance.test.ts` catches in the aggregate — which is
    // exactly how this one was found, at 0.086 of net impulse per meeting
    // against a band of 0.08.
    //
    // Free to fire rather than gated on an interruption having happened. Good
    // news that needs permission is good news the player will rarely meet, and
    // the same mistake once left `energy_price_relief` landing six times
    // against the spike's sixty-two.
    isEligible: () => true,
    weight: (ctx) =>
      (0.7 + Math.max(0, 50 - ctx.latent.geopoliticalRisk) / 60) *
      whenContained(
    ctx,
    'gas_supply_interruption',
    'industrial_export_slump',
    ctx.latent.outputGap >= -0.5,
  ),
    immediate: () => [{ variable: 'supplyShock', delta: -0.5 }],
    memberEffects: () => [
      { member: 'most_energy_exposed', field: 'inflationOffset', magnitude: -2.4 },
      { member: 'most_energy_exposed', field: 'outputGapOffset', magnitude: 0.8 },
      { member: 'most_industrial', field: 'inflationOffset', magnitude: -1.6 },
      { member: 'most_industrial', field: 'outputGapOffset', magnitude: 0.6 },
    ],
    delayed: () => [
      {
        delaySteps: THREE_MEETINGS,
        effects: [{ variable: 'supplyShock', delta: 0.5 }],
      },
    ],
    followUps: [],
    requires: [],
  },
  {
    id: 'regional_labour_shock',
    shockCharacter: 'demand',
    family: 'labour',
    title: 'Construction and tourism employment falls in one member',
    newswire:
      'A sharp contraction in construction and seasonal services has pushed ' +
      'unemployment up in the member whose labour market moves most over the ' +
      'cycle. Area-wide employment is close to unchanged.',
    clue: null,
    institutions: ['ecb'],
    minDifficulty: 'medium',
    baseWeight: 0.75,
    cooldownMeetings: 5,
    maxOccurrences: 2,
    isEligible: () => true,
    weight: (ctx) => 0.7 + Math.max(0, ctx.latent.policyRate - 2) / 4,
    immediate: () => [],
    memberEffects: () => [
      { member: 'most_cyclical', field: 'unemploymentOffset', magnitude: 3.0 },
      { member: 'most_cyclical', field: 'outputGapOffset', magnitude: -1.8 },
      { member: 'most_cyclical', field: 'inflationOffset', magnitude: -0.8 },
    ],
    delayed: () => [],
    followUps: [],
    requires: [],
  },
  {
    id: 'industrial_export_slump',
    shockCharacter: 'demand',
    family: 'innovation',
    title: 'External demand for capital goods falls away',
    newswire:
      'Order books at machinery and vehicle manufacturers have thinned as ' +
      'export markets slow. The effect is concentrated in the area\'s ' +
      'industrial core; service-led members report little change.',
    clue: null,
    institutions: ['ecb'],
    minDifficulty: 'medium',
    baseWeight: 0.8,
    cooldownMeetings: 5,
    maxOccurrences: 2,
    // The second act of a gas interruption that was not absorbed. The
    // industrial core ran on that gas, so this is reachable only while the
    // area is actually contracting: a committee that held output up does
    // not meet it.
    isEligible: (ctx) => ctx.latent.outputGap < -0.5,
    weight: (ctx) => 0.7 + Math.max(0, -ctx.latent.outputGap) / 3,
    immediate: () => [{ variable: 'confidenceShock', delta: -0.4 }],
    memberEffects: () => [
      { member: 'most_industrial', field: 'outputGapOffset', magnitude: -2.4 },
      { member: 'most_industrial', field: 'unemploymentOffset', magnitude: 1.1 },
      { member: 'most_industrial', field: 'inflationOffset', magnitude: -0.9 },
    ],
    delayed: () => [
      {
        delaySteps: FOUR_MEETINGS,
        effects: [{ variable: 'confidenceShock', delta: 0.4 }],
      },
    ],
    followUps: [],
    requires: ['gas_supply_interruption'],
  },
  {
    id: 'convergence_upswing',
    shockCharacter: 'demand',
    family: 'innovation',
    title: 'Investment flows narrow the gap between members',
    newswire:
      'Cross-border investment into the area\'s smaller and higher-yielding ' +
      'economies has picked up sharply, lifting activity where it had been ' +
      'weakest and narrowing the dispersion across the area.',
    clue: null,
    institutions: ['ecb'],
    minDifficulty: 'medium',
    baseWeight: 0.8,
    cooldownMeetings: 5,
    maxOccurrences: 2,
    isEligible: () => true,
    // The counterpart the asymmetric family needs. Without it the area could
    // only ever come apart: every asymmetric event would widen dispersion,
    // convergence would be a slow decay and nothing else, and cohesion would
    // be a score that only falls. Convergence happens, and it happens for the
    // ordinary reason — capital goes where returns are higher.
    weight: (ctx) => 0.6 + Math.max(0, 60 - ctx.latent.fragmentation) / 60,
    immediate: () => [{ variable: 'confidenceShock', delta: 0.3 }],
    memberEffects: () => [
      { member: 'most_cyclical', field: 'unemploymentOffset', magnitude: -2.2 },
      { member: 'most_cyclical', field: 'outputGapOffset', magnitude: 1.2 },
      { member: 'most_indebted', field: 'spread', magnitude: -110 },
      { member: 'most_indebted', field: 'outputGapOffset', magnitude: 0.8 },
    ],
    delayed: () => [],
    followUps: [],
    requires: [],
  },
]

export const EVENTS_BY_ID = new Map<string, GameEvent>(
  EVENT_CATALOG.map((event) => [event.id, event]),
)

/** True when a catalog event id names a mandate-defining major crisis. */
export function isMajorEvent(eventId: string): boolean {
  return EVENTS_BY_ID.get(eventId)?.tier === 'major'
}
