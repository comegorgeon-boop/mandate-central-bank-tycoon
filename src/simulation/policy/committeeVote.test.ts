import { describe, expect, it } from 'vitest'
import { chairMoveOf, committeeVote } from './committeeVote.ts'
import type { CommitteeView } from './staffRule.ts'
import { toolkitPackage } from './toolkitRule.ts'
import {
  SIMULATION_VERSION,
  createRunConfig,
  startRun,
  submitMeeting,
} from '../index.ts'

/**
 * The vote, and the three things that would make it a lie.
 *
 * **A vote nobody cast must not read as unanimous.** Most difficulties publish
 * no committee at all, and a 0–0 result rendered as "of one mind" is the
 * interface inventing a consensus out of an absence. This is the failure the
 * empty case exists to prevent and the only one of the three that produces a
 * screen that looks completely fine.
 *
 * **The chair must still decide.** The committee prices the decision; it does
 * not take it. A test that the confirmed move survives the vote is what keeps
 * a later "make the committee matter more" from quietly turning the game into
 * one about lobbying advisers. See `docs/QUESTIONS.md`.
 *
 * **One dissent must be free.** The Fed publishes dissents routinely and a
 * 10–1 vote is not an institution in trouble. If a single dissenting voice
 * cost credibility, the dominant strategy would be to track the committee's
 * median — which is the game playing itself.
 */

function view(voice: string, basisPoints: number): CommitteeView {
  return {
    voice,
    basisPoints,
    inflationWeight: 1,
    reasoning: 'because of the numbers',
  } as CommitteeView
}

describe('putting the chair’s move to the committee', () => {
  it('reads an absent committee as absent, not as unanimous', () => {
    const vote = committeeVote([], 25)
    expect(vote.ballots).toHaveLength(0)
    expect(vote.unanimous, 'a vote nobody cast came back unanimous').toBe(false)
    expect(vote.headline, 'an absent vote produced a headline').toBeNull()
    expect(vote.credibilityCost).toBe(0)
  })

  it('records no dissent when the committee is close to the chair', () => {
    const vote = committeeVote([view('A', 25), view('B', 50), view('C', 0)], 25)
    expect(vote.against).toBe(0)
    expect(vote.unanimous).toBe(true)
    expect(vote.credibilityCost).toBe(0)
    expect(vote.headline).toContain('unanimously')
  })

  it('costs nothing for a single dissent', () => {
    // One dissent is ordinary, and making it expensive would make tracking the
    // committee's median the dominant strategy.
    const vote = committeeVote([view('A', 25), view('B', 25), view('C', 100)], 25)
    expect(vote.against).toBe(1)
    expect(vote.credibilityCost).toBe(0)
    expect(vote.headline).toContain('one dissent')
  })

  it('charges for a committee that cannot hold a majority', () => {
    const vote = committeeVote([view('A', 0), view('B', 100), view('C', 100)], 0)
    expect(vote.against).toBe(2)
    // One member agreed, plus the chair.
    expect(vote.inFavour).toBe(2)
    expect(vote.credibilityCost).toBeGreaterThan(0)
    // And says so plainly rather than burying it.
    expect(vote.headline).toContain('2–2')
  })

  it('counts the chair, who is never against their own package', () => {
    // "Decision taken 0-3" reads as a decision nobody supported, in a game
    // where the player is the chair and has just taken it.
    const all = committeeVote([view('A', 200), view('B', 200), view('C', 200)], -200)
    expect(all.against).toBe(3)
    expect(all.inFavour, 'the chair was not counted').toBe(1)
    expect(all.headline).toContain('1–3')
  })

  it('publishes what the dissenter wanted, not whether they were right', () => {
    const vote = committeeVote([view('A', 0), view('B', 100)], 0)
    const dissent = vote.ballots.find((ballot) => ballot.dissents)!
    expect(dissent.statement).toContain('+100 bp')
    expect(dissent.statement).toContain('tighter')
    // Nothing in a ballot judges the chair. That is the scoreboard's job, in
    // a different panel, after the fact.
    for (const ballot of vote.ballots) {
      expect(ballot.statement.toLowerCase()).not.toContain('wrong')
      expect(ballot.statement.toLowerCase()).not.toContain('mistake')
    }
  })

  it('follows the chair within tolerance and dissents beyond it', () => {
    // The tolerance is what stops the publication becoming noise: a member who
    // wanted +50 does not dissent from +25.
    expect(committeeVote([view('A', 50)], 25).against).toBe(0)
    expect(committeeVote([view('A', 100)], 25).against).toBe(1)
  })

  it('reads the rate out of a package, and a package with no rate as a hold', () => {
    expect(chairMoveOf({ actions: [], communication: null })).toBe(0)
    expect(
      chairMoveOf({
        actions: [{ instrument: 'policy_rate', magnitude: -75 }],
        communication: null,
      }),
    ).toBe(-75)
    expect(
      chairMoveOf({
        actions: [{ instrument: 'forward_guidance', magnitude: 50 }],
        communication: null,
      }),
      'a package that moved no rate was read as a move',
    ).toBe(0)
  })
})

