import {
  DOCTRINES,
  SCORE_WEIGHTS,
  advanceArm,
  doctrineContext,
  getInstitution,
  unemploymentGap,
  type DoctrineId,
  type Institution,
  type PolicyPackage,
  type RunSession,
  type SimulationState,
} from '../../simulation/index.ts'

/**
 * Which school was right, and how often.
 *
 * The heart of the doctrines, in the player's own words: *"I learn which
 * school goes with which regime by seeing it, not by reading it."* Reading ten
 * positions teaches ten positions. Watching the monetarist be right seven
 * times out of ten in a demand cycle and wrong seven times out of ten in a
 * supply shock teaches what the positions are *for*.
 *
 * It is settled by the counterfactual rather than by opinion. At each meeting
 * every school that disagreed with the decision gets a **trial**: the same
 * world, the same shocks, the same subsequent decisions, with that one meeting
 * taken at the rate that school argued for. Four meetings later the two paths
 * are compared on the mandate's own loss, and the school is scored right or
 * wrong on the answer.
 *
 * ## Why four meetings
 *
 * Because that is where a rate change has largely arrived. Judged at the next
 * meeting every school would be scored on a decision that had not yet done
 * anything, and the verdict would be noise; judged at the end of the mandate
 * everything would be confounded with everything since. Four is the horizon
 * the package projection uses and for the same reason.
 *
 * ## Why only schools that disagreed
 *
 * A school that recommended what the committee did has nothing to be tested
 * against — its trial would be the actual run, and "the rule was right"
 * would mean only "you agreed with the rule". Agreement is recorded
 * separately, because a school you always follow is a school whose record is
 * your record.
 *
 * It lives in the interface layer for the same reason the instrument ledger
 * and the counterfactual arms do: `submitMeeting` is on the path of every
 * balance sweep, and none of them needs forty alternative economies running
 * beside them to fill in a table only a human reads.
 */

/** Meetings before a trial is judged. */
const HORIZON = 4

/** A move has to differ by at least this to be a different decision. */
const REAL_DIFFERENCE = 25

export interface DoctrineTrial {
  readonly doctrine: DoctrineId
  readonly decidedAt: number
  readonly dueAt: number
  /** The world with that meeting taken the school's way. */
  readonly arm: SimulationState
  readonly recommended: number
  readonly played: number
}

export interface DoctrineRecord {
  readonly doctrine: DoctrineId
  /** Meetings where it disagreed and the disagreement has been judged. */
  readonly tested: number
  /** Of those, the ones where its advice would have come out better. */
  readonly right: number
  /** Meetings where it recommended what the committee did anyway. */
  readonly agreed: number
}

export interface Scoreboard {
  readonly open: readonly DoctrineTrial[]
  readonly records: Readonly<Record<DoctrineId, DoctrineRecord>>
  /** Verdicts reached at the meeting just played, for the notice. */
  readonly settled: readonly {
    readonly doctrine: DoctrineId
    readonly right: boolean
    readonly decidedAt: number
  }[]
}

function emptyRecords(): Record<DoctrineId, DoctrineRecord> {
  return Object.fromEntries(
    DOCTRINES.map((doctrine) => [
      doctrine.id,
      { doctrine: doctrine.id, tested: 0, right: 0, agreed: 0 },
    ]),
  ) as Record<DoctrineId, DoctrineRecord>
}

export function openScoreboard(): Scoreboard {
  return { open: [], records: emptyRecords(), settled: [] }
}

/**
 * The mandate's own loss, as the scorecard weights it.
 *
 * Quadratic in both halves and weighted by the institution's own scoring
 * weights, so "better" here means better by the standard the mandate is
 * actually judged on rather than by a criterion invented for this table. Read
 * off the latent state, because this is a fact about the economy a policy
 * produced and not about how well it was measured.
 */
