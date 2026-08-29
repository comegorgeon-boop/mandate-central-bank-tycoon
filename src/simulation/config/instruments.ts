import type { Difficulty, Institution } from '../types/core.ts'
import type {
  InstrumentDefinition,
  InstrumentId,
  InstrumentRange,
} from '../types/policy.ts'
import { meetsDifficulty } from './difficulty.ts'

/**
 * The institution-specific policy toolkit.
 *
 * Instrument definitions live here rather than in UI components, so adding a
 * tool never means editing a screen. Availability widens with difficulty:
 * easy mode is essentially the policy rate, medium adds the balance sheet and
 * basic guidance, hard opens the full toolkit.
 *
 * Nothing here implies that every tool is equally active in current
 * real-world practice; this is a fictional simulation of the institutional
 * setting.
 */

/**
 * Effective lower bound on the nominal policy rate.
 *
 * Actions that would push the rate below this are rejected outright.
 */
export const POLICY_RATE_FLOOR: Readonly<Record<Institution, number>> = {
  fed: 0,
  ecb: -0.75,
}

const BOTH: readonly Institution[] = ['fed', 'ecb']

export const INSTRUMENTS: readonly InstrumentDefinition[] = [
  // ---- Shared ------------------------------------------------------------
  {
    id: 'policy_rate',
    unit: 'basis_points',
    min: -150,
    max: 150,
    increment: 25,
    availableTo: BOTH,
    availableFrom: 'easy',
    // Easy mode keeps the choice simple; hard mode allows emergency moves.
    rangeByDifficulty: {
      easy: { min: -100, max: 100, increment: 25 },
      hard: { min: -200, max: 200, increment: 25 },
    },
    channels: ['interest_rate', 'credit', 'exchange_rate', 'expectations'],
    lagMeetings: [3, 8],
    label: {
      fed: 'Federal funds target range',
      ecb: 'Main refinancing rate',
    },
    description:
      'Moves the policy rate, which reprices the whole curve and works ' +
      'through borrowing costs, the exchange rate and expectations.',
  },
  {
    id: 'asset_purchases',
    unit: 'percent_of_gdp',
    min: 0,
    max: 8,
    increment: 0.5,
    availableTo: BOTH,
    availableFrom: 'medium',
    channels: ['asset_prices', 'credit', 'bank_liquidity', 'sovereign_spreads'],
    lagMeetings: [1, 5],
    label: {
      fed: 'Securities purchases',
      ecb: 'Asset purchase programme',
    },
    description:
      'Buys securities at an annualised pace, adding reserves and ' +
      'compressing term premia. Far more powerful when markets are ' +
      'dysfunctional than when valuations are already stretched.',
  },
  {
    id: 'balance_sheet_runoff',
    unit: 'percent_of_gdp',
    min: 0,
    max: 6,
    increment: 0.5,
    availableTo: BOTH,
    availableFrom: 'medium',
    channels: ['asset_prices', 'bank_liquidity', 'sovereign_spreads'],
    lagMeetings: [2, 6],
    label: {
      fed: 'Balance sheet runoff',
      ecb: 'Reinvestment reduction',
    },
    description:
      'Lets maturing holdings roll off at an annualised pace, draining ' +
      'reserves and steepening the curve. Amplifies stress when the system ' +
      'is already fragile.',
  },
  {
    id: 'forward_guidance',
    unit: 'basis_points',
    min: -200,
    max: 200,
    increment: 25,
    availableTo: BOTH,
    availableFrom: 'medium',
    channels: ['expectations', 'interest_rate'],
    lagMeetings: [0, 3],
    label: {
      fed: 'Forward guidance',
      ecb: 'Forward guidance',
    },
    description:
      'Signals the policy rate expected roughly a year out. Its force ' +
      'depends on credibility and on the commitment strength chosen in the ' +
      'communication package.',
  },

  // ---- Federal Reserve ---------------------------------------------------
  {
    id: 'iorb_spread',
    unit: 'basis_points',
    min: -15,
    max: 15,
    increment: 5,
    availableTo: ['fed'],
    availableFrom: 'hard',
    channels: ['interest_rate', 'bank_liquidity'],
    lagMeetings: [0, 2],
    label: { fed: 'Interest on reserve balances', ecb: 'Not applicable' },
    description:
      'Adjusts the administered rate relative to the target range midpoint ' +
      'to steer where the effective rate prints inside the range.',
  },
  {
    id: 'discount_window',
    unit: 'ordinal',
    min: 0,
    max: 3,
    increment: 1,
    availableTo: ['fed'],
    availableFrom: 'medium',
    channels: ['bank_liquidity', 'credit'],
    lagMeetings: [0, 2],
    label: { fed: 'Discount window and standing facilities', ecb: 'Not applicable' },
    description:
      'Escalates emergency liquidity from standard terms to a full backstop. ' +
      'Relieves banking stress quickly, but signalling it when no stress ' +
      'exists unsettles markets.',
  },
  {
    id: 'reverse_repo',
    unit: 'ordinal',
    min: 0,
    max: 3,
    increment: 1,
    availableTo: ['fed'],
    availableFrom: 'hard',
    channels: ['bank_liquidity', 'interest_rate'],
    lagMeetings: [0, 1],
    label: { fed: 'Reverse repo operations', ecb: 'Not applicable' },
    description:
      'Absorbs excess reserves to keep short rates inside the target range.',
  },
  {
    id: 'swap_lines',
    unit: 'ordinal',
    min: 0,
    max: 2,
    increment: 1,
    availableTo: ['fed'],
    availableFrom: 'hard',
    channels: ['bank_liquidity', 'exchange_rate'],
    lagMeetings: [0, 2],
    label: { fed: 'Liquidity swap lines', ecb: 'Not applicable' },
    description:
      'Backstops offshore funding markets during a dollar squeeze, easing ' +
      'volatility and currency pressure.',
  },

  // ---- European Central Bank ---------------------------------------------
  {
    id: 'deposit_facility_spread',
    unit: 'basis_points',
    min: -50,
    max: 0,
    increment: 5,
    availableTo: ['ecb'],
    availableFrom: 'hard',
    channels: ['interest_rate', 'bank_liquidity'],
    lagMeetings: [0, 2],
    label: { fed: 'Not applicable', ecb: 'Deposit facility spread' },
    description:
      'Sets the floor of the operating corridor relative to the main ' +
      'refinancing rate, steering where money-market rates settle.',
  },
  {
    id: 'minimum_reserves',
    unit: 'percent_of_gdp',
    min: 0,
    max: 4,
    increment: 0.5,
    availableTo: ['ecb'],
    availableFrom: 'hard',
    channels: ['bank_liquidity', 'credit'],
    lagMeetings: [1, 4],
    label: { fed: 'Not applicable', ecb: 'Minimum reserve requirement' },
    description:
      'Raises the reserves banks must hold, tightening bank funding and ' +
      'slowing credit creation.',
  },
  {
    id: 'targeted_refinancing',
    unit: 'percent_of_gdp',
    min: 0,
    max: 6,
    increment: 0.5,
    availableTo: ['ecb'],
    availableFrom: 'medium',
    channels: ['bank_liquidity', 'credit'],
    lagMeetings: [1, 4],
    label: { fed: 'Not applicable', ecb: 'Targeted refinancing operations' },
    description:
      'Lends to banks against lending performance, supporting credit supply ' +
      'where transmission is weakest.',
  },
  {
    id: 'transmission_protection',
    unit: 'ordinal',
    min: 0,
    max: 3,
    increment: 1,
    availableTo: ['ecb'],
    availableFrom: 'hard',
    channels: ['sovereign_spreads', 'credit'],
    lagMeetings: [0, 2],
    label: { fed: 'Not applicable', ecb: 'Transmission protection' },
    description:
      'Counters disorderly sovereign spread widening so the policy rate ' +
      'still reaches the whole currency area. Restores transmission, but ' +
      'invites political scrutiny.',
  },
]

