import { describe, expect, it } from 'vitest'
import { SIMULATION_VERSION } from '../version.ts'
import { createRunConfig } from '../engine/initialState.ts'
import { playRun, startRun, submitMeeting } from '../replay/replayRun.ts'
import { toolkitPackage } from '../policy/toolkitRule.ts'
import { generateObservation } from '../observation/generateObservation.ts'
import { NIXON_BURNS_1972 } from './nixonBurns.ts'

/**
 * 1972-74 has to produce 1972-74.
 *
 * `sourced.test.ts` already locks every opening figure against the documented
 * table, and `playable.test.ts` already proves the mandate can be played to an
 * ending. Neither asks the question that actually matters about a historical
 * scenario, which is whether the *arc* is the period's — and a scenario whose
 * inflation never left 4 % would pass both of them while teaching the opposite
 * of what happened. The first draft of this one deflated to below zero in
 * 1973, with every test in the repository green.
 *
 * So: the shape, asserted loosely enough to survive ordinary retuning and
 * tightly enough that losing the period would fail. The precise fit table is
 * in `docs/SCENARIOS.md` and is reproduced by `dev/nixonFit.ts`.
 */

function playedByTheRule() {
  const config = createRunConfig({
    institution: 'fed',
    difficulty: 'hard',
    seed: 'NIXON-FIT',
    scenario: 'nixon_burns_1972',
    simulationVersion: SIMULATION_VERSION,
  })
  return playRun(config, (session) => toolkitPackage(session, 'fed', 'hard'))
}

describe('the period the scenario is named after', () => {
  const session = playedByTheRule()
  const history = session.state.history
  const last = history[history.length - 1].latent
  const peakInflation = Math.max(...history.map((s) => s.latent.inflationHeadline))
  const troughInflation = Math.min(...history.map((s) => s.latent.inflationHeadline))

  it('runs to term', () => {
    expect(session.outcome.status).toBe('completed')
    expect(history.length).toBeGreaterThanOrEqual(NIXON_BURNS_1972.meetingCount)
  })

  it('opens where the sourced table says and ends far above it', () => {
    expect(history[0].latent.inflationHeadline).toBeCloseTo(3.26, 2)
    // The real mandate ended at 12.1 %. A model that ended near 4 would be a
    // different decade.
    expect(last.inflationHeadline).toBeGreaterThan(8)
  })

  it('never deflates, which the first draft of it did', () => {
    // 1973 inflation was 5.7 % and climbing. The first version of this
    // scenario reached -0.04 % in July 1973, because the demand and food
    // impulses that drove the year were missing and nothing but the model's
    // own pull toward target was left.
    expect(troughInflation).toBeGreaterThan(1.5)
  })

  it('ends with prices and unemployment rising together', () => {
    // The thing the word "stagflation" was invented for, and the one claim
    // this scenario cannot afford to get wrong. Measured against the middle of
    // the mandate rather than the opening, because the opening unemployment is
    // already at a cyclical level.
    const middle = history[Math.floor(history.length / 2)].latent
    expect(last.inflationHeadline).toBeGreaterThan(middle.inflationHeadline)
    expect(last.unemployment).toBeGreaterThan(middle.unemployment)
  })

  it('peaks in the right region rather than merely trending up', () => {
    expect(peakInflation).toBeGreaterThan(9)
    expect(peakInflation).toBeLessThan(18)
  })
})

describe('what was knowable in 1972', () => {
  it('publishes an inflation figure below the truth, because of the controls', () => {
    // The scenario's whole premise, and it has to be visible in what the
    // player is *shown* rather than only in a config field. Controls deferred
    // the appearance of price pressure; a chairman reading the CPI in 1972 saw
    // the lowest inflation in four years.
    const config = createRunConfig({
      institution: 'fed',
      difficulty: 'hard',
      seed: 'NIXON-BIAS',
      scenario: 'nixon_burns_1972',
      simulationVersion: SIMULATION_VERSION,
    })
    let session = startRun(config)
    const gaps: number[] = []
    for (let meeting = 0; meeting < 8; meeting += 1) {
      const published = generateObservation(session.state, {
        meetingIndex: session.state.meetingIndex,
        newswire: [],
        clues: [],
      }).indicators.headline_inflation?.value
      if (published !== null && published !== undefined) {
        gaps.push(published - session.state.latent.inflationHeadline)
      }
      const result = submitMeeting(session, { actions: [], communication: null })
      if (!result.ok) break
      session = result.session
    }
    expect(gaps.length, 'nothing was published to compare').toBeGreaterThan(3)
    // On average below the truth. Not every print, because the regime's noise
    // is still on top of the bias and a test that demanded every single one be
    // low would be testing the random draw.
    const mean = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length
    expect(mean, `published inflation averaged ${mean.toFixed(2)} vs truth`).toBeLessThan(-0.4)
  })

  it('opens with the government already pressing', () => {
    // The only scenario in the game that sets political pressure, and it sets
    // it above the level at which the administration starts asking for things.
    expect(NIXON_BURNS_1972.opening.politicalPressure).toBeGreaterThan(46)
    // And below the level at which it goes public, which is where the record
    // puts January 1972.
    expect(NIXON_BURNS_1972.opening.politicalPressure).toBeLessThan(64)
  })

  it('withholds the instruments this committee did not have', () => {
    // It published no statement, no path and no vote at the time.
    expect(NIXON_BURNS_1972.withheldInstruments).toContain('forward_guidance')
    expect(NIXON_BURNS_1972.withheldInstruments).toContain('asset_purchases')
  })
})

describe('the honesty rules this period needs most', () => {
  it('quotes nobody', () => {
    // The one scenario where a real politician can be named, and therefore the
    // one where inventing a line would do the most damage. `sourced.test.ts`
    // enforces this across every scenario; it is repeated here because this is
    // the file a future edit to this period will be made in.
    for (const event of NIXON_BURNS_1972.events) {
      expect(event.newswire).not.toMatch(/[“"]/)
      expect(event.newswire, event.id).not.toMatch(/\b(said|told|insisted|warned that he)\b/i)
    }
    expect(NIXON_BURNS_1972.briefing).not.toMatch(/[“"]/)
  })

  it('names no living person anywhere the player can read', () => {
    // The scenario is *about* two named men and names neither on screen. The
    // title is a surname and the sources are in the code comments and the
    // document, which is where attribution belongs.
    const onScreen = [
      NIXON_BURNS_1972.briefing,
      NIXON_BURNS_1972.subtitle,
      NIXON_BURNS_1972.benchmarkNote,
      ...NIXON_BURNS_1972.events.flatMap((event) => [event.title, event.newswire]),
    ].join(' ')
    expect(onScreen).not.toMatch(/Nixon/)
    expect(onScreen).not.toMatch(/Burns/)
  })
})
