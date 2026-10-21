import { describe, expect, it } from 'vitest'
import { EVENT_CATALOG, EVENTS_BY_ID } from './catalog.ts'
import { eligibleEvents } from './resolveEvent.ts'
import type { EventContext } from '../types/events.ts'
import { createRunConfig, startRun } from '../index.ts'
import { SIMULATION_VERSION } from '../version.ts'

/**
 * Events that are episodes rather than weather.
 *
 * The catalogue's one real claim is this: **a second act fires only if the
 * first was not contained.** A committee that brought expectations back after
 * an energy spike does not meet the second-round effects; one that let them
 * drift does. That is the only place in this file where what the player did
 * between two meetings decides what arrives at the third, and it is worth a
 * test of its own, because nothing else would notice it breaking — a chain
 * whose gate silently inverted would still produce a playable mandate full of
 * plausible headlines.
 *
 * Two properties, then. The chain must be **reachable** — an escalation that
 * can never fire is content nobody will ever see, which this project has
 * shipped before. And it must be **escapable** — one that fires regardless of
 * the state is a punishment rather than a consequence.
 */

function contextFrom(
  overrides: Partial<EventContext['latent']> = {},
  occurrences: Record<string, number> = {},
): EventContext {
  const config = createRunConfig({
    institution: 'fed',
    difficulty: 'hard',
    seed: 'CHAINS',
    simulationVersion: SIMULATION_VERSION,
  })
  const session = startRun(config)
  return {
    latent: { ...session.state.latent, ...overrides },
    members: [],
    institution: 'fed',
    difficulty: 'hard',
    meetingIndex: 8,
    meetingCount: 24,
    stepIndex: 32,
    occurrences,
    lastOccurrence: Object.fromEntries(
      Object.keys(occurrences).map((id) => [id, 2]),
    ),
    unlockedFollowUps: [],
    openerId: null,
  }
}

/** The three second acts, with the onset and the state that lets them happen. */
const CHAINS = [
  {
    escalation: 'second_round_effects',
    onset: 'energy_price_spike',
    uncontained: { expectedInflationShort: 4.2 },
    contained: { expectedInflationShort: 2.1 },
  },
  {
    escalation: 'wage_price_spiral',
    onset: 'wage_round_breakout',
    uncontained: { expectedInflationLong: 3.6, wageGrowth: 5.4 },
    contained: { expectedInflationLong: 2.1, wageGrowth: 3.2 },
  },
  {
    escalation: 'capital_flight',
    onset: 'currency_pressure',
    // `exchangeRate` is an index around 100. Lower is a weaker currency —
    // which is exactly the confusion that made the live gate unreachable, so
    // the fixture says so rather than repeating it.
    uncontained: { exchangeRate: 80, marketVolatility: 40 },
    contained: { exchangeRate: 98, marketVolatility: 14 },
  },
] as const

describe('a second act requires a first', () => {
  for (const chain of CHAINS) {
    it(`${chain.escalation} cannot fire before ${chain.onset}`, () => {
      const ids = eligibleEvents(contextFrom(chain.uncontained, {})).map((e) => e.id)
      expect(ids).not.toContain(chain.escalation)
    })

    it(`${chain.escalation} is reachable once ${chain.onset} has happened and was not contained`, () => {
      const ids = eligibleEvents(
        contextFrom(chain.uncontained, { [chain.onset]: 1 }),
      ).map((e) => e.id)
      expect(
        ids,
        'the escalation can never fire: this is content no player will meet',
      ).toContain(chain.escalation)
    })

    it(`${chain.escalation} does not fire when it was contained`, () => {
      // The whole design. A committee that brought the variable back is spared
      // — and spared by the *state of the economy*, not by having chosen an
      // approved instrument.
      const ids = eligibleEvents(
        contextFrom(chain.contained, { [chain.onset]: 1 }),
      ).map((e) => e.id)
      expect(ids).not.toContain(chain.escalation)
    })
  }
})

describe('the catalogue is wired to itself', () => {
  it('names only events that exist', () => {
    for (const event of EVENT_CATALOG) {
      for (const id of [...event.followUps, ...event.requires]) {
        expect(
          EVENTS_BY_ID.has(id),
          `${event.id} names "${id}", which is not in the catalogue`,
        ).toBe(true)
      }
    }
  })

  it('never requires an event that cannot precede it', () => {
    // A `requires` pointing at something with a higher `minDifficulty` is a
    // chain that is unreachable at the difficulty the escalation claims to
    // belong to — silently, since the escalation is simply never eligible.
    const rank = { easy: 0, medium: 1, hard: 2 } as const
    for (const event of EVENT_CATALOG) {
      for (const id of event.requires) {
        const onset = EVENTS_BY_ID.get(id)!
        expect(
          rank[onset.minDifficulty] <= rank[event.minDifficulty],
          `${event.id} (${event.minDifficulty}) requires ${id} (${onset.minDifficulty})`,
        ).toBe(true)
      }
    }
  })

  it('never gates good news behind permission', () => {
    // `character.test.ts` records the reasoning and it governs here too: a
    // relief that needs a predecessor is a relief the player may never meet,
    // and the worse the shock the less able the economy would be to recover.
    // Escalations are gated; reliefs never are.
    for (const id of [
      'energy_price_relief',
      'supply_chain_normalisation',
      'gas_supply_restored',
      'geopolitical_dealescalation',
      'currency_appreciation',
      'fiscal_consolidation',
    ]) {
      expect(EVENTS_BY_ID.get(id)?.requires, id).toEqual([])
    }
  })

  it('leaves the mandate-defining crises ungated', () => {
    // They are drawn as opening crises too, before the first meeting and so
    // before any predecessor can exist. Their chain lives in the weight.
    for (const event of EVENT_CATALOG) {
      if (event.tier !== 'major') continue
      expect(event.requires, `${event.id} is major and gated`).toEqual([])
    }
  })

  it('declares no follow-up that nothing acts on', async () => {
    // A `followUps` entry is a claim that this event changes what can happen
    // next. Nothing in the engine enforces that: `followUps` only unlocks, and
    // an id listed there that no other event gates or weights on is decorative
    // — it reads in the source like a designed consequence and behaves like
    // none. Half the entries added in this pass were exactly that before this
    // test existed.
    //
    // "Acts on" means one of two things, which are the only two mechanisms
    // there are: the target `requires` this event, or the target's weight
    // names it (`afterOnset`, `whenContained`).
    const source = (await import('./catalog.ts?raw')).default
    const blockFor = (id: string) => {
      const at = source.indexOf(`id: '${id}'`)
      return source.slice(source.lastIndexOf('\n  {\n', at), source.indexOf('\n  },\n', at))
    }
    for (const event of EVENT_CATALOG) {
      for (const id of event.followUps) {
        const target = EVENTS_BY_ID.get(id)!
        const acted =
          target.requires.includes(event.id) || blockFor(id).includes(`'${event.id}'`)
        expect(
          acted,
          `${event.id} lists ${id} as a follow-up, but ${id} neither requires ` +
            `it nor weights on it: the link is decoration`,
        ).toBe(true)
      }
    }
  })

  it('gives every chained family a reachable second act', () => {
    // The measurement that justified this pass: before it, 2 of 33 events had
    // a follow-up. A catalogue where nothing leads to anything is a sequence
    // of unrelated accidents, and no decision between two of them matters.
    const chained = EVENT_CATALOG.filter((event) => event.followUps.length > 0)
    expect(chained.length).toBeGreaterThanOrEqual(12)
  })
})
