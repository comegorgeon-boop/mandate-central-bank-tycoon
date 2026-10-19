/**
 * Can a mandate be served by reading two lines?
 *
 * The criterion, set by the person this game is for:
 *
 * > "Sur facile, un joueur qui ne lit QUE la ligne d'alerte et la phrase de
 * > synthèse doit pouvoir tenir son mandat. Sinon le reste de l'écran est de
 * > la lecture obligatoire, et de la lecture obligatoire vingt-quatre fois
 * > d'affilée, c'est un document, pas un jeu."
 *
 * So this is a player that **cannot see the screen.** It receives two strings
 * — the standing line and the meeting's one sentence — parses them the way a
 * person would read them, and moves the dial. It never touches the
 * observation, the latent state, or any panel. If it serves the term, the
 * rest of the screen is optional. If it cannot, the fast surface is a lie and
 * the player is obliged to read everything.
 *
 * Deliberately a *dumb* reader. It matches a handful of phrases and rounds to
 * a quarter point. A clever parser would prove something about the parser.
 *
 * Run with: npx tsx src/simulation/dev/twoLines.ts
 */
import { SIMULATION_VERSION } from '../version.ts'
import { createRunConfig } from '../engine/initialState.ts'
import { startRun, submitMeeting } from '../replay/replayRun.ts'
import { readStanding } from '../../features/meeting/standing.ts'
import { meetingLine } from '../../features/meeting/meetingLine.ts'
import type { Difficulty, Institution } from '../types/core.ts'
import type { PolicyPackage } from '../types/policy.ts'

const SEEDS = 40

/**
 * What a person would do with those two sentences, and nothing else.
 *
 * The easy sentence names a direction and a size in words ("the staff would
 * raise by a half point"), because easy is the tutorial. That is what this
 * reads. Everything else it can do is read the alarm.
 */
function decideFromText(standing: string, line: string): PolicyPackage {
  const text = `${standing} ${line}`.toLowerCase()

  const size = text.includes('a full point')
    ? 100
    : text.includes('three quarters')
      ? 75
      : text.includes('a half point')
        ? 50
        : text.includes('a quarter point')
          ? 25
          : 0

  const direction = text.includes('would raise') ? 1 : text.includes('would cut') ? -1 : 0

  if (direction === 0 || size === 0) return { actions: [], communication: null }
  return {
    actions: [{ instrument: 'policy_rate', magnitude: direction * size }],
    communication: null,
  }
}

function play(institution: Institution, difficulty: Difficulty) {
  let completed = 0
  let moves = 0
  let holds = 0
  const endings = new Map<string, number>()

  for (let seed = 0; seed < SEEDS; seed += 1) {
    const config = createRunConfig({
      institution,
      difficulty,
      seed: `TWOLINES-${seed}`,
      simulationVersion: SIMULATION_VERSION,
    })
    let session = startRun(config)

    for (let meeting = 0; meeting < 80; meeting += 1) {
      const standing = readStanding(
        session.observation,
        session.outcome,
        session.state.config.institution,
      )
      const line = meetingLine(session) ?? ''
      const pkg = decideFromText(standing.headline, line)
      if (pkg.actions.length === 0) holds += 1
      else moves += 1

      const result = submitMeeting(session, pkg)
      if (!result.ok) break
      session = result.session
      if (session.outcome.status !== 'active') break
    }

    const ending = session.outcome.triggered ?? session.outcome.status
    endings.set(ending, (endings.get(ending) ?? 0) + 1)
    if (session.outcome.status === 'completed') completed += 1
  }

  const pct = ((completed / SEEDS) * 100).toFixed(0)
  console.log(`${institution}/${difficulty}: served ${completed}/${SEEDS} (${pct} %)`)
  console.log(`   moved at ${moves} meetings, held at ${holds}`)
  for (const [ending, n] of [...endings.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`   ${String(n).padStart(3)} ${ending}`)
  }
}

console.log('A player who reads only the standing line and the meeting sentence')
console.log('='.repeat(70))
play('fed', 'easy')
console.log('')
play('ecb', 'easy')
console.log('')
console.log('For comparison, the harder modes — where the criterion is NOT set,')
console.log('because their sentence deliberately refuses to recommend anything:')
play('fed', 'medium')
