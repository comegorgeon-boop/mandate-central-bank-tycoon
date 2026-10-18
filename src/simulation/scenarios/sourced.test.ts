// @vitest-environment node
import { describe, expect, it } from 'vitest'
// The document itself, not a copy of its numbers. See the note below.
import DOC from '../../../docs/SCENARIOS.md?raw'
import type { Scenario, ScenarioId } from '../types/scenario.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { createInitialState, createRunConfig } from '../engine/initialState.ts'
import { SCENARIOS } from './scenarios.ts'

/**
 * The documented table is the authority, for all six scenarios.
 *
 * The player's condition, and it is not negotiable: *sourced opening states and
 * dates, not invented; record the sources in docs/ and mark explicitly what is
 * approximated; a test that locks the opening figures against the documented
 * table.*
 *
 * So this **parses `docs/SCENARIOS.md`** and compares it to the code, scenario
 * by scenario, row by row. Not a copy of the numbers — a copy would drift
 * silently the first time somebody edited one side, which is the failure this
 * is here to prevent.
 *
 * ## How the document is addressed
 *
 * Each scenario's section opens with an HTML comment naming its id:
 *
 *     <!-- scenario: lehman_2008 -->
 *
 * Everything between that marker and the next one is that scenario's. The
 * markers exist because the first version of this test took the *first* table
 * in the file headed `| quantity |`, which was correct while there was one
 * scenario and silently checked 1929's code against 1979's document the moment
 * there were two.
 *
 * ## What is deliberately not checked here
 *
 * The *prose* of the document — the sources, the derivations, the arguments for
 * each calibrated parameter — is not machine-checkable and is not checked. What
 * is checked is every number a player's mandate actually runs on. A reader who
 * wants to know whether the argument is good still has to read it.
 */

/** The slice of the document belonging to one scenario. */
function sectionFor(id: ScenarioId): string {
  const marker = `<!-- scenario: ${id} -->`
  const start = DOC.indexOf(marker)
  if (start < 0) throw new Error(`docs/SCENARIOS.md has no section for ${id}`)
  const rest = DOC.slice(start + marker.length)
  const next = rest.indexOf('<!-- scenario: ')
  return next < 0 ? rest : rest.slice(0, next)
}

/** Every row of the first table in `section` whose header starts with `first`. */
function tableRows(section: string, first: string): readonly (readonly string[])[] {
  const lines = section.split('\n')
  const start = lines.findIndex((line) => line.startsWith(`| ${first} |`))
  if (start < 0) throw new Error(`No table headed "${first}"`)
  const rows: string[][] = []
  // +2 skips the header row and the |---|---| separator beneath it.
  for (let index = start + 2; index < lines.length; index += 1) {
    const line = lines[index]
    if (!line.startsWith('|')) break
    rows.push(line.split('|').slice(1, -1).map((cell) => cell.trim()))
  }
  return rows
}

/**
 * A number out of a documented cell.
 *
 * Tolerates the typographic minus sign, because the prose of this document
 * uses it and the tables are written by hand around generated rows.
 */
function parse(cell: string): number {
  return Number.parseFloat(cell.replace('+', '').replace('−', '-'))
}

/** The documented opening state, as `quantity -> number`. */
function documentedOpening(section: string): Map<string, number> {
  const values = new Map<string, number>()
  for (const [quantity, value] of tableRows(section, 'quantity')) {
    const parsed = parse(value)
    if (Number.isFinite(parsed)) values.set(quantity, parsed)
  }
  return values
}

/**
 * Which documented opening row corresponds to which field in the code.
 *
 * Keyed by the *document's* wording, because the document is the authority and
 * the wording is what a reader checks against a source. A scenario whose
 * document invents a new row name will fail the completeness check below rather
 * than pass silently.
 */
