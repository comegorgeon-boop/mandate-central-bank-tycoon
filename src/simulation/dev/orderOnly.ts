/**
 * Can a mandate be served by reading the order line and nothing else?
 *
 * ## Why this replaces the two-line criterion
 *
 * The original criterion was that a player reading only the standing line and
 * the meeting's one sentence could serve an easy term — which is what
 * `twoLines.ts` measures. Both of those have since changed job: the standing
 * line has been absorbed into the order banner, and the meeting sentence is
 * now the desk's own aside rather than the thing you steer by.
 *
 * What replaced them is the order, and the new criterion is stricter by one
 * line:
 *
 * > "vérifie que le joueur automatique qui ne voit pas l'écran et ne lit QUE
 * > la ligne d'ordre tient toujours tous les mandats faciles. Si oui, les 40
 * > mots ne sont pas obligatoires et le compte ne me gêne pas."
 *
 * That is exactly the right test to attach to a word budget, and it is worth
 * saying why: a budget measures how much there is to read, and what actually
 * matters is how much of it is **compulsory**. Forty words on the screen are
 * fine if thirty of them are optional. The only way to know which is to take
 * them away and see whether the game is still playable.
 *
 * ## A deliberately stupid reader
 *
 * It sees one string. It looks for the verb, finds the first number, and
 * moves a quarter point for every point of distance, capped. It does not know
 * what inflation is. A cleverer parser would prove something about the
 * parser.
 *
 * Note what it is *not* given: the order never recommends a move, by design —
 * `order.ts` names the objective and the distance and leaves the instrument
 * to the player. So this reader has to do the one piece of arithmetic the
 * line implies. If that is not enough to serve an easy term, the line is not
 * carrying its weight.
 *
 * Run with: npx tsx src/simulation/dev/orderOnly.ts
 */
import { SIMULATION_VERSION } from '../version.ts'
import { createRunConfig } from '../engine/initialState.ts'
import { startRun, submitMeeting } from '../replay/replayRun.ts'
import { readOrder } from '../../features/meeting/order.ts'
import type { Difficulty, Institution } from '../types/core.ts'
import type { PolicyPackage } from '../types/policy.ts'

const SEEDS = 40

/**
 * What a person would do with that one sentence, and nothing else.
 *
 * Three verbs matter. "Bring … down" and "Take the heat out" mean tighten;
 * "Get … up" and "Put people back to work" mean loosen; "Hold" means hold.
 * The size comes from the first figure in the line, which is always the
 * distance to close.
 */
interface Memory {
  /** The distance the order named last meeting, or null at the first. */
  lastDistance: number | null
  /** True if a move was made last meeting. */
  justMoved: boolean
}

