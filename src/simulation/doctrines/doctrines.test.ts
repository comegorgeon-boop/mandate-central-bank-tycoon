// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { LatentState, SimulationState } from '../types/state.ts'
import { advanceTrueState } from '../engine/advanceTrueState.ts'
import { applyPolicyPackage } from '../engine/applyPolicyPackage.ts'
import { createInitialState } from '../engine/initialState.ts'
import { generateObservation } from '../observation/generateObservation.ts'
import { HOLD, testConfig } from '../testing/harness.ts'
import { openDebate } from './debate.ts'
import { DOCTRINES, doctrineContext, type DoctrineContext } from './doctrines.ts'

/**
 * Ten schools, and they have to actually disagree.
 *
 * The player's own acceptance test, in their words: *"what each says facing a
 * supply shock — inflation up, unemployment up. That is the test: if two say
 * the same thing, one of the two is badly written."* They will be examined on
 * this material, so an argument that is merely plausible is not good enough;
 * it has to be the position as its own best advocate would state it.
 *
 * ## What the test caught
 *
 * The first version failed it badly, and the failure was structural rather
 * than a matter of wording. Every school was wired to take a *fraction of the
 * published Taylor benchmark* — and that benchmark reacts to headline
 * inflation, so under a cost-push shock it runs away and drags everyone with
 * it. Measured: seven of the ten recommended the identical maximum move,
 * including three whose entire position is that you should not tighten into a
 * relative price change. They were not badly argued, they were badly wired.
 *
 * The schools that say "look through the first-round effect" are now anchored
 * on `coreTaylorGap` — the same rule reading the measure that strips out the
 * shock it says to look through, which is that sentence written as arithmetic.
 * The room now spreads from −150 to +150 on the same state.
 */

/** A cost-push economy: headline well past core, labour market weak. */
function costPush(latent: LatentState): LatentState {
  return {
    ...latent,
    inflationHeadline: 5.4,
    inflationCore: 2.9,
    supplyShock: 2.0,
    importPriceInflation: 13,
    unemployment: latent.naturalUnemployment + 1.5,
    outputGap: -1.5,
    expectedInflationLong: 2.15,
    expectedInflationShort: 3.2,
    bankingStress: 26,
    assetPricePressure: -5,
    exchangeRate: 97,
    policyRate: 3.0,
  }
}

/**
 * The context at a meeting several quarters into a supply shock.
 *
 * Held steady across five meetings rather than injected once, because the
 * statistics carry a publication lag: at the meeting after a shock nothing has
 * been published and every school is reasoning from an empty table, which is a
 * real situation and the wrong one to test disagreement on.
 */
function supplyShockContext(): DoctrineContext {
  let state: SimulationState = createInitialState(
    testConfig('ecb', 'medium', 'doctrines'),
    { openingEvent: false, tutorialDamage: false },
  )
  state = { ...state, stance: { ...state.stance, targetRate: 3.0 } }

  // Advanced until the two prints the schools argue from have both actually
  // arrived. Releases go missing on a seeded draw, and a fixture that stopped
  // at a fixed meeting would sometimes hand every school an empty table and
  // then assert that they disagree about it.
  let observation = generateObservation(state, {
    meetingIndex: 0,
    newswire: [],
    clues: [],
  })
  for (let meeting = 0; meeting < 12; meeting += 1) {
    const applied = applyPolicyPackage(
      { ...state, latent: costPush(state.latent) },
      HOLD,
    )
    if (!applied.ok) break
    const advanced = advanceTrueState({
      ...applied.state,
      latent: costPush(applied.state.latent),
    })
    state = {
      ...advanced,
      latent: costPush(advanced.latent),
      history: advanced.history.map((snapshot) => ({
        ...snapshot,
        latent: costPush(snapshot.latent),
      })),
    }
    observation = generateObservation(state, {
      meetingIndex: state.meetingIndex,
      newswire: [],
      clues: [],
    })
    const published =
      observation.indicators.headline_inflation?.value != null &&
      observation.indicators.core_inflation?.value != null &&
      observation.indicators.unemployment?.value != null
    if (published && meeting >= 3) break
  }

  return doctrineContext({
    observation,
    institution: 'ecb',
    currentRate: state.stance.targetRate,
    lastMove: 0,
    meetingIndex: state.meetingIndex,
    maxMove: 150,
  })
}

