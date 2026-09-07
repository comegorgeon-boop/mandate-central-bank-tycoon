/**
 * The currency area is not one economy.
 *
 * A single policy rate is set for members whose inflation, unemployment and
 * borrowing costs differ, sometimes by more than the rate itself can bridge.
 * That is the ECB's actual problem and the thing that makes it a different
 * game from the Fed's; until this file existed the euro area was modelled as
 * one homogeneous block with a scalar "fragmentation" number attached, which
 * is the problem's shadow rather than the problem.
 *
 * ## What is real here and what is not
 *
 * The **countries are real** and so are their *structural* characteristics —
 * economic size, government debt relative to the area, how much of the economy
 * is manufacturing, how exposed it is to imported energy, how sharply
 * unemployment moves over the cycle. Those are properties of an economy that
 * belong in a model of it.
 *
 * The **starting positions are invented**. They are chosen to make an
 * interesting opening — a spread of inflation and unemployment wide enough for
 * the single-rate problem to bite — and are not a reading of any actual
 * moment. Nothing in this build is a forecast, a commentary, or a claim about
 * the present.
 *
 * Three lines that are not negotiable, and the reasons:
 *
 *   - **No real person is named anywhere**, and no dispatch is attributed to
 *     any office-holder, living or otherwise. Governments appear as
 *     governments.
 *   - **Characterisation is strictly economic.** Debt ratios, industrial
 *     shares, energy import dependence, labour-market cyclicality. There is
 *     nothing here about a country's people, culture, politics or character,
 *     and there must never be: those are not economic variables, and a game
 *     that assigned them would be doing something other than macroeconomics.
 *   - **The interface says it is a simulation**, on the panel where these
 *     numbers appear, in plain words.
 *
 * ## How the numbers work
 *
 * Every loading is expressed *relative to the area average*, where 1.00 is
 * average. That keeps this file a statement about structure rather than a
 * second set of levels that could silently disagree with the aggregate the
 * rest of the engine integrates: the area-wide economy stays exactly what it
 * was, and members are dispersion around it. See `engine/members.ts` for the
 * invariant that makes that identity hold.
 */

export type MemberId = 'de' | 'fr' | 'it' | 'es' | 'nl' | 'rest'

export interface MemberProfile {
  readonly id: MemberId
  readonly name: string
  /** Short label for narrow columns and chart axes. */
  readonly short: string
  /**
   * Definite article, where the name takes one in running prose.
   *
   * "Inflation runs at 1.4 % in Netherlands" is wrong, and a sentence the
   * interface builds from a name it does not know how to inflect will be wrong
   * every time it is built. Empty for names that take none.
   */
  readonly article: string
  /**
   * Share of area GDP. Sums to 1.
   *
   * The reason a severe shock to one member barely moves the aggregate, and
   * the reason that is *correct* rather than a bug: a shock worth two points
   * of Italian output is worth 0.28 points of the area's.
   */
  readonly weight: number
  /**
   * Government debt burden relative to the area average.
   *
   * Loads the common fragmentation factor onto this member's sovereign
   * spread. A rise in area-wide risk aversion widens the spread of a heavily
   * indebted member by much more than a lightly indebted one, which is the
   * whole mechanism behind fragmentation.
   */
  readonly debtLoading: number
  /**
   * How sharply unemployment responds to the cycle, relative to average.
   *
   * Above one means a given slowdown costs more jobs and a given recovery
   * returns more. It is a property of how employment is contracted and how
   * quickly firms adjust headcount, and it is the reason a single tightening
   * is felt very unevenly across the area.
   */
  readonly labourSensitivity: number
  /**
   * Manufacturing and construction share of value added, relative to average.
   *
   * Interest-sensitive output. A rate rise reaches an industrial economy
   * harder and sooner than a services one.
   */
  readonly industrialWeight: number
  /**
   * Dependence on imported energy, relative to average.
   *
   * Loads an area-wide supply shock onto this member's inflation. It is why a
   * single energy shock produces four different inflation rates.
   */
  readonly energyExposure: number
  /**
   * Opening dispersion from the area aggregate, in percentage points.
   *
   * **Invented, for play.** Chosen so the single-rate problem is live from the
   * first meeting: the spread between the highest and lowest inflation rate is
   * wider than a quarter-point rate move can address, so a chair setting one
   * rate for all of them has to decide whose problem to solve.
   *
   * The weighted mean of each column is zero by construction — see the
   * assertion in `engine/members.ts`. A set of offsets that did not sum to
   * zero would be a second, contradictory statement about the area's own
   * inflation rate.
   */
  readonly opening: {
    readonly inflation: number
    readonly outputGap: number
    readonly unemployment: number
  }
}

/**
 * The five named members and the aggregated remainder.
 *
 * Five plus a remainder rather than all twenty: the panel has to be readable
 * at a glance on a phone, and the members below are the ones whose weight is
 * large enough that a shock to them registers in the aggregate at all. The
 * remainder carries the rest of the area at average structure, which is what
 * it is by construction.
 *
 * Weights are shares of euro-area GDP, rounded to the nearest point, and sum
 * to exactly 1.
 */
