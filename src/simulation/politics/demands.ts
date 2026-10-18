import type { Institution } from '../types/core.ts'
import type { LatentState, SimulationState } from '../types/state.ts'
import { EXPECTATIONS, INSTITUTIONAL } from '../config/model.ts'

/**
 * What the government wants, and what it costs to say no.
 *
 * ## The design, which is a constraint before it is a feature
 *
 * **Political pressure changes nothing in the economy directly.** It is not a
 * tax on growth and it does not move inflation. What it changes is three
 * things, and the three are the whole mechanic:
 *
 *  1. **What markets anticipate.** A central bank suspected of being about to
 *     give in has its anchor discounted, independently of anything it has
 *     actually done. That channel already exists — see
 *     `EXPECTATIONS.anchoringIndependence` — and it is what makes pressure
 *     expensive before any decision is taken.
 *  2. **The chance of being removed.** Pressure feeds the dismissal
 *     condition's causal chain.
 *  3. **Credibility, if you give in.** And that is the part that needed
 *     building, because until now there was no way to give in. Pressure
 *     accumulated, the player watched it, and nothing was ever *asked* of
 *     them.
 *
 * So a demand is a question with two answers and no third:
 *
 *  - **Yield.** Pressure collapses. Credibility and the anchor go with it, and
 *     markets immediately price the easier policy they now expect. You keep
 *     your job and you have spent the thing the job is for.
 *  - **Resist.** Pressure rises further and the removal gauge with it.
 *     Credibility holds, and a committee seen to hold under pressure earns a
 *     little of the anchor back.
 *
 * ## Who speaks
 *
 * **The institution, never a named living politician.** The administration,
 * the Treasury, a committee of the legislature, a finance ministry. This is
 * the same rule the historical scenarios run under and it exists for the same
 * reason: what an office did is a matter of record and what a person said is
 * not, unless it carries a citation.
 *
 * The one nameable case is Nixon and Burns in 1972, which is documented to the
 * tape — and it is not quoted here either. It is left as the obvious seventh
 * scenario and noted in docs/DIRECTION.md.
 *
 * ## Why these are derived rather than drawn
 *
 * A demand is a pure function of the state, like every eligibility rule in the
 * event catalogue, so the same economy always asks the same question. A player
 * cannot learn to steer around a demand that arrives at random; they can learn
 * that an economy with these properties produces this pressure.
 */

export type DemandResponse = 'yield' | 'resist'

export interface PoliticalDemand {
  readonly id: string
  /** The office that is asking. Never a person. */
  readonly from: string
  /** The headline, as a newswire would carry it. */
  readonly title: string
  /** What is being asked, and on what grounds. */
  readonly body: string
  /** What the committee would be doing if it gave in, in one line. */
  readonly yieldLabel: string
  /** And if it did not. */
  readonly resistLabel: string
  /**
   * How hard this one presses, 0 to 1.
   *
   * Scales both consequences, so a polite letter and a bill before the
   * legislature are the same mechanism at different sizes.
   */
  readonly force: number
}

/** Pressure below which nobody is asking the committee for anything. */
const SPEAKS_ABOVE = 46

/** And above which the asking is formal rather than briefed to the press. */
const FORMAL_ABOVE = 64

interface Candidate {
  readonly id: string
  /** Whether this economy is the one that produces this demand. */
  readonly when: (latent: LatentState, institution: Institution) => boolean
  readonly build: (institution: Institution) => Omit<PoliticalDemand, 'id' | 'force'>
}

const CANDIDATES: readonly Candidate[] = [
  {
    // The commonest one, and the one the whole mechanic is about: the cost of
    // credit, when unemployment is the thing the government is answering for.
    id: 'cost_of_credit',
    when: (latent) =>
      latent.unemployment - latent.naturalUnemployment > 1.0 &&
      latent.policyRate - latent.inflationHeadline > 1.5,
    build: (institution) => ({
      from:
        institution === 'fed'
          ? 'The administration'
          : 'The finance ministers of the member states',
      title: 'A public request to stop',
      body:
        'The administration has put its position on the record: with ' +
        'unemployment where it is, the real cost of borrowing set by this ' +
        'committee is doing more damage than the inflation it is aimed at. ' +
        'It asks for the rate to come down at this meeting and for a ' +
        'commitment that it will keep coming down. The request is public, ' +
        'which is itself the point — it is addressed to the people who will ' +
        'vote, not to this room.',
      yieldLabel: 'Cut, and say that you will go on cutting',
      resistLabel: 'Hold, and say in the statement that you are holding',
    }),
  },
  {
    // Sargent-Wallace in a letter: the government cannot carry the bill.
    id: 'fiscal_dominance',
    when: (latent) => latent.debtPressure > 62 && latent.debtService > 4.0,
    build: (institution) => ({
      from: institution === 'fed' ? 'The Treasury' : 'The largest member state',
      title: 'The interest bill is now the budget',
      body:
        'The debt service line has passed what the government spends on most ' +
        'of what it does, and every basis point this committee adds reprices ' +
        'a stock it has to roll. The Treasury has asked, in terms, for the ' +
        'rate to be held where it is until the funding programme is through, ' +
        'and has observed that the alternative is a fiscal consolidation ' +
        'nobody has voted for. That is the unpleasant arithmetic put as a ' +
        'request.',
      yieldLabel: 'Hold the rate for the funding programme',
      resistLabel: 'Set the rate the economy needs, and say the funding is not yours to manage',
    }),
  },
  {
    // The institutional one: not a policy ask, a threat to the mandate.
    id: 'independence_review',
    when: (latent) => latent.politicalPressure > FORMAL_ABOVE && latent.publicTrust < 48,
    build: (institution) => ({
      from:
        institution === 'fed'
          ? 'A committee of the legislature'
          : 'A committee of the Parliament',
      title: 'The mandate itself is on the order paper',
      body:
        'A bill has been introduced to review how this committee is ' +
        'appointed and what it is required to take into account. The ' +
        'hearing has been scheduled. Nothing in the bill compels a rate, and ' +
        'that is not what it is for: it is an invitation to arrive at the ' +
        'hearing with the policy already adjusted, so that the bill can be ' +
        'withdrawn without anybody having had to insist.',
      yieldLabel: 'Arrive at the hearing with the policy already adjusted',
      resistLabel: 'Attend the hearing, defend the mandate, and change nothing',
    }),
  },
]

