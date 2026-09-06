import type { Difficulty, Institution } from '../types/core.ts'
import type {
  CommunicationChannel,
  CommunicationCommitment,
  InstrumentDefinition,
  InstrumentId,
  InstrumentRange,
  PolicyStance,
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
    purpose:
      'The main lever. Raising it makes borrowing dearer everywhere, ' +
      'which cools spending and, some quarters later, inflation. ' +
      'Cutting it does the reverse.',
    rangeNote:
      'Moves of 25 bp are routine; 50 bp is a deliberate signal; ' +
      'anything larger tells markets you were behind and are catching ' +
      'up.',
    abuseRisk:
      'Tighten too far and unemployment rises for years before ' +
      'inflation falls any further. Cut into an economy already ' +
      'running hot and expectations come loose, which costs far more ' +
      'to repair than the cut ever bought.',
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
    purpose:
      'Buys bonds with newly created reserves, pushing down long-term ' +
      'borrowing costs that the policy rate alone is not reaching.',
    rangeNote:
      'An annual pace: 2.0 means buying 2 % of a year\'s GDP over the ' +
      'coming year. Under 1 % is routine reinvestment; 3-5 % is a ' +
      'crisis programme; above that has no peacetime precedent.',
    plausibleMax: 5,
    abuseRisk:
      'Buying into a market that is already working lifts asset ' +
      'prices without reaching the real economy, and every bond ' +
      'bought has to be unwound later on someone\'s watch.',
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
    purpose:
      'The mirror of purchases: lets bonds already held mature ' +
      'without replacing them, draining money from the system and ' +
      'letting long rates drift up.',
    rangeNote:
      'An annual pace. 1-2 % of GDP a year is how a large balance ' +
      'sheet is normally reduced. Above 4 % you are draining reserves ' +
      'faster than banks can comfortably replace them.',
    plausibleMax: 4,
    abuseRisk:
      'Runoff into a fragile banking system is how a funding squeeze ' +
      'begins. It is slow to help, quick to hurt, and cannot be ' +
      'reversed in a hurry.',
  },
  {
    id: 'forward_guidance',
    unit: 'basis_points',
    min: -200,
    max: 200,
    increment: 25,
    availableTo: BOTH,
    // From easy, deliberately: the phase-3 playthroughs found a one-instrument
    // game with nothing to decide, and guidance is the second axis — what you
    // say about the path, against what you do to the rate. It also acts on
    // expectations directly, on a much shorter lag than the rate channel, so
    // easy without it is the mode where the only working instrument is the
    // slowest one. See docs/DIRECTION.md.
    availableFrom: 'easy',
    rangeByDifficulty: {
      easy: { min: -100, max: 100, increment: 25 },
    },
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
    purpose:
      'Says where you expect the rate to be about a year out. It ' +
      'moves expectations today, without waiting for the rate itself ' +
      'to move.',
    rangeNote:
      'A distance from the rate you are setting now: +100 bp signals ' +
      'a rate a point higher a year out. Beyond about 150 bp the ' +
      'signal is only credible if the economy plainly justifies it.',
    plausibleMax: 150,
    abuseRisk:
      'Guidance you do not deliver is a broken promise and is priced ' +
      'as one. Markets discount the next signal, and the instrument ' +
      'stops working at the point you most need it.',
  },

  // ---- Federal Reserve ---------------------------------------------------
  {
    id: 'iorb_spread',
    unit: 'basis_points',
    min: -15,
    max: 15,
    increment: 5,
    availableTo: ['fed'],
    availableFrom: 'medium',
    channels: ['interest_rate', 'bank_liquidity'],
    lagMeetings: [0, 2],
    label: { fed: 'Interest on reserve balances', ecb: 'Not applicable' },
    description:
      'Adjusts the administered rate relative to the target range midpoint ' +
      'to steer where the effective rate prints inside the range.',
    purpose:
      'Fine-tunes where the market rate actually settles inside the ' +
      'range you voted, by changing what banks earn on cash parked at ' +
      'the Fed.',
    rangeNote:
      'Plumbing, not policy: 5 to 10 bp either side of the midpoint ' +
      'is the whole useful range, and none of it substitutes for a ' +
      'rate decision.',
    abuseRisk:
      'Pushed far enough it detaches the effective rate from the ' +
      'range you announced, which makes the headline decision look ' +
      'like it did not mean what it said.',
  },
  {
    id: 'discount_window',
    unit: 'ordinal',
    min: 0,
    max: 3,
    increment: 1,
    availableTo: ['fed'],
    availableFrom: 'hard',
    channels: ['bank_liquidity', 'credit'],
    lagMeetings: [0, 2],
    label: { fed: 'Discount window and standing facilities', ecb: 'Not applicable' },
    description:
      'Escalates emergency liquidity from standard terms to a full backstop. ' +
      'Relieves banking stress quickly, but signalling it when no stress ' +
      'exists unsettles markets.',
    purpose:
      'Emergency lending to banks that cannot fund themselves ' +
      'anywhere else. It stops a liquidity problem from becoming a ' +
      'solvency one.',
    rangeNote:
      'Four positions, from standard terms to a full backstop. ' +
      'Anything above standard terms is a public statement that you ' +
      'believe something is wrong.',
    abuseRisk:
      'Opening the window when nothing is broken tells markets you ' +
      'know something they do not, and they will go looking for it. ' +
      'Left open indefinitely, it lets weak banks avoid repairing ' +
      'themselves.',
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
    purpose:
      'Drains surplus cash out of overnight money markets, stopping ' +
      'short rates from falling through the floor of your target ' +
      'range.',
    rangeNote:
      'Four positions. How much is actually drained is set by demand; ' +
      'what you set is how freely the facility is offered.',
    abuseRisk:
      'A large standing facility pulls cash out of private money ' +
      'markets, which then thin out. It is a floor under rates, never ' +
      'a policy stance.',
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
    purpose:
      'Lends dollars to other central banks so that banks abroad who ' +
      'owe dollars can find them without selling assets into a ' +
      'falling market to do it.',
    rangeNote:
      'Three positions: closed, standing with the usual ' +
      'counterparties, or widened to more of them.',
    abuseRisk:
      'Standing dollar lines are subsidised insurance for borrowers ' +
      'you do not supervise, and they are expensive to justify at ' +
      'home when nothing is on fire.',
  },

  // ---- European Central Bank ---------------------------------------------
  {
    id: 'deposit_facility_spread',
    unit: 'basis_points',
    min: -50,
    max: 0,
    increment: 5,
    availableTo: ['ecb'],
    availableFrom: 'medium',
    channels: ['interest_rate', 'bank_liquidity'],
    lagMeetings: [0, 2],
    label: { fed: 'Not applicable', ecb: 'Deposit facility spread' },
    description:
      'Sets the floor of the operating corridor relative to the main ' +
      'refinancing rate, steering where money-market rates settle.',
    purpose:
      'Sets how much less banks earn on cash left overnight at the ' +
      'ECB than the main rate. It is what decides where money-market ' +
      'rates actually settle.',
    rangeNote:
      '0 to 50 bp below the main refinancing rate. A corridor of 25 ' +
      'to 40 bp is normal; at zero the two rates coincide and the ' +
      'corridor steers nothing at all.',
    abuseRisk:
      'A very wide corridor lets overnight rates wander, which is the ' +
      'opposite of what an operating framework exists to do.',
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
    purpose:
      'Requires banks to park a share of their deposits at the ECB, ' +
      'where it cannot be lent. Raising it tightens credit without ' +
      'touching the policy rate.',
    rangeNote:
      'Historically 1-2 %. Above 3 % is a blunt tightening of bank ' +
      'funding that no modern euro-area framework has used.',
    plausibleMax: 2,
    abuseRisk:
      'It is a tax on banks. Raised in a downturn, credit contracts ' +
      'exactly when the economy needs it, and you cannot choose where ' +
      'the pain lands.',
  },
  {
    id: 'targeted_refinancing',
    unit: 'percent_of_gdp',
    min: 0,
    max: 6,
    increment: 0.5,
    availableTo: ['ecb'],
    availableFrom: 'hard',
    channels: ['bank_liquidity', 'credit'],
    lagMeetings: [1, 4],
    label: { fed: 'Not applicable', ecb: 'Targeted refinancing operations' },
    description:
      'Lends to banks against lending performance, supporting credit supply ' +
      'where transmission is weakest.',
    purpose:
      'Lends to banks cheaply on condition they lend it on to firms ' +
      'and households. It is for when a rate cut is not reaching the ' +
      'real economy.',
    rangeNote:
      'An annual pace of new lending, in % of GDP. 1-3 % is a ' +
      'substantial programme; the largest euro-area operations were ' +
      'about that size.',
    plausibleMax: 3,
    abuseRisk:
      'Cheap funding banks can keep without lending is a subsidy. And ' +
      'when the terms expire, everything borrowed comes due at once, ' +
      'which is a funding shock of your own making.',
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
    purpose:
      'Buys the bonds of a member state whose borrowing costs are ' +
      'climbing for reasons unconnected to its own economy, so that ' +
      'one policy rate still means one policy rate across the area.',
    rangeNote:
      'Four positions, from off to fully active. Conditional by ' +
      'design: it exists for disorderly market dynamics, not for a ' +
      'government\'s own budget choices.',
    abuseRisk:
      'Used to hold down the yields of a country whose problem is its ' +
      'own borrowing, it becomes financing for that government - ' +
      'which the treaties forbid and which markets will test.',
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
 * Where each instrument's standing level lives in the stance.
 *
 * `policy_rate` and `forward_guidance` are deliberately absent: both are
 * expressed as a *change* rather than a level — the rate moves from where it
 * is, and guidance is recorded in `GuidanceState` rather than in the stance at
 * all — so neither has a "current level" a control could read back.
 *
 * Kept beside the definitions rather than in a desk component, so that opening
 * an instrument to a difficulty stays a change to this file and to
 * `deriveStance`, and never to a screen.
 */
const STANCE_FIELD: Readonly<Partial<Record<InstrumentId, keyof PolicyStance>>> = {
  asset_purchases: 'assetPurchasePace',
  balance_sheet_runoff: 'runoffPace',
  iorb_spread: 'iorbSpread',
  discount_window: 'discountWindowLevel',
  reverse_repo: 'reverseRepoLevel',
  swap_lines: 'swapLinesLevel',
  deposit_facility_spread: 'depositFacilitySpread',
  minimum_reserves: 'minimumReserves',
  targeted_refinancing: 'targetedRefinancing',
  transmission_protection: 'transmissionProtection',
}

/** The level an instrument currently stands at, or null if it sets no level. */
export function standingLevel(
  stance: PolicyStance,
  instrument: InstrumentId,
): number | null {
  const field = STANCE_FIELD[instrument]
  return field === undefined ? null : stance[field]
}

/** True when this instrument sets a standing level rather than a change. */
export function setsStandingLevel(instrument: InstrumentId): boolean {
  return STANCE_FIELD[instrument] !== undefined
}

/**
 * Which communication choices are open at each difficulty.
 *
 * Easy keeps the *surface* simple — one channel, and the tone derived from the
 * decision rather than chosen — but the commitment ladder reaches the first
 * binding rung. Without `conditional_path` a commitment is never a promise,
 * promises can never be kept or broken, and the whole credibility mechanic is
 * unreachable: the second instrument would be a label, not a lever. The
 * strongest commitment, and the freedom to say one thing while doing another,
 * stay where consistency is a real constraint.
 */
export const COMMUNICATION_AVAILABILITY: Readonly<
  Record<
    Difficulty,
    {
      readonly channels: readonly CommunicationChannel[]
      readonly commitments: readonly CommunicationCommitment[]
    }
  >
> = {
  easy: {
    channels: ['statement'],
    commitments: ['none', 'weak_bias', 'conditional_path'],
  },
  medium: {
    channels: ['statement', 'press_conference'],
    commitments: ['none', 'weak_bias', 'conditional_path'],
  },
  hard: {
    channels: ['statement', 'press_conference', 'speech', 'social_post'],
    commitments: ['none', 'weak_bias', 'conditional_path', 'strong_commitment'],
  },
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