export const MEMBERS: readonly MemberProfile[] = [
  {
    id: 'de',
    name: 'Germany',
    short: 'DE',
    article: '',
    weight: 0.29,
    // Low debt, so the common fragmentation factor barely loads on it: in a
    // sell-off this is where money goes rather than where it leaves.
    debtLoading: 0.55,
    labourSensitivity: 0.75,
    // The area's industrial core, and therefore the most interest-sensitive
    // output: a rate rise reaches machine tools before it reaches services.
    industrialWeight: 1.35,
    energyExposure: 1.30,
    opening: { inflation: -0.7, outputGap: -0.5, unemployment: -1.4 },
  },
  {
    id: 'fr',
    name: 'France',
    short: 'FR',
    article: '',
    weight: 0.2,
    debtLoading: 1.15,
    labourSensitivity: 0.9,
    industrialWeight: 0.85,
    // Comparatively low imported-energy intensity for its size, so an energy
    // shock passes into its prices less than into the area's.
    energyExposure: 0.7,
    opening: { inflation: -0.2, outputGap: 0.1, unemployment: 0.9 },
  },
  {
    id: 'it',
    name: 'Italy',
    short: 'IT',
    article: '',
    weight: 0.14,
    // The highest debt loading in the area, which is what makes it the member
    // a fragmentation episode is *about*.
    debtLoading: 1.85,
    labourSensitivity: 1.0,
    industrialWeight: 1.15,
    energyExposure: 1.25,
    opening: { inflation: 0.4, outputGap: -0.4, unemployment: 1.3 },
  },
  {
    id: 'es',
    name: 'Spain',
    short: 'ES',
    article: '',
    weight: 0.1,
    debtLoading: 1.4,
    // The most cyclical labour market in the area by a wide margin: a
    // slowdown costs proportionally more jobs here and a recovery returns
    // more, which is a fact about employment contracts and sectoral mix.
    labourSensitivity: 1.6,
    industrialWeight: 0.8,
    energyExposure: 1.05,
    opening: { inflation: 1.5, outputGap: 0.9, unemployment: 3.6 },
  },
  {
    id: 'nl',
    name: 'Netherlands',
    short: 'NL',
    article: 'the ',
    weight: 0.07,
    debtLoading: 0.6,
    labourSensitivity: 0.8,
    industrialWeight: 0.9,
    // Very open, and a large energy trading and refining sector, so wholesale
    // energy moves reach consumer prices unusually fast.
    energyExposure: 1.35,
    opening: { inflation: 0.8, outputGap: 0.6, unemployment: -1.5 },
  },
  {
    id: 'rest',
    name: 'Rest of the area',
    short: 'Rest',
    article: 'the ',
    weight: 0.2,
    // Average by construction: it is the residual, and giving it a character
    // of its own would be inventing one for a bloc that has no single one.
    debtLoading: 1.0,
    labourSensitivity: 1.0,
    industrialWeight: 1.0,
    energyExposure: 1.0,
    opening: { inflation: 0.05, outputGap: 0.05, unemployment: -0.03 },
  },
]

export const MEMBERS_BY_ID = new Map<MemberId, MemberProfile>(
  MEMBERS.map((member) => [member.id, member]),
)

export function getMember(id: MemberId): MemberProfile {
  const member = MEMBERS_BY_ID.get(id)
  if (member === undefined) throw new Error(`Unknown member: ${id}`)
  return member
}

/**
 * How members diverge, and how fast they come back together.
 *
 * Every coefficient here is a *differential*: it multiplies the difference
 * between a member's loading and the area average, so a member at 1.00 on
 * every loading never diverges at all no matter what happens to the area.
 */
export const MEMBER_DYNAMICS = {
  /**
   * Speed at which offsets decay toward zero, per year.
   *
   * Convergence is real and slow. Set so an offset left alone loses about a
   * third of itself over a mandate's length rather than over a quarter: a
   * dispersion that healed on its own inside a year would make the whole
   * problem a passing inconvenience rather than the thing the chair has to
   * steer around.
   */
  convergence: 0.35,
  /**
   * Extra unemployment per point of real-rate restriction, per unit of
   * labour-sensitivity above average, per year.
   */
  labourTransmission: 0.5,
  /**
   * Extra output-gap loss per point of real-rate restriction, per unit of
   * industrial weight above average, per year.
   */
  industrialTransmission: 0.55,
  /** Extra inflation per point of area supply shock, per unit of exposure. */
  energyPassThrough: 0.75,
  /**
   * Extra inflation per point of a member's own output gap, per year.
   *
   * A local Phillips curve. Without it, a member could run a large positive
   * gap indefinitely with no consequence for its own prices, and the
   * dispersion panel would show a divergence that never resolved into
   * anything.
   */
  localPhillips: 0.22,
  /**
   * Sovereign spread over the area benchmark, in basis points, per unit of
   * debt loading above average, per basis point of area fragmentation.
   */
  spreadLoading: 1.0,
  /** Extra spread per point of a member's own output-gap shortfall, bp. */
  spreadGapSensitivity: 22,
  /** Speed at which a spread moves toward its target, per year. */
  spreadAdjustment: 4.0,
  /**
   * Spread above which the common policy rate stops reaching a member.
   *
   * The fragmentation mechanic's whole point, stated as a number: past this,
   * a member's borrowing costs are set by its own risk premium rather than by
   * the rate the committee voted, and the committee is steering an economy it
   * has partly lost contact with.
   */
  transmissionBreakSpread: 250,
  /** Share of policy transmission lost at twice the break spread. */
  transmissionBreakLoss: 0.55,
} as const