/**
 * The demand this economy produces, or none.
 *
 * At most one at a time: two governments asking for different things in the
 * same meeting is a screen, not a dilemma. Where more than one candidate
 * fires, the most specific wins — the order below is the order of the
 * catalogue, and the catalogue is ordered from the most ordinary to the most
 * institutional, so the rarest and gravest takes precedence.
 */
export function politicalDemand(state: SimulationState): PoliticalDemand | null {
  const { latent } = state
  if (latent.politicalPressure < SPEAKS_ABOVE) return null

  const institution = state.config.institution
  const matching = CANDIDATES.filter((candidate) => candidate.when(latent, institution))
  if (matching.length === 0) return null
  const chosen = matching[matching.length - 1]

  // Force runs from nothing at the threshold to one at the top of the scale,
  // so the same demand is a letter at 50 and a confrontation at 90.
  const force = Math.min(
    1,
    (latent.politicalPressure - SPEAKS_ABOVE) / (100 - SPEAKS_ABOVE),
  )

  return { id: chosen.id, force, ...chosen.build(institution) }
}

/**
 * What answering costs, as deltas to apply to the latent state.
 *
 * Returned rather than applied so that `applyPolicyPackage` keeps the single
 * place where a decision changes the world, and so that the desk can show the
 * player what each answer would do before they pick one. A dilemma whose two
 * sides are not both legible is a trap rather than a decision.
 */
export function demandConsequences(
  demand: PoliticalDemand,
  response: DemandResponse,
): {
  readonly politicalPressure: number
  readonly credibility: number
  readonly anchoring: number
  readonly marketExpectedRate: number
  readonly publicTrust: number
} {
  const f = demand.force
  if (response === 'yield') {
    return {
      // The pressure goes, which is what was bought.
      politicalPressure: -28 * f - 8,
      // And this is what it cost. Sized against the credibility block's own
      // `brokenPromise` of 6: giving in to a government in public is worth
      // between one and three broken promises, which is the right order — it
      // is the same kind of damage and more of it.
      credibility: -(6 + 12 * f),
      anchoring: -(0.05 + 0.1 * f),
      // Markets price the easier policy they now expect, immediately. This is
      // the channel that makes yielding expensive before the rate has moved.
      marketExpectedRate: -(0.2 + 0.5 * f),
      // The public, who asked for this, are pleased.
      publicTrust: 4 + 6 * f,
    }
  }
  return {
    // Resisting is not free and is not meant to be. The pressure goes up,
    // which is the removal gauge going up.
    politicalPressure: 6 + 10 * f,
    // A committee seen to hold under pressure earns a little back — less than
    // yielding costs, which is the asymmetry that makes this a real choice
    // rather than an obvious one.
    credibility: 2 + 4 * f,
    anchoring: 0.02 + 0.04 * f,
    marketExpectedRate: 0,
    // And the public, who were promised relief, are not pleased.
    publicTrust: -(2 + 5 * f),
  }
}

/**
 * The two constants above, exported for the panel that explains them.
 *
 * The desk quotes the independence tolerance when it describes what pressure
 * is doing to the anchor, and a number stated in prose that no constant
 * accounts for is the drift this project has a test against.
 */
export const DEMAND_THRESHOLDS = {
  speaksAbove: SPEAKS_ABOVE,
  formalAbove: FORMAL_ABOVE,
  independenceTolerance: EXPECTATIONS.independenceTolerance,
  brokenPromiseCost: INSTITUTIONAL.credibility.brokenPromise,
} as const
