// @vitest-environment node
import { describe, expect, it } from 'vitest'
// The document itself, not a copy of its numbers. See the note below.
import DOC from '../../../docs/SCENARIOS.md?raw'
import { createInitialState, createRunConfig } from '../engine/initialState.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { VOLCKER_1979 } from './volcker.ts'

/**
 * The documented table is the authority.
 *
 * The player's condition for this chantier, and it is not negotiable: *sourced
 * opening states and dates, not invented; record the sources in docs/ and mark
 * explicitly what is approximated; a test that locks the opening figures
 * against the documented table.*
 *
 * So this test **parses `docs/SCENARIOS.md`** and compares it to the code, row
 * by row. Not a copy of the numbers — a copy would drift silently the first
 * time somebody edited one side, which is the failure this is here to prevent.
 * Edit either and the other fails.
 *
 * It follows the same principle as the test that forbids invented brand names
 * and the one that confronts a claim of a null effect with the engine's own
 * arithmetic: a claim the game makes about the world is checked against
 * something outside the sentence that makes it.
 */

/** Every row of the first markdown table whose header starts with `first`. */
function tableRows(first: string): readonly (readonly string[])[] {
  const lines: readonly string[] = DOC.split('\n')
  const start = lines.findIndex((line) => line.startsWith(`| ${first} |`))
  if (start < 0) throw new Error(`No table in docs/SCENARIOS.md headed "${first}"`)
  const rows: string[][] = []
  // +2 skips the header row and the |---|---| separator beneath it.
  for (let index = start + 2; index < lines.length; index += 1) {
    const line = lines[index]
    if (!line.startsWith('|')) break
    rows.push(
      line
        .split('|')
        .slice(1, -1)
        .map((cell: string) => cell.trim()),
    )
  }
  return rows
}

/** The documented opening state, as `quantity -> number`. */
function documentedOpening(): Map<string, number> {
  const values = new Map<string, number>()
  for (const [quantity, value] of tableRows('quantity')) {
    const parsed = Number.parseFloat(value.replace('+', ''))
    if (Number.isFinite(parsed)) values.set(quantity, parsed)
  }
  return values
}