describe('each school is a real one, stated as its own advocate would', () => {
  for (const doctrine of DOCTRINES) {
    describe(doctrine.id, () => {
      it('cites who argued it', () => {
        expect(doctrine.authorities.length).toBeGreaterThan(0)
        for (const authority of doctrine.authorities) {
          // A name, and a year or an institution. "Some economists" is not a
          // citation and a player revising from this needs to be able to look
          // it up.
          expect(authority, authority).toMatch(/[A-Z]/)
          expect(authority.length, authority).toBeGreaterThan(6)
        }
      })

      it('states a claim independent of any one state of the world', () => {
        expect(doctrine.creed.length).toBeGreaterThan(60)
      })

      it('argues at length and quotes what it is arguing from', () => {
        const view = doctrine.view(supplyShockContext())
        expect(view.argument.length, doctrine.id).toBeGreaterThan(180)
        expect(view.evidence.length, doctrine.id).toBeGreaterThan(20)
      })

      it('recommends a move on the grid the committee moves on', () => {
        const view = doctrine.view(supplyShockContext())
        expect(Math.abs(view.basisPoints % 25), doctrine.id).toBe(0)
        expect(Math.abs(view.basisPoints), doctrine.id).toBeLessThanOrEqual(150)
      })

      it('says nothing a reader would have to un-learn', () => {
        // No adviser may name a real person as having said something here —
        // the authorities are citations, and the arguments are the school's.
        const view = doctrine.view(supplyShockContext())
        const text = `${view.argument} ${doctrine.creed} ${doctrine.counter}`
        expect(text, doctrine.id).not.toMatch(/["“”]/)
      })
    })
  }
})

describe('under a supply shock, no two say the same thing', () => {
  const ctx = supplyShockContext()

  it('is actually a supply shock', () => {
    // The fixture has to be the situation being tested, or the whole file is
    // asserting disagreement about something else.
    const headline = ctx.observation.indicators.headline_inflation!.value!
    const core = ctx.observation.indicators.core_inflation!.value!
    const unemployment = ctx.observation.indicators.unemployment!.value!
    expect(headline - core).toBeGreaterThan(1.5)
    expect(headline).toBeGreaterThan(ctx.target + 2)
    expect(unemployment).toBeGreaterThan(ctx.natural + 0.5)
  })

  it('spreads the room across the full width of the instrument', () => {
    const views = DOCTRINES.filter((d) => d.speaks(ctx)).map(
      (d) => d.view(ctx).basisPoints,
    )
    // Not a committee nodding: some want the maximum tightening available and
    // some want the maximum easing.
    expect(Math.max(...views) - Math.min(...views)).toBeGreaterThanOrEqual(200)
  })

  it('keeps the look-through schools from being dragged by the headline', () => {
    // The structural failure this test caught. The schools whose position is
    // that a relative price change should be accommodated must not be
    // recommending a large tightening into one.
    for (const id of ['keynesian', 'hysteresis', 'new_keynesian'] as const) {
      const doctrine = DOCTRINES.find((entry) => entry.id === id)!
      expect(doctrine.view(ctx).basisPoints, id).toBeLessThan(75)
    }
    // And the two that say resolve is the whole answer must be asking for it.
    for (const id of ['rule', 'credibility_hawk'] as const) {
      const doctrine = DOCTRINES.find((entry) => entry.id === id)!
      expect(doctrine.view(ctx).basisPoints, id).toBeGreaterThan(75)
    }
  })

  it('gives no two schools the same argument', () => {
    // The player's test, read on the *reasoning* rather than the number: two
    // schools can arrive at "hold" from premises that share nothing, and the
    // premises are the content. Compared on the words each actually uses.
    const speaking = DOCTRINES.filter((doctrine) => doctrine.speaks(ctx))
    const fingerprints = speaking.map((doctrine) => ({
      id: doctrine.id,
      words: new Set(
        doctrine
          .view(ctx)
          .argument.toLowerCase()
          .split(/[^a-z]+/)
          .filter((word) => word.length > 5),
      ),
    }))

    for (let i = 0; i < fingerprints.length; i += 1) {
      for (let j = i + 1; j < fingerprints.length; j += 1) {
        const a = fingerprints[i]
        const b = fingerprints[j]
        const shared = [...a.words].filter((word) => b.words.has(word)).length
        const overlap = shared / Math.min(a.words.size, b.words.size)
        expect(
          overlap,
          `${a.id} and ${b.id} argue from the same words`,
        ).toBeLessThan(0.5)
      }
    }
  })

  it('keeps the two conditional schools quiet unless the state calls them', () => {
    // They are the point when they appear, and noise if they appear always.
    const quiet = createInitialState(testConfig('fed', 'medium', 'doctrines'), {
      openingEvent: false,
      tutorialDamage: false,
    })
    const calm = doctrineContext({
      observation: generateObservation(quiet, {
        meetingIndex: 0,
        newswire: [],
        clues: [],
      }),
      institution: 'fed',
      currentRate: quiet.stance.targetRate,
      lastMove: 0,
      meetingIndex: 0,
      maxMove: 150,
    })
    for (const id of ['fiscal_dominance', 'neo_fisherian'] as const) {
      const doctrine = DOCTRINES.find((entry) => entry.id === id)!
      expect(doctrine.speaks(calm), id).toBe(false)
    }
  })
})

describe('the debate seats disagreement, not a rota', () => {
  const ctx = supplyShockContext()

  it('seats at most three and never two of the same mind', () => {
    const debate = openDebate(ctx)
    expect(debate.speakers.length).toBeGreaterThan(1)
    expect(debate.speakers.length).toBeLessThanOrEqual(3)

    const moves = debate.speakers.map((speaker) => speaker.view.basisPoints)
    expect(new Set(moves).size, 'two speakers recommending the same move').toBe(
      moves.length,
    )
  })

  it('seats the two ends of the room', () => {
    const debate = openDebate(ctx)
    const all = DOCTRINES.filter((d) => d.speaks(ctx)).map(
      (d) => d.view(ctx).basisPoints,
    )
    const moves = debate.speakers.map((speaker) => speaker.view.basisPoints)
    expect(Math.max(...moves)).toBe(Math.max(...all))
    expect(Math.min(...moves)).toBe(Math.min(...all))
  })

  it('orders them hawkish to dovish, so the table reads as a spectrum', () => {
    const moves = openDebate(ctx).speakers.map((speaker) => speaker.view.basisPoints)
    for (let i = 1; i < moves.length; i += 1) {
      expect(moves[i]).toBeLessThan(moves[i - 1])
    }
  })

  it('has someone address someone else, by name', () => {
    const debate = openDebate(ctx)
    const rebuttal = debate.speakers.find((speaker) => speaker.rebuttal !== null)
    expect(rebuttal?.rebuttal).toBeTruthy()
    // Named, and named correctly: lowercasing "The Keynesian" would give "the
    // keynesian", which is why the address form is stored rather than derived.
    const named = debate.speakers.some((speaker) =>
      rebuttal!.rebuttal!.includes(speaker.doctrine.addressAs),
    )
    expect(named, rebuttal!.rebuttal!).toBe(true)
    expect(rebuttal!.rebuttal!).not.toMatch(/\bkeynesian\b/)
  })

  it('leaves the rest available rather than lost', () => {
    const debate = openDebate(ctx)
    const seated = debate.speakers.length
    const standing = DOCTRINES.filter((d) => d.speaks(ctx)).length
    expect(debate.silent).toHaveLength(standing - seated)
  })
})