describe('in a real mandate', () => {
  it('leaves the chair’s decision standing, whatever the vote', () => {
    // The property the whole design rests on. A committee that could refuse a
    // package would make this a game about advisers.
    const config = createRunConfig({
      institution: 'fed',
      difficulty: 'hard',
      seed: 'VOTE-CHAIR',
      simulationVersion: SIMULATION_VERSION,
    })
    let session = startRun(config)
    const before = session.state.latent.policyRate
    const result = submitMeeting(session, {
      actions: [{ instrument: 'policy_rate', magnitude: 100 }],
      communication: null,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    session = result.session
    // The rate moved by what the chair asked for, not by what the committee
    // would have preferred.
    expect(session.state.latent.policyRate).toBeGreaterThan(before)
  })

  it('attaches a vote to every meeting, and none to the opening', () => {
    const config = createRunConfig({
      institution: 'fed',
      difficulty: 'hard',
      seed: 'VOTE-ATTACHED',
      simulationVersion: SIMULATION_VERSION,
    })
    const opening = startRun(config)
    expect(opening.vote.ballots).toHaveLength(0)
    expect(opening.vote.headline).toBeNull()

    // And none at the first decision either, which is not an oversight: the
    // first figures of the term are not published yet, and a committee cannot
    // be split over numbers nobody has. The ballots appear once the releases
    // the staff rule depends on have arrived.
    let session = opening
    const seen: number[] = []
    for (let index = 0; index < 6; index += 1) {
      const result = submitMeeting(session, { actions: [], communication: null })
      if (!result.ok) break
      session = result.session
      seen.push(session.vote.ballots.length)
    }
    expect(seen[0], 'the first decision was voted on before any figures existed').toBe(0)
    expect(
      seen.some((count) => count > 0),
      'no meeting in a hard mandate ever produced a vote',
    ).toBe(true)
  })

  it('is not noise: competent play mostly carries the room', () => {
    // The failure this guards is a published record that says "divided" every
    // single meeting, at which point the publication stops meaning anything
    // and the credibility charge becomes a flat tax on playing at all.
    //
    // Measured against the engine's own benchmark rule rather than a
    // hand-written sequence, so it tracks the model instead of a guess about
    // it. Slamming the dial to its stop every meeting *does* produce a
    // committee that votes against — correctly, and that is the other half of
    // the mechanic working.
    let voted = 0
    let majorityAgainst = 0
    for (let seed = 0; seed < 12; seed += 1) {
      const config = createRunConfig({
        institution: 'fed',
        difficulty: 'hard',
        seed: `VOTE-NOISE-${seed}`,
        simulationVersion: SIMULATION_VERSION,
      })
      let session = startRun(config)
      for (let meeting = 0; meeting < 24; meeting += 1) {
        const result = submitMeeting(
          session,
          toolkitPackage(session, 'fed', 'hard'),
        )
        if (!result.ok) break
        session = result.session
        if (session.vote.ballots.length === 0) continue
        voted += 1
        if (session.vote.against > session.vote.inFavour) majorityAgainst += 1
      }
    }
    expect(voted, 'no meeting produced a vote at all').toBeGreaterThan(50)
    const share = majorityAgainst / voted
    expect(
      share,
      `competent play lost the committee on ${(share * 100).toFixed(0)} % of ` +
        `votes: the published record is noise`,
    ).toBeLessThan(0.1)

    // Measured at zero, which is close to tautological on its own — the
    // benchmark rule is built from the same staff rule the committee's centre
    // uses, so of course it carries the room. The half that is *not*
    // tautological is the next test: the record has to be capable of turning
    // against a player who earns it, or a charge that never fires is not a
    // mechanic.
  })

  it('does bite, when the chair goes to the stop and stays there', () => {
    let voted = 0
    let majorityAgainst = 0
    for (let seed = 0; seed < 6; seed += 1) {
      const config = createRunConfig({
        institution: 'fed',
        difficulty: 'hard',
        seed: `VOTE-EXTREME-${seed}`,
        simulationVersion: SIMULATION_VERSION,
      })
      let session = startRun(config)
      for (let meeting = 0; meeting < 12; meeting += 1) {
        // Alternating stops: the most violent legal policy there is.
        const result = submitMeeting(session, {
          actions: [
            { instrument: 'policy_rate', magnitude: meeting % 2 === 0 ? 200 : -200 },
          ],
          communication: null,
        })
        if (!result.ok) break
        session = result.session
        if (session.vote.ballots.length === 0) continue
        voted += 1
        if (session.vote.against > session.vote.inFavour) majorityAgainst += 1
      }
    }
    expect(voted).toBeGreaterThan(10)
    const share = majorityAgainst / voted
    expect(
      share,
      `the committee voted against a chair slamming the dial on only ` +
        `${(share * 100).toFixed(0)} % of votes: the record cannot turn`,
    ).toBeGreaterThan(0.5)
  })

  it('replays identically, vote and all', () => {
    // The vote is derived from the published observation, so it must be as
    // deterministic as everything else. A vote that drifted between a run and
    // its replay would desynchronise the credibility it charges.
    const run = () => {
      const config = createRunConfig({
        institution: 'fed',
        difficulty: 'hard',
        seed: 'VOTE-DETERMINISM',
        simulationVersion: SIMULATION_VERSION,
      })
      let session = startRun(config)
      const votes: string[] = []
      for (let index = 0; index < 5; index += 1) {
        const result = submitMeeting(session, {
          actions: [{ instrument: 'policy_rate', magnitude: 50 }],
          communication: null,
        })
        if (!result.ok) break
        session = result.session
        votes.push(`${session.vote.inFavour}-${session.vote.against}`)
      }
      return { votes, credibility: session.state.latent.credibility }
    }
    const first = run()
    const second = run()
    expect(first.votes).toEqual(second.votes)
    expect(first.credibility).toBe(second.credibility)
  })
})