function loss(state: SimulationState, institution: Institution): number {
  const weights = SCORE_WEIGHTS[institution]
  const target = getInstitution(institution).inflationTarget
  const priceMiss = state.latent.inflationHeadline - target
  const jobsMiss = unemploymentGap(state.latent)
  return (
    weights.price_stability * priceMiss * priceMiss +
    weights.employment_output * jobsMiss * jobsMiss
  )
}

/** The rate move in a package, in basis points. */
function moveOf(pkg: PolicyPackage): number {
  return (
    pkg.actions.find((action) => action.instrument === 'policy_rate')?.magnitude ?? 0
  )
}

/** The player's package with the rate replaced by a school's recommendation. */
function asDoctrineWould(pkg: PolicyPackage, basisPoints: number): PolicyPackage {
  const others = pkg.actions.filter((action) => action.instrument !== 'policy_rate')
  return {
    ...pkg,
    actions:
      basisPoints === 0
        ? others
        : [...others, { instrument: 'policy_rate', magnitude: basisPoints }],
  }
}

/**
 * Advances the scoreboard through the meeting just played.
 *
 * `before` is the session as the decision was taken from — which is where each
 * school's recommendation has to be read, because that is the table it was
 * arguing from and the one the player saw.
 */
export function advanceScoreboard(
  board: Scoreboard,
  before: RunSession,
  after: RunSession,
  pkg: PolicyPackage,
  maxMove: number,
): Scoreboard {
  const institution = before.state.config.institution
  const meetingIndex = before.state.meetingIndex
  const events = after.state.eventLog.filter(
    (record) => record.meetingIndex === meetingIndex,
  )
  const played = moveOf(pkg)

  const records = { ...board.records }
  const bump = (
    id: DoctrineId,
    change: Partial<Omit<DoctrineRecord, 'doctrine'>>,
  ): void => {
    const current = records[id]
    records[id] = {
      doctrine: id,
      tested: current.tested + (change.tested ?? 0),
      right: current.right + (change.right ?? 0),
      agreed: current.agreed + (change.agreed ?? 0),
    }
  }

  // ---- 1. Carry every open trial one meeting further ----------------------
  const carried = board.open.map((trial) => ({
    ...trial,
    arm: advanceArm(trial.arm, pkg, events),
  }))

  // ---- 2. Judge the ones that have come due -------------------------------
  const settled: {
    doctrine: DoctrineId
    right: boolean
    decidedAt: number
  }[] = []
  const stillOpen: DoctrineTrial[] = []
  for (const trial of carried) {
    if (trial.dueAt > after.state.meetingIndex) {
      stillOpen.push(trial)
      continue
    }
    const right = loss(trial.arm, institution) < loss(after.state, institution)
    bump(trial.doctrine, { tested: 1, right: right ? 1 : 0 })
    settled.push({ doctrine: trial.doctrine, right, decidedAt: trial.decidedAt })
  }

  // ---- 3. Open a trial for every school that disagreed --------------------
  const lastPackage = before.decisions.at(-1)?.package
  const ctx = doctrineContext({
    observation: before.observation,
    institution,
    currentRate: before.state.stance.targetRate,
    lastMove: lastPackage === undefined ? 0 : moveOf(lastPackage),
    meetingIndex,
    maxMove,
  })

  for (const doctrine of DOCTRINES) {
    if (!doctrine.speaks(ctx)) continue
    const recommended = doctrine.view(ctx).basisPoints
    if (Math.abs(recommended - played) < REAL_DIFFERENCE) {
      bump(doctrine.id, { agreed: 1 })
      continue
    }
    stillOpen.push({
      doctrine: doctrine.id,
      decidedAt: meetingIndex,
      dueAt: meetingIndex + HORIZON,
      arm: advanceArm(before.state, asDoctrineWould(pkg, recommended), events),
      recommended,
      played,
    })
  }

  return { open: stillOpen, records, settled }
}

/** The schools with a record worth showing, best first. */
export function ranked(board: Scoreboard): readonly DoctrineRecord[] {
  return Object.values(board.records)
    .filter((record) => record.tested > 0)
    .sort((a, b) => b.right / b.tested - a.right / a.tested)
}