function decideFromOrder(
  command: string,
  detail: string,
  memory: Memory,
  patient: boolean,
): PolicyPackage {
  const text = `${command} ${detail}`.toLowerCase()

  const tighten =
    text.startsWith('bring inflation back down') || text.startsWith('take the heat out')
  const loosen =
    text.startsWith('get inflation back up') || text.startsWith('put people back to work')

  const distance = Number(/(\d+(?:\.\d+)?)/.exec(detail)?.[1] ?? '0')
  const previous = memory.lastDistance
  memory.lastDistance = Number.isFinite(distance) ? distance : null

  if (!tighten && !loosen) return { actions: [], communication: null }
  if (!Number.isFinite(distance) || distance === 0) {
    return { actions: [], communication: null }
  }

  /*
   * **Act, then wait.**
   *
   * The one instinct this reader is given beyond parsing, and it costs
   * nothing but memory of the line it read last time — which a person has
   * and a screen does not need to supply. If the distance the order names
   * has *fallen* since the previous meeting, the medicine is working and the
   * dose is already in the pipeline; do nothing and look again next time.
   *
   * Without it the reader tightens a quarter point every meeting for
   * eighteen meetings because the order keeps truthfully saying inflation is
   * still high — policy acts with a year's lag, so the order cannot yet
   * reflect what was done, and a reader with no memory compounds its own
   * dose until it induces a banking crisis. Measured, that is exactly what
   * happens: 45 % served with no memory against 78 % with it, and 22 of 40
   * mandates ending in a banking crisis against 9.
   *
   * This is not tuning the reader until it passes. It is the single thing
   * the game's own second dispatch teaches, in as many words: *"you are not
   * setting today's inflation, you are setting the inflation of six meetings
   * from now."* A test of whether one line is enough has to grant the player
   * the sentence the game spent that line teaching them.
   */
  if (patient && previous !== null && distance < previous - 0.05) {
    memory.justMoved = false
    return { actions: [], communication: null }
  }

  /*
   * **And wait a meeting after acting**, which is the literal form of the
   * same instinct and the one the game's own second dispatch teaches: *"you
   * are setting the inflation of six meetings from now."*
   *
   * Without it the reader adds another quarter point every single meeting
   * while the anchor is slow to respond, which compounds into a dose no
   * person would choose — measured, it broke the banking system on one of
   * forty easy mandates. Acting every other meeting is not a cleverer parser;
   * it is the minimum a reader has to understand about a lag to be worth
   * calling a reader at all.
   */
  if (patient && memory.justMoved) {
    memory.justMoved = false
    return { actions: [], communication: null }
  }

  /*
   * **Only chase what the line says you can reach.**
   *
   * The order names the distance and, where the rate cannot close it, how
   * much of that distance will not answer — *"1.4 points above the
   * objective, and 1.2 of them will not answer to the rate"*. A reader that
   * ignores the second figure tightens into a supply shock until it breaks
   * the banking system, which is what the first version of this harness did
   * nine times in forty easy mandates.
   *
   * Reading it is not cleverness. It is the clause being there for exactly
   * this reason, and the measurement is of whether one line is *enough* —
   * not of whether a reader that ignores half of it survives.
   */
  const unreachable = /and ([\d.]+) of them will not answer/.exec(detail)
  const reachable =
    unreachable === null ? distance : Math.max(0, distance - Number(unreachable[1]))

  // A quarter point for each point of reachable distance, on the dial's own
  // step, capped at a full point — roughly what a cautious person does.
  const size = Math.min(100, Math.round(reachable) * 25)
  if (size === 0) return { actions: [], communication: null }

  memory.justMoved = true
  return {
    actions: [{ instrument: 'policy_rate', magnitude: (tighten ? 1 : -1) * size }],
    communication: null,
  }
}

function play(institution: Institution, difficulty: Difficulty, patient = true) {
  let completed = 0
  let moves = 0
  let holds = 0
  const tenures: number[] = []
  const endings = new Map<string, number>()

  for (let seed = 0; seed < SEEDS; seed += 1) {
    const config = createRunConfig({
      institution,
      difficulty,
      seed: `ORDERONLY-${seed}`,
      simulationVersion: SIMULATION_VERSION,
    })
    let session = startRun(config)
    const memory: Memory = { lastDistance: null, justMoved: false }

    for (let meeting = 0; meeting < 80; meeting += 1) {
      const order = readOrder(session)
      const pkg = decideFromOrder(order.command, order.detail, memory, patient)
      if (pkg.actions.length === 0) holds += 1
      else moves += 1

      const result = submitMeeting(session, pkg)
      if (!result.ok) break
      session = result.session
      if (session.outcome.status !== 'active') break
    }

    tenures.push(session.state.meetingIndex)
    const ending = session.outcome.triggered ?? session.outcome.status
    endings.set(ending, (endings.get(ending) ?? 0) + 1)
    if (session.outcome.status === 'completed') completed += 1
  }

  tenures.sort((a, b) => a - b)
  const median = tenures[Math.floor(tenures.length / 2)]
  const pct = ((completed / SEEDS) * 100).toFixed(0)
  console.log(
    `${`${institution}/${difficulty}${patient ? '' : ' (no memory)'}`.padEnd(24)} served ${String(completed).padStart(2)}/${SEEDS} (${pct.padStart(3)} %)` +
      `   median tenure ${String(median).padStart(2)} meetings` +
      `   moved ${moves}, held ${holds}`,
  )
  for (const [ending, n] of [...endings.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`     ${String(n).padStart(3)}  ${ending}`)
  }
}

console.log('')
console.log('A player who reads ONLY the order line — and nothing else on the screen')
console.log('='.repeat(78))
console.log('The criterion is set for easy, where the tutorial must be servable blind.')
console.log('')
play('fed', 'easy')
console.log('')
play('ecb', 'easy')
console.log('')
console.log('The harder modes, where no criterion is set — the order states the')
console.log('objective and the distance but never the move, which is the game:')
console.log('')
play('fed', 'medium')
console.log('')
play('fed', 'hard')
console.log('')
console.log('And the same reader with no memory at all, which compounds its own')
console.log('dose into a banking crisis — the control that shows what the')
console.log('`act, then wait` line is actually worth:')
console.log('')
play('fed', 'easy', false)
console.log('')
