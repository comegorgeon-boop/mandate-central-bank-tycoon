import type { SimulationState } from '../types/state.ts'
import type { ShockCharacter } from '../types/events.ts'
import { EVENTS_BY_ID } from '../events/catalog.ts'
import { SUBSTEPS_PER_MEETING } from '../config/time.ts'

/**
 * What is currently hitting the economy, and what to do about it.
 *
 * ## The brief
 *
 * > "LES CHOCS SONT DES LIGNES VIVANTES DU TERMINAL. Deux ou trois au
 * > maximum, dans leur propre panneau. Chacune : ce que c'est, ce que ça fait
 * > à chacun de mes deux chiffres, COMBIEN DE TEMPS IL LUI RESTE — montré par
 * > une barre qui se vide, pas par un chiffre — et COMMENT ON LE TRAITE.
 * > Quand un choc meurt, sa ligne disparaît."
 *
 * And the reason it matters more than any other panel:
 *
 * > "L'EXPLICATION DES CHOCS DEVIENT LA CHOSE LA PLUS VISIBLE DE L'ÉCRAN.
 * > C'est presque le plus important du jeu : qu'est-ce qu'il y a, et comment
 * > on le traite. Aujourd'hui c'est enterré dans la presse, et lire la presse
 * > à chaque réunion est trop lourd."
 *
 * Which is exactly right and was exactly the defect. A shock's whole life was
 * in the newswire: a headline when it landed, then nothing, while its effects
 * went on arriving for eight meetings through a lag kernel the player could
 * not see. The cause was in a newspaper and the consequence was in a chart,
 * and nothing joined them.
 *
 * ## The treatment is the content
 *
 * > "Sers-toi du vrai contenu : un choc d'offre ne répond pas aux taux comme
 * > un choc de demande, et c'est exactement ce que je dois comprendre."
 *
 * That distinction is the oldest real thing in monetary policy and the engine
 * already models it — `shockCharacter` is on every event in the catalogue and
 * the scorecard already rewards leaning against demand and looking through
 * supply. The player has never been told. `treatment` below is that rule,
 * said out loud, per shock.
 */

export interface LiveShock {
  readonly eventId: string
  readonly title: string
  /** What kind of shock, which decides the treatment. */
  readonly character: ShockCharacter
  /** 0..1, how much of its life is left. Drives a draining bar. */
  readonly remaining: number
  /** Meetings until the last queued effect lands. */
  readonly meetingsLeft: number
  /** Signed effect still to arrive, in points of inflation. */
  readonly onInflation: number
  /** Signed effect still to arrive, in points of unemployment. */
  readonly onJobs: number
  /** What to do about it, from its character. */
  readonly treatment: string
}

/** Which latent variables count as reaching inflation and jobs. */
const TO_INFLATION = new Set([
  'supplyShock',
  'inflationHeadline',
  'inflationCore',
  'importPriceInflation',
  'expectedInflationShort',
])
const TO_JOBS = new Set(['outputGap', 'unemployment', 'potentialGrowth', 'demandShock'])

/**
 * How a shock of each character should be handled.
 *
 * Not opinion: the first-round effects of a supply shock move output and
 * prices in *opposite* directions, so there is no setting of one instrument
 * that fixes both, and the job becomes holding the anchor while it passes. A
 * demand shock moves them the same way and has a right answer. The scorecard
 * has rewarded this distinction all along in `shockResponseScore`.
 */
const TREATMENT: Readonly<Record<ShockCharacter, string>> = {
  supply:
    'Look through it. Prices and output are moving opposite ways, so no rate ' +
    'fixes both — crushing demand to offset a price that has already moved ' +
    'buys unemployment and not much else. Guard the anchor instead.',
  demand:
    'Lean against it. Prices and output are moving the same way, which is the ' +
    'one case the rate is built for and the one case where there is a right ' +
    'answer.',
  financial:
    'The rate is not the instrument here. A frightened banking system does ' +
    'not pass a cut on; the facilities and the balance sheet reach where the ' +
    'dial no longer does.',
  institutional:
    'This one is about you, not the economy. What is being tested is whether ' +
    'the institution can be leaned on — and the answer the rate gives is less ' +
    'important than the answer your record gives.',
}

/**
 * The shocks still arriving, largest first.
 *
 * Only what is still *to come* is counted. An event whose effects have all
 * landed is history: it is in the charts, the player has already lived it, and
 * a panel that kept showing it would be a log rather than a dashboard. That is
 * what "quand un choc meurt, sa ligne disparaît" means mechanically.
 */
export function liveShocks(state: SimulationState, limit = 3): readonly LiveShock[] {
  const out: LiveShock[] = []

  for (const record of state.eventLog) {
    const definition = EVENTS_BY_ID.get(record.eventId)
    if (definition === undefined) continue

    let onInflation = 0
    let onJobs = 0
    let lastStep = -1

    for (const queued of record.delayed) {
      // Already landed: not news, and not this panel's business.
      if (queued.fireAtStep <= state.stepIndex) continue
      lastStep = Math.max(lastStep, queued.fireAtStep)
      for (const effect of queued.effects) {
        if (TO_INFLATION.has(effect.variable)) onInflation += effect.delta
        if (TO_JOBS.has(effect.variable)) onJobs -= effect.delta
      }
    }

    if (lastStep < 0) continue

    const stepsLeft = lastStep - state.stepIndex
    const stepsTotal = Math.max(1, lastStep - record.meetingIndex * SUBSTEPS_PER_MEETING)

    out.push({
      eventId: record.eventId,
      title: record.title,
      character: definition.shockCharacter,
      remaining: Math.max(0, Math.min(1, stepsLeft / stepsTotal)),
      meetingsLeft: Math.max(1, Math.round(stepsLeft / SUBSTEPS_PER_MEETING)),
      onInflation,
      onJobs,
      treatment: TREATMENT[definition.shockCharacter],
    })
  }

  // Largest first, by how much is still to arrive. Two or three at most: the
  // brief is explicit, and a list of nine live shocks is the thing this panel
  // exists to stop being.
  return out
    .sort(
      (a, b) =>
        Math.abs(b.onInflation) + Math.abs(b.onJobs) - Math.abs(a.onInflation) - Math.abs(a.onJobs),
    )
    .slice(0, limit)
}
