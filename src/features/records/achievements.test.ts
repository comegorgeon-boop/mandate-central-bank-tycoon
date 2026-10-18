// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  SIMULATION_VERSION,
  createRunConfig,
  calculateScore,
  startRun,
  submitMeeting,
  type PolicyPackage,
  type RunSession,
} from '../../simulation/index.ts'
import { ACHIEVEMENTS, earnedBy, type AchievementContext } from './achievements.ts'
import {
  clearAchievements,
  readAchievements,
  recordAchievements,
} from './storage.ts'

/**
 * Achievements, and the two properties that make them trustworthy.
 *
 * **They are derived.** Every one is a pure predicate over a finished run, so
 * the test for them is a real finished run rather than a hand-built context —
 * a predicate that reads a field the engine does not actually populate would
 * pass any amount of mock-based testing and then silently never fire in the
 * game. So this file plays mandates.
 *
 * **Earned-ness is monotone.** A later mandate that does not repeat a feat
 * must not take it away, because the alternative is a list that forgets what
 * you did, which is worse than having no list.
 */

const HOLD: PolicyPackage = { actions: [], communication: null }

function playToTheEnd(seed: string, options: Partial<Parameters<typeof createRunConfig>[0]> = {}) {
  const config = createRunConfig({
    institution: 'fed',
    difficulty: 'easy',
    seed,
    simulationVersion: SIMULATION_VERSION,
    ...options,
  })
  let session: RunSession = startRun(config)
  for (let guard = 0; guard < 200 && session.outcome.status === 'active'; guard += 1) {
    const result = submitMeeting(session, HOLD)
    if (!result.ok) break
    session = result.session
  }
  return session
}

function contextFor(
  session: RunSession,
  overrides: Partial<AchievementContext> = {},
): AchievementContext {
  return {
    state: session.state,
    decisions: session.decisions,
    score: calculateScore(session.state, session.outcome),
    outcome: session.outcome.triggered ?? 'mandate_completed',
    beatTheStandard: false,
    scenariosCompleted: new Set<string>(),
    ...overrides,
  }
}

describe('achievements are derived from a run that actually happened', () => {
  it('awards serving the term to a mandate that reached its end', () => {
    const session = playToTheEnd('ACH-SERVED')
    const earned = earnedBy(contextFor(session))
    expect(earned, 'a completed mandate earned nothing').toContain('served')
  })

  it('does not award serving the term to a mandate that ended early', () => {
    // Dismissal, resignation, a credibility collapse: whatever ended it, it
    // was not served, and the one achievement everybody gets must still be
    // capable of not being given.
    const session = playToTheEnd('ACH-SERVED')
    const earned = earnedBy(contextFor(session, { outcome: 'dismissed' }))
    expect(earned).not.toContain('served')
  })

  it('reads every field its predicates ask for', () => {
    // The real risk with derived achievements is a predicate that reads a
    // field no snapshot populates — it throws, or quietly never fires. Running
    // all fourteen against a real finished state is what catches that.
    const session = playToTheEnd('ACH-FIELDS')
    const context = contextFor(session)
    for (const achievement of ACHIEVEMENTS) {
      expect(
        () => achievement.earned(context),
        `${achievement.id} threw on a finished mandate`,
      ).not.toThrow()
      expect(typeof achievement.earned(context)).toBe('boolean')
    }
  })

  it('awards nothing for a feat the run did not perform', () => {
    const session = playToTheEnd('ACH-HOLD')
    const earned = earnedBy(contextFor(session))
    // Nothing was moved and no government was answered, so these cannot be in.
    expect(earned).not.toContain('whole_toolkit')
    expect(earned).not.toContain('gave_in')
    expect(earned).not.toContain('beat_the_standard')
  })

  it('notices giving in, which is the point of having the choice', () => {
    const session = playToTheEnd('ACH-YIELD')
    const earned = earnedBy(
      contextFor(session, {
        decisions: [
          {
            meetingIndex: 0,
            package: { actions: [], communication: null, demandResponse: 'yield' },
          },
        ],
      }),
    )
    expect(earned).toContain('gave_in')
  })

  it('requires all six scenarios for the one that says all six', () => {
    const session = playToTheEnd('ACH-SIX')
    const five = new Set([
      'volcker_1979',
      'great_contraction_1929',
      'lehman_2008',
      'euro_crisis_2010',
      'transitory_fed_2021',
    ])
    expect(earnedBy(contextFor(session, { scenariosCompleted: five }))).not.toContain(
      'all_six',
    )
    expect(
      earnedBy(
        contextFor(session, {
          scenariosCompleted: new Set([...five, 'transitory_ecb_2021']),
        }),
      ),
    ).toContain('all_six')
  })

  it('gives every achievement a name and a note', () => {
    // They are shown in a list on the records page, earned or not, so an empty
    // one is a blank row rather than a missing feature.
    for (const achievement of ACHIEVEMENTS) {
      expect(achievement.name.length, achievement.id).toBeGreaterThan(3)
      expect(achievement.note.length, achievement.id).toBeGreaterThan(20)
    }
    const ids = ACHIEVEMENTS.map((a) => a.id)
    expect(new Set(ids).size, 'two achievements share an id').toBe(ids.length)
  })
})

describe('what the browser remembers', () => {
  beforeEach(() => {
    clearAchievements()
  })

  it('keeps an achievement a later mandate did not repeat', () => {
    recordAchievements(['served', 'gave_in'])
    recordAchievements(['served'])
    const kept = readAchievements()
    expect(Object.keys(kept).sort()).toEqual(['gave_in', 'served'])
  })

  it('reports only the ones that are new', () => {
    expect(recordAchievements(['served'])).toEqual(['served'])
    expect(recordAchievements(['served', 'full_marks'])).toEqual(['full_marks'])
    expect(recordAchievements(['served'])).toEqual([])
  })

  it('dates the first time, and does not re-date it', () => {
    recordAchievements(['served'])
    const first = readAchievements().served
    recordAchievements(['served'])
    expect(readAchievements().served).toBe(first)
  })

  it('survives a storage that refuses to write', () => {
    const original = globalThis.localStorage.setItem
    try {
      globalThis.localStorage.setItem = () => {
        throw new Error('quota')
      }
      expect(() => recordAchievements(['served'])).not.toThrow()
    } finally {
      globalThis.localStorage.setItem = original
    }
  })
})
