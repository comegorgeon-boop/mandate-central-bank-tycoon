// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  GUIDANCE_HORIZON_MEETINGS,
  INSTITUTIONAL,
  SIMULATION_VERSION,
  createRunConfig,
  getDifficulty,
  startRun,
  submitMeeting,
  type CommunicationCommitment,
  type PolicyPackage,
  type RunSession,
} from '../../simulation/index.ts'
import { announcementWeight, isBinding, promiseLedger } from './promiseLedger.ts'
import { settledPromise } from './settledPromise.ts'

/**
 * The figures shown are the figures charged.
 *
 * The player could not see the point of committing, and the interface was the
 * reason: it showed what a commitment buys and never what breaking one costs
 * or what never making one forfeits. Putting those numbers on screen only
 * helps if they are the engine's own — a panel quoting a hand-written "about
 * six points" would be a second source of truth that drifts silently the first
 * time anyone tunes the model.
 */

const HOLD: PolicyPackage = { actions: [], communication: null }

function promise(
  signal: number,
  commitment: CommunicationCommitment = 'conditional_path',
): PolicyPackage {
  return {
    actions: [{ instrument: 'forward_guidance', magnitude: signal }],
    communication: {
      tone: signal > 0 ? 'hawkish' : 'dovish',
      emphasis: 'inflation',
      commitment,
      channel: 'statement',
    },
  }
}

function rateMove(basisPoints: number): PolicyPackage {
  return {
    actions: [{ instrument: 'policy_rate', magnitude: basisPoints }],
    communication: null,
  }
}

function open(seed = 'promise'): RunSession {
  return startRun(
    createRunConfig({
      institution: 'fed',
      difficulty: 'medium',
      seed,
      simulationVersion: SIMULATION_VERSION,
    }),
  )
}

function play(session: RunSession, pkg: PolicyPackage): RunSession {
  const result = submitMeeting(session, pkg)
  if (!result.ok) throw new Error('package rejected')
  return result.session
}

describe('what a commitment is worth', () => {
  it('says zero when markets price zero', () => {
    // The sentence the player never got. At `none` the announcement channel is
    // not weak, it is shut, and no choice of words opens it.
    expect(announcementWeight('none')).toBe(0)
    expect(isBinding('none')).toBe(false)
  })

  it('separates a leaning from a promise', () => {
    expect(isBinding('weak_bias')).toBe(false)
    expect(isBinding('conditional_path')).toBe(true)
    expect(announcementWeight('weak_bias')).toBeGreaterThan(0)
    expect(announcementWeight('conditional_path')).toBeGreaterThan(
      announcementWeight('weak_bias'),
    )
  })
})

describe('the ledger quotes the engine, not a copy of it', () => {
  it('prices a break at what the engine charges, scaled by difficulty', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const ledger = promiseLedger(open().state.guidance, difficulty)
      const sensitivity = getDifficulty(difficulty).credibilitySensitivity
      expect(ledger.nextBrokenCredibility).toBeCloseTo(
        INSTITUTIONAL.credibility.brokenPromise * sensitivity,
        9,
      )
      // Market trust is unscaled in `applyPolicyPackage`, and the panel must
      // say so rather than quietly scaling it for symmetry.
      expect(ledger.nextBrokenMarket).toBeCloseTo(
        INSTITUTIONAL.marketTrust.brokenPromise,
        9,
      )
    }
  })

  it('caps the delivery credit where the engine caps it', () => {
    const cap = INSTITUTIONAL.credibility.keptPromiseCap
    const many = promiseLedger(
      { ...open().state.guidance, keptPromises: 99 },
      'medium',
    )
    expect(many.keptCredit).toBe(cap)
    expect(many.nextKeptGain).toBe(0)
  })

  it('names what a mandate that never commits is forgoing', () => {
    const fresh = promiseLedger(open().state.guidance, 'medium')
    expect(fresh.neverCommitted).toBe(true)
    expect(fresh.forgoneCredit).toBe(INSTITUTIONAL.credibility.keptPromiseCap)

    // Once there is a record either way, "what you might have had" stops being
    // the story and the record itself is.
    const withRecord = promiseLedger(
      { ...open().state.guidance, keptPromises: 1 },
      'medium',
    )
    expect(withRecord.neverCommitted).toBe(false)
    expect(withRecord.forgoneCredit).toBe(0)
  })
})

describe('a settled promise is reported on the meeting it settles', () => {
  it('reports nothing at a meeting that settled nothing', () => {
    const before = open()
    const after = play(before, HOLD)
    expect(
      settledPromise(before.state.guidance, after.state.guidance, 'medium'),
    ).toBeNull()
  })

  it('reports a delivery, with the credit it earned', () => {
    // Publish a tightening path, then deliver a step towards it.
    let session = play(open('deliver'), promise(75))
    const before = session.state.guidance
    session = play(session, rateMove(50))
    const settled = settledPromise(before, session.state.guidance, 'medium')

    expect(settled).not.toBeNull()
    expect(settled!.kept).toBe(true)
    expect(settled!.change).toBeCloseTo(INSTITUTIONAL.credibility.keptPromise, 9)
    expect(settled!.credit).toBeCloseTo(INSTITUTIONAL.credibility.keptPromise, 9)
  })

  it('reports a break, with the cost that will not come back', () => {
    // Publish a tightening path and then cut into it, with nothing to justify
    // the reversal.
    let session = play(open('break'), promise(100))
    const before = session.state.guidance
    session = play(session, rateMove(-75))
    const settled = settledPromise(before, session.state.guidance, 'medium')

    expect(settled).not.toBeNull()
    expect(settled!.kept).toBe(false)
    expect(settled!.credibilityCost).toBeGreaterThan(0)
    expect(settled!.marketCost).toBeGreaterThan(0)
  })

  it('has a promise outstanding until it comes due', () => {
    const session = play(open('outstanding'), promise(75))
    const ledger = promiseLedger(session.state.guidance, 'medium')
    expect(ledger.outstanding).not.toBeNull()
    expect(ledger.outstanding!.judgedAtMeeting).toBe(
      session.state.guidance.issuedAtMeeting + GUIDANCE_HORIZON_MEETINGS + 1,
    )
  })

  it('leaves a leaning off the ledger entirely', () => {
    // It cannot be broken, and it cannot be kept either. That is the trade.
    const session = play(open('leaning'), promise(75, 'weak_bias'))
    expect(promiseLedger(session.state.guidance, 'medium').outstanding).toBeNull()
  })
})