const OPENING_FIELDS: Readonly<Record<string, keyof Scenario['opening']>> = {
  'federal funds rate': 'policyRate',
  'federal funds target': 'policyRate',
  'federal funds target, upper': 'policyRate',
  'discount rate': 'policyRate',
  'main refinancing rate': 'policyRate',
  'headline CPI inflation': 'inflationHeadline',
  'headline HICP inflation': 'inflationHeadline',
  'core CPI inflation': 'inflationCore',
  'core HICP inflation': 'inflationCore',
  unemployment: 'unemployment',
  'natural rate of unemployment': 'naturalUnemployment',
  'output gap': 'outputGap',
  'ten-year Treasury yield': 'longRate',
  'German ten-year yield': 'longRate',
  'commercial paper rate': 'longRate',
  'wage growth': 'wageGrowth',
  'one-year inflation expectations': 'expectedInflationShort',
  'long-run inflation expectations': 'expectedInflationLong',
  'TED spread': 'creditSpread',
  'Italy-Germany ten-year spread': 'fragmentation',
}

describe.each(SCENARIOS.map((scenario) => [scenario.id, scenario] as const))(
  '%s matches its documented table',
  (id, scenario) => {
    const section = sectionFor(id)
    const opening = documentedOpening(section)

    it('documents every opening figure it uses, and uses every one it documents', () => {
      // Both directions. A figure added to the code without a row in the
      // document would otherwise pass unnoticed, and a row added to the
      // document that the code ignores is a claim the game does not keep.
      for (const quantity of opening.keys()) {
        expect(
          OPENING_FIELDS[quantity],
          `docs/SCENARIOS.md row "${quantity}" in ${id} maps to no field. ` +
            `Add it to OPENING_FIELDS, or correct the document.`,
        ).toBeDefined()
      }
      expect(opening.size, `${id} documents too few opening rows`).toBeGreaterThan(8)
    })

    it('opens on the documented numbers', () => {
      for (const [quantity, documented] of opening) {
        const field = OPENING_FIELDS[quantity]
        if (field === undefined) continue
        expect(scenario.opening[field], `${id}: ${quantity}`).toBe(documented)
      }
    })

    it('carries the documented calendar, meeting by meeting', () => {
      const rows = tableRows(section, '#')
      expect(rows, `${id} calendar length`).toHaveLength(scenario.meetingCount)
      expect(scenario.calendar).toHaveLength(scenario.meetingCount)

      rows.forEach((row, index) => {
        const meeting = scenario.calendar[index]
        const [number, date, rate, ...outcomes] = row
        expect(Number(number), `${id} row ${index}`).toBe(index)
        expect(meeting.date, `${id} row ${index} date`).toBe(date)
        expect(meeting.benchmarkRate, `${id} row ${index} rate`).toBe(parse(rate))

        // The outcome columns, in the order the headers give them. A scenario
        // whose series does not exist prints an em dash and carries undefined,
        // and the two have to agree about that too — this is the check that
        // stops a missing euro-area unemployment print being quietly filled in
        // with the nearest month.
        const fields = ['actualInflation', 'actualCore', 'actualUnemployment'] as const
        const present = fields.filter((field) =>
          scenario.calendar.some((entry) => entry[field] !== undefined),
        )
        present.forEach((field, column) => {
          const cell = outcomes[column]
          const inCode = meeting[field]
          if (cell === undefined || cell === '—') {
            expect(inCode, `${id} row ${index} ${field} should be absent`).toBeUndefined()
          } else {
            expect(inCode, `${id} row ${index} ${field}`).toBe(parse(cell))
          }
        })
      })
    })

    it('labels every meeting with the date it is dated by', () => {
      for (const meeting of scenario.calendar) {
        const [year, , day] = meeting.date.split('-')
        expect(meeting.label, meeting.date).toContain(year)
        // 1929-33 is labelled by month, because that institution had no
        // meeting calendar; everything else carries the day.
        if (scenario.id !== 'great_contraction_1929') {
          expect(meeting.label, meeting.date).toContain(String(Number(day)))
        }
      }
    })

    it('runs the dates forward, and only forward', () => {
      for (let index = 1; index < scenario.calendar.length; index += 1) {
        expect(
          scenario.calendar[index].date > scenario.calendar[index - 1].date,
          `${id} ${scenario.calendar[index].date}`,
        ).toBe(true)
      }
    })

    it('dates every scripted event inside the interval it fires in', () => {
      // A scheduled event fires *after* the decision at its meeting, so its
      // effects land in the interval between that meeting and the next. Its
      // real date therefore has to sit in that window — which is a stronger
      // check than equality and the only one that works for 1929-33, whose
      // slots are months and whose events are days: Britain left gold on
      // 21 September 1931, between the August and October slots, and the
      // scenario files it under August because that is the last meeting the
      // committee held before it happened.
      for (const event of scenario.events) {
        const meeting = scenario.calendar[event.meetingIndex]
        const next = scenario.calendar[event.meetingIndex + 1]
        expect(meeting, `${event.id} has no meeting`).toBeDefined()
        expect(event.date >= meeting.date, `${event.id} before its meeting`).toBe(true)
        if (next !== undefined) {
          expect(
            event.date < next.date,
            `${event.id} (${event.date}) is after the next meeting, ${next.date}`,
          ).toBe(true)
        }
      }
    })

    it("puts no words in anybody's mouth", () => {
      // The player's rule, verbatim: what they did is in the game; invented
      // words in their mouths are not. Quotation marks in scenario prose are
      // the shape that rule gets broken in, so they are simply not allowed —
      // there are no sourced quotations in any scenario, by choice, and a
      // quotation mark can therefore only be an invented one. This bites
      // hardest in the euro-area scenarios, where the most famous sentence in
      // that institution's history was said inside the window.
      const prose = [
        scenario.briefing,
        scenario.subtitle,
        scenario.benchmarkNote,
        ...scenario.events.flatMap((event) => [event.title, event.newswire]),
      ]
      for (const text of prose) {
        expect(text, text.slice(0, 60)).not.toMatch(/["“”]/)
        // And no attribution verbs, which is how a quotation gets in without
        // quotation marks.
        expect(text, text.slice(0, 60)).not.toMatch(
          /\b(said|says|told|declared|insisted|promised|warned that he)\b/i,
        )
      }
    })

    it('opens the economy it documents, on any seed', () => {
      const open = (seed: string) =>
        createInitialState(
          createRunConfig({
            institution: scenario.institution,
            difficulty: scenario.rules,
            seed,
            simulationVersion: SIMULATION_VERSION,
            scenario: id,
          }),
        )
      const a = open(`${id}-A`)
      const b = open(`${id}-B`)

      expect(a.latent.inflationHeadline).toBe(scenario.opening.inflationHeadline)
      expect(a.latent.inflationCore).toBe(scenario.opening.inflationCore)
      expect(a.latent.unemployment).toBe(scenario.opening.unemployment)
      expect(a.latent.outputGap).toBe(scenario.opening.outputGap)
      expect(a.stance.targetRate).toBe(scenario.opening.policyRate)
      // The opening is history, so it is the same on every seed. What the seed
      // changes is everything that happens afterwards.
      expect(b.latent.inflationHeadline).toBe(a.latent.inflationHeadline)
      expect(b.latent.unemployment).toBe(a.latent.unemployment)
    })
  },
)

describe('the document covers what the code ships', () => {
  it('has a section for every scenario and no section for anything else', () => {
    const marked = [...DOC.matchAll(/<!-- scenario: ([a-z0-9_]+) -->/g)].map(
      (match) => match[1],
    )
    expect([...marked].sort()).toEqual(SCENARIOS.map((s) => s.id).sort())
  })

  it('lists every scenario in its summary table', () => {
    // The table at the top is how a reader finds out what exists. One that
    // listed five of six would be the document lying about the thing it is
    // the authority on.
    const summary = DOC.slice(0, DOC.indexOf('<!-- scenario:'))
    for (const scenario of SCENARIOS) {
      expect(summary, scenario.id).toContain(scenario.title.replace('The ', ''))
    }
  })
})
