import type { Doctrine, DoctrineContext, DoctrineView } from './doctrines.ts'
import { doctrineViews } from './doctrines.ts'

/**
 * Who speaks at this meeting, and what they say to each other.
 *
 * Ten advisers in the room and two or three at the table, chosen by
 * **disagreement** rather than by rota. Two opposed cases argued well teach
 * more than ten shaded ones, and the player's standing instruction is that
 * nothing may go back onto a screen this session spent a month clearing.
 *
 * The selection is not "the two loudest": it is the two furthest apart, and
 * then a third that is furthest from *both* rather than sitting between them.
 * A midpoint adds a number without adding an argument — the third chair is
 * only worth filling by someone holding a genuinely separate position.
 *
 * ## Why a conditional school always gets a chair
 *
 * Fiscal dominance and the neo-Fisherian case speak rarely and only when the
 * state calls them. When one does, it is by construction the most interesting
 * thing being said in the room — an idea the player has probably been taught
 * as fringe, arriving in the one situation where it fits — so it is seated
 * ahead of the ranking rather than competing with it.
 */

export interface DoctrineSpeaker {
  readonly doctrine: Doctrine
  readonly view: DoctrineView
  /**
   * A line addressed to another speaker, by name. Null for the speaker with
   * nobody meaningfully opposite them.
   */
  readonly rebuttal: string | null
}

export interface Debate {
  readonly speakers: readonly DoctrineSpeaker[]
  /** Everyone with standing who was not called, available on request. */
  readonly silent: readonly { readonly doctrine: Doctrine; readonly view: DoctrineView }[]
  /** The spread of the room, in basis points. Zero when they agree. */
  readonly disagreement: number
}

/** How many chairs there are at the table. */
const CHAIRS = 3

/**
 * Basis points of difference below which two schools are not disagreeing.
 *
 * A quarter point: the smallest move the committee can make, so anything
 * inside it is two people recommending the same decision.
 */
const REAL_DISAGREEMENT = 25

export function openDebate(ctx: DoctrineContext): Debate {
  const all = doctrineViews(ctx)
  if (all.length === 0) {
    return { speakers: [], silent: [], disagreement: 0 }
  }

  // The two ends of the room.
  const sorted = [...all].sort((a, b) => a.view.basisPoints - b.view.basisPoints)
  const dove = sorted[0]
  const hawk = sorted[sorted.length - 1]
  const disagreement = hawk.view.basisPoints - dove.view.basisPoints

  const chosen: { doctrine: Doctrine; view: DoctrineView }[] = []
  const seat = (entry: { doctrine: Doctrine; view: DoctrineView }): void => {
    if (!chosen.some((held) => held.doctrine.id === entry.doctrine.id)) {
      chosen.push(entry)
    }
  }

  // A conditional school that has standing is seated first: it speaks rarely,
  // and when it does it is the most interesting thing in the room.
  for (const entry of all) {
    if (entry.doctrine.id === 'fiscal_dominance' || entry.doctrine.id === 'neo_fisherian') {
      seat(entry)
    }
  }

  seat(hawk)
  seat(dove)

  // The third chair goes to whoever is furthest from everyone already seated —
  // a separate position, never a midpoint.
  while (chosen.length < CHAIRS) {
    let best: { doctrine: Doctrine; view: DoctrineView } | null = null
    let bestDistance = -1
    for (const entry of all) {
      if (chosen.some((held) => held.doctrine.id === entry.doctrine.id)) continue
      const distance = Math.min(
        ...chosen.map((held) =>
          Math.abs(held.view.basisPoints - entry.view.basisPoints),
        ),
      )
      if (distance > bestDistance) {
        bestDistance = distance
        best = entry
      }
    }
    if (best === null || bestDistance < REAL_DISAGREEMENT) break
    seat(best)
  }

  // Ordered hawkish to dovish, so the table reads as a spectrum rather than a
  // list in the order the selection happened to find them.
  const seated = [...chosen].sort(
    (a, b) => b.view.basisPoints - a.view.basisPoints,
  )

  const speakers: DoctrineSpeaker[] = seated.map((entry, index) => {
    // Each speaker addresses whoever is furthest from them, which is the only
    // pairing where a rebuttal is about something.
    let opponent: (typeof seated)[number] | null = null
    let widest = 0
    for (const other of seated) {
      if (other.doctrine.id === entry.doctrine.id) continue
      const gap = Math.abs(other.view.basisPoints - entry.view.basisPoints)
      if (gap > widest) {
        widest = gap
        opponent = other
      }
    }

    return {
      doctrine: entry.doctrine,
      view: entry.view,
      // Only the first speaker rebuts, and only where the gap is real. Three
      // rebuttals is three paragraphs; one is an argument.
      rebuttal:
        index === 0 && opponent !== null && widest >= REAL_DISAGREEMENT
          ? entry.doctrine.counter.replace('{other}', opponent.doctrine.addressAs)
          : null,
    }
  })

  return {
    speakers,
    silent: all.filter(
      (entry) => !seated.some((held) => held.doctrine.id === entry.doctrine.id),
    ),
    disagreement,
  }
}