describe('the Volcker scenario matches its documented table', () => {
  const opening = documentedOpening()

  const cases: readonly [string, number][] = [
    ['federal funds rate', VOLCKER_1979.opening.policyRate],
    ['headline CPI inflation', VOLCKER_1979.opening.inflationHeadline],
    ['core CPI inflation', VOLCKER_1979.opening.inflationCore],
    ['unemployment', VOLCKER_1979.opening.unemployment],
    ['natural rate of unemployment', VOLCKER_1979.opening.naturalUnemployment],
    ['output gap', VOLCKER_1979.opening.outputGap],
    ['ten-year Treasury yield', VOLCKER_1979.opening.longRate],
    ['wage growth', VOLCKER_1979.opening.wageGrowth],
    ['one-year inflation expectations', VOLCKER_1979.opening.expectedInflationShort],
  ]

  for (const [quantity, inCode] of cases) {
    it(`opens with the documented ${quantity}`, () => {
      const documented = opening.get(quantity)
      expect(documented, `docs/SCENARIOS.md has no row for "${quantity}"`).toBeDefined()
      expect(inCode).toBe(documented)
    })
  }

  it('documents every sourced opening figure it uses', () => {
    // The other direction: a figure added to the code without a row in the
    // document would otherwise pass unnoticed, since the loop above only
    // checks the rows that exist.
    expect(opening.size).toBe(cases.length)
  })

  it('marks its one approximation as an approximation, in both places', () => {
    // It has no source, and the document has to say so where a reader looking
    // for the source would look.
    expect(DOC).toMatch(/Long-run inflation\s+expectations: 7\.0 %/)
    expect(DOC).toMatch(/One approximation, marked as such/)
    expect(VOLCKER_1979.opening.expectedInflationLong).toBe(7.0)
  })

  it('documents the two quantities it derives rather than observes', () => {
    // Not measurements, and not free parameters either: they are solved out of
    // the engine's own identity from the sourced headline and core prints.
    expect(DOC).toMatch(/supply shock of 0\.74/)
    expect(DOC).toMatch(/import price inflation of 1\.48 %/)
    expect(VOLCKER_1979.opening.supplyShock).toBe(0.74)
    expect(VOLCKER_1979.opening.importPriceInflation).toBe(1.48)
  })

  it('carries the documented calendar, meeting by meeting', () => {
    const rows = tableRows('#')
    expect(rows).toHaveLength(VOLCKER_1979.meetingCount)
    expect(VOLCKER_1979.calendar).toHaveLength(VOLCKER_1979.meetingCount)

    rows.forEach((row, index) => {
      const [number, date, funds] = row
      const meeting = VOLCKER_1979.calendar[index]
      expect(Number(number), `row ${index}`).toBe(index)
      expect(meeting.date, `row ${index} date`).toBe(date)
      expect(meeting.benchmarkRate, `row ${index} funds rate`).toBe(Number(funds))
    })
  })

  it('labels every meeting with the date it is dated by', () => {
    for (const meeting of VOLCKER_1979.calendar) {
      const [year, month, day] = meeting.date.split('-')
      expect(meeting.label, meeting.date).toContain(year)
      expect(meeting.label, meeting.date).toContain(String(Number(day)))
      expect(meeting.label.length, meeting.date).toBeGreaterThan(String(Number(month)).length)
    }
  })

  it('runs the dates forward, and only forward', () => {
    // A calendar that went backwards would be a transcription error nothing
    // else in this file would catch.
    for (let index = 1; index < VOLCKER_1979.calendar.length; index += 1) {
      expect(
        VOLCKER_1979.calendar[index].date > VOLCKER_1979.calendar[index - 1].date,
        VOLCKER_1979.calendar[index].date,
      ).toBe(true)
    }
  })

  it('dates every scripted event to the meeting it is filed under', () => {
    for (const event of VOLCKER_1979.events) {
      const meeting = VOLCKER_1979.calendar[event.meetingIndex]
      expect(meeting, `${event.id} has no meeting`).toBeDefined()
      expect(event.date, event.id).toBe(meeting.date)
    }
  })

  it('puts no words in anybody\'s mouth', () => {
    // The player's rule, verbatim: what they did is in the game; invented
    // words in their mouths are not. Quotation marks in scenario prose are
    // the shape that rule gets broken in, so they are simply not allowed —
    // there are no sourced quotations in this scenario, by choice, and a
    // quotation mark can therefore only be an invented one.
    const prose = [
      VOLCKER_1979.briefing,
      VOLCKER_1979.subtitle,
      VOLCKER_1979.benchmarkNote,
      ...VOLCKER_1979.events.flatMap((event) => [event.title, event.newswire]),
    ]
    for (const text of prose) {
      expect(text, text.slice(0, 60)).not.toMatch(/["""]/)
      // And no attribution verbs, which is how a quotation gets in without
      // quotation marks: "Volcker said that...".
      expect(text, text.slice(0, 60)).not.toMatch(
        /\b(said|says|told|declared|insisted|promised|warned that he)\b/i,
      )
    }
  })
})

describe('the Volcker scenario opens the economy it documents', () => {
  const state = createInitialState(
    createRunConfig({
      institution: 'fed',
      difficulty: 'hard',
      seed: 'VOLCKER-TEST',
      simulationVersion: SIMULATION_VERSION,
      scenario: 'volcker_1979',
    }),
  )

  it('starts at the sourced numbers rather than at a seeded draw', () => {
    expect(state.latent.inflationHeadline).toBe(VOLCKER_1979.opening.inflationHeadline)
    expect(state.latent.inflationCore).toBe(VOLCKER_1979.opening.inflationCore)
    expect(state.latent.unemployment).toBe(VOLCKER_1979.opening.unemployment)
    expect(state.latent.naturalUnemployment).toBe(
      VOLCKER_1979.opening.naturalUnemployment,
    )
    expect(state.latent.outputGap).toBe(VOLCKER_1979.opening.outputGap)
    expect(state.stance.targetRate).toBe(VOLCKER_1979.opening.policyRate)
  })

  it('opens the same way on any seed, because the opening is history', () => {
    const other = createInitialState(
      createRunConfig({
        institution: 'fed',
        difficulty: 'hard',
        seed: 'A-DIFFERENT-SEED',
        simulationVersion: SIMULATION_VERSION,
        scenario: 'volcker_1979',
      }),
    )
    expect(other.latent.inflationHeadline).toBe(state.latent.inflationHeadline)
    expect(other.latent.unemployment).toBe(state.latent.unemployment)
    expect(other.stance.targetRate).toBe(state.stance.targetRate)
  })

  it('takes its institution, rules and length from the scenario', () => {
    expect(state.config.institution).toBe('fed')
    expect(state.config.difficulty).toBe('hard')
    expect(state.config.mode).toBe('historical')
    expect(state.config.meetingCount).toBe(32)
    expect(state.config.scenario).toBe('volcker_1979')
  })

  it('gets no drawn opening crisis: the history is the opening', () => {
    expect(state.eventLog).toHaveLength(0)
  })
})