const INSTRUMENT_BY_ID = new Map<InstrumentId, InstrumentDefinition>(
  INSTRUMENTS.map((instrument) => [instrument.id, instrument]),
)

export function getInstrument(id: InstrumentId): InstrumentDefinition | undefined {
  return INSTRUMENT_BY_ID.get(id)
}

/** The allowed range for one instrument at one difficulty. */
export function getInstrumentRange(
  instrument: InstrumentDefinition,
  difficulty: Difficulty,
): InstrumentRange {
  return (
    instrument.rangeByDifficulty?.[difficulty] ?? {
      min: instrument.min,
      max: instrument.max,
      increment: instrument.increment,
    }
  )
}

/** Instruments the player can actually reach in this run. */
export function availableInstruments(
  institution: Institution,
  difficulty: Difficulty,
): readonly InstrumentDefinition[] {
  return INSTRUMENTS.filter(
    (instrument) =>
      instrument.availableTo.includes(institution) &&
      meetsDifficulty(difficulty, instrument.availableFrom),
  )
}

/**
 * How strongly each instrument moves the economy.
 *
 * Kept next to the definitions so a balance pass touches one file. Values are
 * per unit of the instrument's own magnitude unit.
 */
export const INSTRUMENT_EFFECTS = {
  assetPurchases: {
    /** Percentage points of spread compression per % of GDP per year. */
    spreadCompression: 0.09,
    termCompression: 0.07,
    /** Banking stress relieved per % of GDP per year. */
    stressRelief: 2.2,
    /** Valuation pressure added per % of GDP per year, before state scaling. */
    assetPressure: 1.1,
    /** ECB sovereign spread compression, basis points. */
    fragmentationRelief: 22,
  },
  runoff: {
    spreadWidening: 0.07,
    termWidening: 0.08,
    /** Extra stress per % of GDP per year, amplified when already fragile. */
    stressAdded: 1.6,
    fragmentationAdded: 18,
  },
  discountWindow: {
    /** Per ordinal step. */
    stressRelief: 7.5,
    regionalRelief: 9.0,
    /** Volatility added when escalated with no stress to justify it. */
    unjustifiedVolatility: 4.0,
  },
  reverseRepo: {
    /** Basis points the effective rate is pulled toward the range midpoint. */
    ratePull: 4.0,
    reservesDrain: 3.0,
  },
  swapLines: {
    volatilityRelief: 6.0,
    exchangeRateRelief: 2.5,
  },
  iorbSpread: {
    /** Percentage points of effective rate per basis point of spread. */
    effectiveRatePerBp: 0.008,
  },
  depositFacility: {
    /** Percentage points of effective rate per basis point of spread. */
    effectiveRatePerBp: 0.006,
  },
  minimumReserves: {
    creditTightening: 0.55,
    spreadWidening: 0.04,
  },
  targetedRefinancing: {
    creditSupport: 0.7,
    stressRelief: 1.8,
    fragmentationRelief: 14,
  },
  transmissionProtection: {
    /** Basis points of fragmentation compression per ordinal step. */
    fragmentationRelief: 95,
    /** Political pressure added per ordinal step. */
    politicalCost: 3.5,
  },
} as const
