/**
 * Why does a long tenure go quiet at the end?
 *
 * Prints, for one long mandate, how many events are eligible at each meeting
 * and which gate is removing the rest. The "never more than two calm meetings"
 * guarantee is enforced by a forced fire when `meetingsSinceEvent >= 2`, and a
 * forced fire can only fire something that is *eligible* — so if the
 * eligibility filter empties, the guarantee silently stops holding.
 *
 * Run with: npx tsx src/simulation/dev/dryspell.ts
 */
import { SIMULATION_VERSION } from '../version.ts'
import { createRunConfig } from '../engine/initialState.ts'
import { startRun, submitMeeting } from '../replay/replayRun.ts'
import { toolkitPackage } from '../policy/toolkitRule.ts'
import { EVENT_CATALOG } from '../events/catalog.ts'

const config = createRunConfig({
  institution: 'fed',
  difficulty: 'hard',
  seed: 'POOL-0',
  simulationVersion: SIMULATION_VERSION,
})
let session = startRun(config)

const occurrences: Record<string, number> = {}
const lastOccurrence: Record<string, number> = {}

console.log('mtg  landed  spent  on-cooldown  capped  ineligible-now')
console.log('='.repeat(70))

for (let meeting = 0; meeting < 70; meeting += 1) {
  const result = submitMeeting(session, toolkitPackage(session, 'fed', 'hard'))
  if (!result.ok) break
  session = result.session
  const records = [
    ...(session.majorEvent === null ? [] : [session.majorEvent]),
    ...session.minorEvents,
  ]
  for (const record of records) {
    occurrences[record.eventId] = (occurrences[record.eventId] ?? 0) + 1
    lastOccurrence[record.eventId] = session.state.meetingIndex
  }

  const index = session.state.meetingIndex
  let capped = 0
  let cooling = 0
  for (const event of EVENT_CATALOG) {
    if (!event.institutions.includes('fed')) continue
    if ((occurrences[event.id] ?? 0) >= event.maxOccurrences) {
      capped += 1
      continue
    }
    const last = lastOccurrence[event.id]
    if (last !== undefined && index - last < event.cooldownMeetings) cooling += 1
  }

  if (index >= 40 || records.length > 0) {
    console.log(
      `${String(index).padStart(3)}  ${records.length > 0 ? 'yes   ' : ' no   '}  ` +
        `${String(session.state.eventLog.length).padStart(5)}  ` +
        `${String(cooling).padStart(11)}  ${String(capped).padStart(6)}`,
    )
  }
  if (session.outcome.status !== 'active') break
}
