import type { GameEvent } from '../types/events.ts'
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

export const EVENT_CATALOG: readonly GameEvent[] = [
  // ---- Energy and commodities --------------------------------------------
  {
    id: 'energy_price_spike',
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
    followUps: [],
    requires: [],
  },
  {
    id: 'energy_price_relief',
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
    weight: (ctx) => 0.75 + Math.max(0, ctx.latent.supplyShock) / 2,
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
    followUps: [],
    requires: [],
  },
  {
    id: 'supply_chain_normalisation',
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
    weight: (ctx) => 0.9 + Math.max(0, ctx.latent.supplyShock) / 2,
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
    followUps: [],
    requires: [],
  },
  {
    id: 'fiscal_consolidation',
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
    weight: (ctx) => 0.6 + Math.max(0, ctx.latent.debtPressure - 35) / 30,
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
    followUps: [],
    requires: ['bank_funding_scare'],
  },

  // ---- Housing ------------------------------------------------------------
  {
    id: 'housing_correction',
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
    followUps: [],
    requires: [],
  },

  // ---- Geopolitics --------------------------------------------------------
  {
    id: 'geopolitical_escalation',
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
    followUps: [],
    requires: [],
  },
  {
    id: 'geopolitical_dealescalation',
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
    weight: (ctx) => 0.6 + ctx.latent.geopoliticalRisk / 70,
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
    delayed: (ctx) => [
      {
        delaySteps: ONE_MEETING,
        effects: [
          { variable: 'inflationHeadline', delta: ctx.institution === 'ecb' ? 0.35 : 0.15 },
        ],
      },
      { delaySteps: THREE_MEETINGS, effects: [{ variable: 'outputGap', delta: 0.2 }] },
    ],
    followUps: [],
    requires: [],
  },
  {
    id: 'currency_appreciation',
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
      (ctx.institution === 'ecb' ? 1.4 : 0.9) +
      Math.max(0, VOLATILITY.base - ctx.latent.marketVolatility) / 40,
    immediate: (ctx) => [
      { variable: 'exchangeRate', delta: 7 },
      { variable: 'importPriceInflation', delta: ctx.institution === 'ecb' ? -6 : -3.5 },
      { variable: 'marketVolatility', delta: -3 },
    ],
    delayed: (ctx) => [
      {
        delaySteps: ONE_MEETING,
        effects: [
          { variable: 'inflationHeadline', delta: ctx.institution === 'ecb' ? -0.35 : -0.15 },
        ],
      },
      { delaySteps: THREE_MEETINGS, effects: [{ variable: 'outputGap', delta: -0.2 }] },
    ],
    followUps: [],
    requires: [],
  },

  // ---- Wages --------------------------------------------------------------
  {
    id: 'wage_round_breakout',
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
    followUps: [],
    requires: [],
  },

  // ---- Data revisions -----------------------------------------------------
  {
    id: 'benchmark_revision',
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
    immediate: () => [
      { variable: 'credibility', delta: -4 },
      { variable: 'marketTrust', delta: -7 },
      { variable: 'marketVolatility', delta: 6 },
      { variable: 'politicalPressure', delta: 6 },
    ],
    delayed: () => [],
    followUps: [],
    requires: [],
  },

  // ---- Market cycle -------------------------------------------------------
  {
    id: 'market_melt_up',
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
    followUps: [],
    requires: ['market_melt_up'],
  },

  // ---- Natural disasters --------------------------------------------------
  {
    id: 'natural_disaster',
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

  // ---- Innovation and confidence ------------------------------------------
  {
    id: 'investment_boom',
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
  // Mandate-defining crises rather than background noise: `tier: 'major'`,
  // scoped to `minDifficulty`/`maxDifficulty` 'easy' only (medium/hard are out
  // of scope for this batch — their catalog and balance stay untouched, since
  // `eligibleEvents` filters these out entirely once `ctx.difficulty` is above
  // the ceiling). Rare (`baseWeight` well under the minors' 0.7-1.2) and
  // singular (`maxOccurrences: 1`) as *random* draws — one of them also fires
  // unconditionally at the first meeting of every easy mandate, via
  // `events/openingCrisis.ts`, which is not gated by weight or probability at
  // all. Each carries a real multi-sentence `newswire` and 2-3 `dispatchLines`
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
    maxDifficulty: 'easy',
    tier: 'major',
    baseWeight: 0.15,
    cooldownMeetings: 8,
    maxOccurrences: 1,
    isEligible: () => true,
    weight: (ctx) => 0.5 + ctx.latent.geopoliticalRisk / 60,
    immediate: (ctx) => [
      { variable: 'geopoliticalRisk', delta: 55 },
      { variable: 'marketVolatility', delta: 22 },
      { variable: 'supplyShock', delta: 4.0 },
      { variable: 'importPriceInflation', delta: 10 * (ctx.institution === 'ecb' ? 1.3 : 1) },
      { variable: 'confidenceShock', delta: -2.2 },
    ],
    delayed: () => [
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
      {
        delaySteps: THREE_MEETINGS,
        effects: [
          { variable: 'supplyShock', delta: -3.6 },
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
    maxDifficulty: 'easy',
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
    ],
    delayed: () => [
      // A first attempt at forming a government fails.
      {
        delaySteps: ONE_MEETING,
        effects: [
          { variable: 'politicalPressure', delta: 16 },
          { variable: 'marketVolatility', delta: 9 },
        ],
      },
      // An interim arrangement holds. The institution is not out of the
      // spotlight, but the immediate threat to it has receded.
      {
        delaySteps: THREE_MEETINGS,
        effects: [
          { variable: 'politicalPressure', delta: -30 },
          { variable: 'marketTrust', delta: 8 },
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
    maxDifficulty: 'easy',
    tier: 'major',
    baseWeight: 0.15,
    cooldownMeetings: 8,
    maxOccurrences: 1,
    // Unlike `bank_funding_scare`, this does not require prior fragility: a
    // single failure can strike a genuinely healthy system without warning.
    isEligible: () => true,
    weight: (ctx) => 0.8 + Math.max(0, ctx.latent.bankingStress - BANKING.base) / 40,
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
    maxDifficulty: 'easy',
    tier: 'major',
    baseWeight: 0.15,
    cooldownMeetings: 8,
    maxOccurrences: 1,
    // Unlike `housing_correction`, this does not require a prior run-up: the
    // floor below is large enough to strike a fairly valued market too.
    isEligible: () => true,
    weight: (ctx) => 0.7 + Math.max(0, ctx.latent.assetPricePressure) / 40,
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
    maxDifficulty: 'easy',
    tier: 'major',
    baseWeight: 0.15,
    cooldownMeetings: 8,
    maxOccurrences: 1,
    isEligible: () => true,
    weight: (ctx) => 0.6 + ctx.latent.geopoliticalRisk / 70,
    immediate: (ctx) => [
      { variable: 'supplyShock', delta: 4.0 },
      { variable: 'importPriceInflation', delta: 10 * (ctx.institution === 'ecb' ? 1.3 : 1) },
    ],
    delayed: () => [
      { delaySteps: ONE_MEETING, effects: [{ variable: 'supplyShock', delta: 1.6 }] },
      // Alternate suppliers ramp up, at a lasting premium to the old price.
      { delaySteps: THREE_MEETINGS, effects: [{ variable: 'supplyShock', delta: -3.6 }] },
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
    maxDifficulty: 'easy',
    tier: 'major',
    baseWeight: 0.15,
    cooldownMeetings: 8,
    maxOccurrences: 1,
    isEligible: () => true,
    weight: (ctx) => 0.5 + Math.max(0, ctx.latent.marketVolatility - VOLATILITY.base) / 40,
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
]

export const EVENTS_BY_ID = new Map<string, GameEvent>(
  EVENT_CATALOG.map((event) => [event.id, event]),
)
