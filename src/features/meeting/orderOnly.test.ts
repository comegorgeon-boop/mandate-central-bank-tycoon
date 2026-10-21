// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  SIMULATION_VERSION,
  createRunConfig,
  startRun,
  submitMeeting,
  type Institution,
} from '../../simulation/index.ts'
import { readOrder } from './order.ts'

/**
 * The guarantee behind the word budget, as a test rather than a harness.
 *
 * > "LE PLAFOND À 60 MOTS : d'accord, et on gèle là pour de bon. Mais la vraie
 * > garantie n'est pas le nombre, c'est le joueur automatique qui ne lit QUE
 * > la ligne d'ordre et tient encore 40 mandats faciles sur 40. C'est ce
 * > chiffre-là que je veux voir à chaque fois."
 *
 * So it runs on every `npm test` instead of only when somebody remembers the
 * harness. A word cap measures how much there is to read; what matters is how
 * much of it is *compulsory*, and the only way to know is to take the rest
 * away and see whether the game is still playable.
 *
 * `dev/orderOnly.ts` is the same reader with the diagnostics and the harder
 * modes for comparison — this is the one bar that must hold.
 */

const SEEDS = 40

interface Memory {
  lastDistance: number | null
  justMoved: boolean
}

/**
 * A deliberately stupid reader: one sentence in, a rate move out.
 *
 * It parses the verb, takes the distance, subtracts whatever the line says
 * will not answer to the rate, and moves a quarter point per remaining point
 * — then waits a meeting, because policy acts with a lag and that is the one
 * thing the game's own guidance teaches. Kept in step with `dev/orderOnly.ts`
 * on purpose; if they ever diverge the harness is the place to look first.
 */
function decide(command: string, detail: string, memory: Memory) {
  const text = `${command} ${detail}`.toLowerCase()
  const tighten =
    text.startsWith('bring inflation back down') || text.startsWith('take the heat out')
  const loosen =
    text.startsWith('get inflation back up') || text.startsWith('put people back to work')

  const distance = Number(/(\d+(?:\.\d+)?)/.exec(detail)?.[1] ?? '0')
  const previous = memory.lastDistance
  memory.lastDistance = Number.isFinite(distance) ? distance : null

  const hold = { actions: [], communication: null } as const
  if (!tighten && !loosen) return hold
  if (!Number.isFinite(distance) || distance === 0) return hold
  if (previous !== null && distance < previous - 0.05) {
    memory.justMoved = false
    return hold
  }
  if (memory.justMoved) {
    memory.justMoved = false
    return hold
  }

  const unreachable = /and ([\d.]+) of them will not answer/.exec(detail)
  const reachable =
    unreachable === null ? distance : Math.max(0, distance - Number(unreachable[1]))
  const size = Math.min(100, Math.round(reachable) * 25)
  if (size === 0) return hold

  memory.justMoved = true
  return {
    actions: [{ instrument: 'policy_rate' as const, magnitude: (tighten ? 1 : -1) * size }],
    communication: null,
  }
}

describe('a player who reads only the order line can still serve the tutorial', () => {
  for (const institution of ['fed', 'ecb'] as Institution[]) {
    it(`serves every easy mandate on ${institution}, reading one sentence`, () => {
      let served = 0
      const lost: string[] = []

      for (let seed = 0; seed < SEEDS; seed += 1) {
        const config = createRunConfig({
          institution,
          difficulty: 'easy',
          seed: `ORDERONLY-${seed}`,
          simulationVersion: SIMULATION_VERSION,
        })
        let session = startRun(config)
        const memory: Memory = { lastDistance: null, justMoved: false }

        for (let meeting = 0; meeting < 80; meeting += 1) {
          const order = readOrder(session)
          const result = submitMeeting(session, decide(order.command, order.detail, memory))
          if (!result.ok) break
          session = result.session
          if (session.outcome.status !== 'active') break
        }

        if (session.outcome.status === 'completed') served += 1
        else lost.push(`${seed}:${session.outcome.triggered ?? 'active'}`)
      }

      expect(
        served,
        `${institution}/easy: ${served}/${SEEDS} served. Lost: ${lost.join(', ')}. ` +
          'If this falls below 40, the order line has stopped carrying the ' +
          'mandate on its own and the words on the rest of the screen are no ' +
          'longer optional — which is the only thing that makes the 60-word ' +
          'budget defensible.',
      ).toBe(SEEDS)
    })
  }
})
