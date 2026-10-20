/**
 * Does a banking crisis still frighten, or has it become decoration?
 *
 * > "Donne-moi la plus longue série calme sur 40 parties, et la sévérité
 * > ressentie — je veux savoir si une crise bancaire fait encore peur ou si
 * > elle est devenue décorative."
 *
 * The question is sharp and the obvious measurements do not answer it. Peak
 * banking stress says how big the number got, not whether it mattered. Event
 * counts say how often it happened, which is the opposite of what is being
 * asked — a shock that arrives constantly and costs nothing is *precisely*
 * what decoration means, and counting it would make decoration look like
 * danger.
 *
 * So severity is measured in the only currency the player now has:
 *
 *  1. **Points destroyed.** Mean banked quality in the three meetings before a
 *     major lands against the three after. A crisis that costs nothing to
 *     bank is a crisis the game does not charge for.
 *  2. **Against a minor, as a control.** This is the load-bearing half. If a
 *     major and a minor destroy the same number of points, majors are
 *     decorative *however large their numbers look* — the word "major" would
 *     then be a label on the event table rather than a fact about the game.
 *  3. **Career risk.** The share of mandates a banking crisis actually ends.
 *     Fear is the chance of losing the job, and nothing else in a survival
 *     structure is.
 *  4. **Recovery.** How many meetings it takes for banked quality to come back
 *     to where it was. A shock you are over by the next meeting is a weather
 *     report.
 *
 * Run with: npx tsx src/simulation/dev/severity.ts
 */
import { SIMULATION_VERSION } from '../version.ts'
import { createRunConfig } from '../engine/initialState.ts'
import { startRun, submitMeeting } from '../replay/replayRun.ts'
import { toolkitPackage } from '../policy/toolkitRule.ts'
import { isMajorEvent } from '../events/catalog.ts'
import { getInstrument, getInstrumentRange } from '../config/instruments.ts'
import { instrumentRangesFor, inflationTargetFor } from '../scenarios/scenarios.ts'
import { meetingQuality } from '../scoring/banked.ts'
import { BANKED } from '../config/scoring.ts'
import type { Difficulty, Institution } from '../types/core.ts'

const SEEDS = 40
const WINDOW = 3

interface Landing {
  readonly meeting: number
  readonly major: boolean
  readonly banking: boolean
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN
  return values.reduce((a, b) => a + b, 0) / values.length
}

function measure(institution: Institution, difficulty: Difficulty) {
  const majorCost: number[] = []
  const minorCost: number[] = []
  const bankingCost: number[] = []
  const recovery: number[] = []
  let mandates = 0
  let endedByBanking = 0
  let endedAtAll = 0
  let peakStress = 0

  for (let seed = 0; seed < SEEDS; seed += 1) {
    const config = createRunConfig({
      institution,
      difficulty,
      seed: `SEVERITY-${seed}`,
      simulationVersion: SIMULATION_VERSION,
    })
    let session = startRun(config)
    mandates += 1
    const target = inflationTargetFor(config)
    const landings: Landing[] = []

    for (let meeting = 0; meeting < 70; meeting += 1) {
      const full = toolkitPackage(session, institution, difficulty)
      const move = full.actions.find((a) => a.instrument === 'policy_rate')
      const instrument = getInstrument('policy_rate')
      const range =
        instrument === undefined
          ? { min: -150, max: 150 }
          : getInstrumentRange(
              instrument,
              difficulty,
              instrumentRangesFor(session.state.config),
            )
      const result = submitMeeting(session, {
        actions:
          move === undefined
            ? []
            : [
                {
                  instrument: 'policy_rate' as const,
                  magnitude: Math.max(range.min, Math.min(range.max, move.magnitude)),
                },
              ],
        communication: null,
      })
      if (!result.ok) break
      session = result.session

      const records = [
        ...(session.majorEvent === null ? [] : [session.majorEvent]),
        ...session.minorEvents,
      ]
      for (const record of records) {
        const major = isMajorEvent(record.eventId)
        landings.push({
          meeting: session.state.meetingIndex,
          major,
          banking:
            record.eventId.includes('bank') ||
            record.eventId.includes('credit') ||
            record.eventId.includes('panic'),
        })
      }
      peakStress = Math.max(peakStress, session.state.latent.bankingStress)
      if (session.outcome.status !== 'active') break
    }

    if (session.outcome.status !== 'active') {
      endedAtAll += 1
      if (session.outcome.triggered === 'banking_crisis') endedByBanking += 1
    }

    // The quality of every meeting actually served, from the same function the
    // score uses — so what is reported here is literally what was banked.
    const quality = session.state.history
      .slice(1)
      .map((snapshot) => meetingQuality(snapshot, institution, target).quality)

    for (const landing of landings) {
      // `history[0]` is the opening state, so meeting N is quality[N - 1].
      const at = landing.meeting - 1
      const before = quality.slice(Math.max(0, at - WINDOW), at)
      const after = quality.slice(at, at + WINDOW)
      if (before.length < WINDOW || after.length < WINDOW) continue

      const cost = (mean(before) - mean(after)) * BANKED.meetingPoints
      if (landing.major) majorCost.push(cost)
      else minorCost.push(cost)
      if (landing.banking) bankingCost.push(cost)

      if (landing.major) {
        // How many meetings until quality is back within a tenth of where it
        // was. Capped at twelve, which is a year and a half: longer than that
        // and the shock has stopped being an event and become the economy.
        const baseline = mean(before)
        let back = 12
        for (let step = 0; step < 12; step += 1) {
          const q = quality[at + step]
          if (q !== undefined && q >= baseline - 0.1) {
            back = step
            break
          }
        }
        recovery.push(back)
      }
    }
  }

  const majors = mean(majorCost)
  const minors = mean(minorCost)
  const ratio = minors === 0 ? Number.NaN : majors / minors

  console.log(
    `${`${institution}/${difficulty}`.padEnd(13)}` +
      `major −${majors.toFixed(0).padStart(3)} pts  ` +
      `minor −${minors.toFixed(0).padStart(3)} pts  ` +
      `ratio ${ratio.toFixed(1).padStart(4)}x  ` +
      `banking −${mean(bankingCost).toFixed(0).padStart(3)} pts  ` +
      `recover ${mean(recovery).toFixed(1).padStart(4)} mtgs  ` +
      `peak stress ${peakStress.toFixed(0).padStart(3)}  ` +
      `ended by banking ${((endedByBanking / mandates) * 100).toFixed(0).padStart(2)} % ` +
      `of ${mandates} (${((endedAtAll / mandates) * 100).toFixed(0)} % ended at all)`,
  )
}

console.log('')
console.log('Felt severity — what a shock costs in banked points')
console.log(
  'Decorative would be: ratio near 1 (a major costs what a minor costs), or a',
)
console.log('recovery of 0-1 meetings, or a banking crisis that never ends a career.')
console.log('='.repeat(132))
for (const [institution, difficulty] of [
  ['fed', 'medium'],
  ['fed', 'hard'],
  ['ecb', 'medium'],
  ['ecb', 'hard'],
] as const) {
  measure(institution, difficulty)
}
console.log('')
