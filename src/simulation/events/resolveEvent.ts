import type {
  EventContext,
  EventEffect,
  EventResolution,
  GameEvent,
  PendingEventEffect,
  ResolvedEventRecord,
} from '../types/events.ts'
import type { SimulationState } from '../types/state.ts'
import type { DiagnosticEvent } from '../types/core.ts'
import { restorePrng } from '../rng/prng.ts'
import { INSTITUTIONAL } from '../config/model.ts'
import { inflationImpulse } from './inflationImpulse.ts'
import { clampLatentState } from '../config/bounds.ts'
import { DIFFICULTY_ORDER, getDifficulty, meetsDifficulty } from '../config/difficulty.ts'
import { applyEffects } from '../engine/advanceTrueState.ts'
import { EVENT_CATALOG } from './catalog.ts'
import { applyMemberShocks } from './memberShocks.ts'
import { NEUTRAL_BAND, immediateInflationImpulse } from './inflationImpulse.ts'
import { measurementRegime, scenarioOf } from '../scenarios/scenarios.ts'

/**
 * Procedural event resolution.
 *
 * Called once per inter-meeting interval, after the player's package has been
 * applied and before the economy is advanced, so an event lands *between*
 * meetings rather than on top of a decision.
 *
 * Eligibility and weights are pure functions of the economy, so the menu of
 * possible events is a property of the state; only which one is drawn from
 * that menu consumes randomness.
 */

/** Assembles the read-only view handed to event predicates. */
export function buildEventContext(state: SimulationState): EventContext {
  const occurrences: Record<string, number> = {}
  const lastOccurrence: Record<string, number> = {}
  const unlocked = new Set<string>()

  for (const record of state.eventLog) {
    occurrences[record.eventId] = (occurrences[record.eventId] ?? 0) + 1
    lastOccurrence[record.eventId] = record.meetingIndex
    const definition = EVENT_CATALOG.find((event) => event.id === record.eventId)
    for (const followUp of definition?.followUps ?? []) unlocked.add(followUp)
  }

  return {
    latent: state.latent,
    members: state.members,
    institution: state.config.institution,
    difficulty: state.config.difficulty,
    meetingIndex: state.meetingIndex,
    meetingCount: state.config.meetingCount,
    stepIndex: state.stepIndex,
    occurrences,
    lastOccurrence,
    unlockedFollowUps: [...unlocked],
    openerId:
      state.eventLog.length > 0 && state.eventLog[0].meetingIndex === 0
        ? state.eventLog[0].eventId
        : null,
  }
}

/**
 * Whether a second cost-push shock may land on the one already running.
 *
 * Only *adverse* supply events are held back: a relief is the thing that ends
 * the episode, and gating it on the same ceiling would mean the worse the
 * shock the less able the economy is to recover from it. The reading is of
 * what the event delivers on the day, not over its whole arc — see
 * `immediateInflationImpulse`.
 */
function costPushBlocked(event: GameEvent, ctx: EventContext): boolean {
  const ceiling = getDifficulty(ctx.difficulty).costPushCeiling
  if (!Number.isFinite(ceiling)) return false
  if (event.shockCharacter !== 'supply') return false
  if (ctx.latent.supplyShock <= ceiling) return false
  return immediateInflationImpulse(event, ctx) > NEUTRAL_BAND
}

/** Events that could fire in this state, before any random draw. */
/**
 * The length of mandate `maxOccurrences` was authored against.
 *
 * Every cap in the catalogue — "a banking crisis at most twice", "this one
 * only once" — was written while a mandate was 16 or 24 meetings, so each is
 * really a statement about *density*: twice in three years, not twice ever.
 */
const CATALOGUE_REFERENCE_MEETINGS = 24

/**
 * How many times an event may fire in a mandate of this length.
 *
 * ## The regression this fixes
 *
 * The guarantee the cadence work bought — *never more than two consecutive
 * meetings with nothing to decide* — was measured on fixed-length mandates
 * and held at exactly 2. Re-measured under tenure, where a mandate can run to
 * 64 meetings, it came back at **4** on fed/medium and **9** on fed/hard.
 *
 * The cause was not the draw and not the Minsky hazard, both of which keep
 * working. It was this cap. `maxOccurrences` was being read as a limit *per
 * run*, so by the fortieth meeting most of the catalogue had retired, the
 * eligible set had emptied, and the forced fire that enforces the guarantee
 * had nothing left to fire. A guarantee implemented as "fire something" fails
 * silently and completely the moment there is nothing to fire.
 *
 * The principle, rather than raising the numbers by hand: a cap authored
 * against a 24-meeting mandate is a statement about how often something may
 * happen, so it scales with the horizon. Two banking crises in three years is
 * plausible; insisting on no more than two in *eight* years is below the
 * historical rate, and it is what produced a silent nine-meeting lull.
 */
export function occurrenceCap(
  event: { readonly maxOccurrences: number },
  meetingCount: number,
): number {
  /*
   * Every cap scales, including the ones set to one.
   *
   * A first attempt froze `maxOccurrences: 1` as "structural", which looked
   * principled and was wrong in a way the balance test caught immediately.
   * The seven events capped at one are the *big* ones — banking_failure,
   * market_panic, housing_market_crash, supply_rupture. Freezing those while
   * the ordinary events stretched 2.7× did not preserve the catalogue, it
   * diluted the majors out of any long mandate: eight years in which a
   * banking failure may happen at most once is not a harder game, it is a
   * quieter one, and the delivered inflation impulse drifted outside its band
   * because the mix had changed underneath it.
   *
   * The thing that actually needs to happen once — the opening crisis — is
   * excluded in `eligibleEvents` instead, where it belongs: it is the economy
   * you were handed, not an event you drew.
   */
  const scale = Math.max(1, meetingCount / CATALOGUE_REFERENCE_MEETINGS)
  return Math.ceil(event.maxOccurrences * scale)
}

export function eligibleEvents(
  ctx: EventContext,
  catalog: readonly GameEvent[] = EVENT_CATALOG,
): readonly GameEvent[] {
  return catalog.filter((event) => {
    if (!event.institutions.includes(ctx.institution)) return false
    if (!meetsDifficulty(ctx.difficulty, event.minDifficulty)) return false
    if (costPushBlocked(event, ctx)) return false
    if (
      event.maxDifficulty !== undefined &&
      DIFFICULTY_ORDER[ctx.difficulty] > DIFFICULTY_ORDER[event.maxDifficulty]
    ) {
      return false
    }

    /*
     * The opening crisis never recurs.
     *
     * It is drawn from this same catalogue but it is not a drawn event: it is
     * the state of the economy at meeting zero, written into the log before
     * the player has done anything. Handing someone the same catastrophe
     * again in year six as though it were news is a category error, and it is
     * exactly what `openingCrisis.test.ts` guards.
     *
     * Identified by position rather than by a flag on the record, because
     * position is what makes it the opener — meeting zero is before the first
     * decision, and nothing else can land there.
     */
    if (ctx.openerId === event.id) return false

    const seen = ctx.occurrences[event.id] ?? 0
    if (seen >= occurrenceCap(event, ctx.meetingCount)) return false

    const last = ctx.lastOccurrence[event.id]
    if (last !== undefined && ctx.meetingIndex - last < event.cooldownMeetings) {
      return false
    }

    for (const required of event.requires) {
      if ((ctx.occurrences[required] ?? 0) === 0) return false
    }

    return event.isEligible(ctx)
  })
}

/**
 * Selection weights for a set of eligible events, in the same order.
 *
 * The difficulty's `shockMix` scales each event by what it *asks of the
 * committee* — a demand shock has a right answer, a supply shock has only a
 * choice of which half of the mandate to sacrifice — so the diet of problems
 * a mode serves is a property of the mode rather than of the draw.
 */
function selectionWeights(
  events: readonly GameEvent[],
  ctx: EventContext,
  /** False for a historical scenario — see the note on the bias below. */
  emergentCrises: boolean,
): readonly number[] {
  const mix = getDifficulty(ctx.difficulty).shockMix

  // Minsky in the *selection*, not only in the rate. A long calm does not
  // merely make something more likely to happen, it decides what kind of
  // thing happens: leverage built quietly for three years is not discharged
  // by a wage round, it is discharged by a bank failing. So fragility biases
  // the draw toward the mandate-defining crises, which is the half of the
  // hypothesis a hazard multiplier alone cannot express.
  //
  // It is also what makes three or four majors a mandate reachable at all:
  // they carry a `baseWeight` around 0.15 against ordinary events at 1.0,
  // and no plausible change to the firing rate would have surfaced them.
  // Fictional mandates only, for the same reason the hazard is — see the
  // note at the draw. A scenario's crises are dated; biasing its drawn stream
  // toward *more* crises on top of the ones history already supplied is how
  // 1929-33 went from eleven seeds in twelve serving a full term to three.
  const built = emergentCrises ? ctx.latent.fragility / 100 : 0
  const majorBias = 1 + INSTITUTIONAL.fragility.majorBias * built

  return events.map((event) => {
    const multiplier = event.weight(ctx) * mix[event.shockCharacter]
    if (!Number.isFinite(multiplier) || multiplier <= 0) return 0
    const bias = event.tier === 'major' ? majorBias : 1
    return event.baseWeight * multiplier * bias
  })
}

/** Most warning signals published at one meeting. */
const MAX_CLUES = 2

/**
 * How far above a uniform share a risk must stand out before it is flagged.
 *
 * Without this, a meeting with ten roughly equal candidates would publish a
 * warning for every one of them, which is the same as publishing none.
 */
const CLUE_PROMINENCE = 1.6

/**
 * Warning signals for risks that carry enough probability mass to be worth
 * flagging. Deterministic: the player is warned about genuine risk, not by a
 * separate coin flip.
 */
function buildClues(
  ctx: EventContext,
  threshold: number,
  emergentCrises: boolean,
): readonly string[] {
  const events = eligibleEvents(ctx)
  // The same weights the draw will use, so the warning a player reads is a
  // warning about the distribution they actually face.
  const weights = selectionWeights(events, ctx, emergentCrises)
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  if (total <= 0) return []

  // An event has to be both absolutely likely and conspicuous relative to the
  // rest of the field, so a crowded menu of equal risks stays quiet.
  const bar = Math.max(threshold, CLUE_PROMINENCE / events.length)

  return events
    .map((event, index) => ({ clue: event.clue, share: weights[index] / total }))
    .filter((entry) => entry.clue !== null && entry.share >= bar)
    .sort((a, b) => b.share - a.share)
    .slice(0, MAX_CLUES)
    .map((entry) => entry.clue as string)
}

/** Scales an event's effects by the difficulty's severity multiplier. */
export function scaleEffects(
  effects: readonly EventEffect[],
  scale: number,
): readonly EventEffect[] {
  return effects.map((effect) => ({ ...effect, delta: effect.delta * scale }))
}

export function resolveEvent(
  state: SimulationState,
  catalog: readonly GameEvent[] = EVENT_CATALOG,
): EventResolution {
  // `measurementRegime`, not `getDifficulty`: a scenario sets its own length
  // and therefore its own event dials. See `Scenario.eventSeverityScale`.
  const difficulty = measurementRegime(state.config)
  const prng = restorePrng(state.rng)
  const ctx = buildEventContext(state)

  const scenarioNow = scenarioOf(state.config)
  const candidates = eligibleEvents(ctx, catalog).filter(
    (event) => !(scenarioNow?.suppressedFamilies.includes(event.family) ?? false),
  )

  // The draw is consumed unconditionally so that whether an event fires never
  // shifts the random sequence the rest of the run depends on.
  //
  // A historical scenario thins this stream rather than switching it off: the
  // dated events make the mandate recognisable as 1979-83, and the drawn ones
  // are the whole reason two seeds of it are different mandates.
  const scenario = scenarioNow

  // Minsky, at the point of the draw. Fragility built by calm raises the
  // hazard, which is the whole correction: a well-run economy used to make
  // this generator fall silent, and a played mandate reported eight
  // consecutive meetings with nothing to decide. See `LatentState.fragility`.
  const fr = INSTITUTIONAL.fragility
  // **Fictional mandates only.**
  //
  // Minsky explains why an invented economy generates its own crises, which
  // is exactly the hole it was built to fill: a well-run fictional mandate
  // had nothing happen in it for eight meetings. A historical period does not
  // need explaining — its crises are dated, they are in the calendar, and
  // they happened for reasons the scenario already states. Piling an emergent
  // hazard on top of 1929-33 took the share of seeds serving a full term from
  // eleven in twelve to three, which is not a harder scenario, it is a
  // different one.
  const built = scenarioNow === null ? state.latent.fragility / 100 : 0
  const hazard = 1 + (fr.hazard - 1) * built
  const severity =
    difficulty.eventSeverityScale * (1 + (fr.severity - 1) * built)

  // The draw is consumed either way, so forcing the outcome below never
  // shifts the random sequence the rest of the run depends on.
  const drawn = prng.bernoulli(
    Math.min(
      0.97,
      difficulty.eventProbability * (scenario?.proceduralEventScale ?? 1) * hazard,
    ),
  )
  // Never a third quiet meeting. A stated rule, not a model result — see
  // `LatentState.meetingsSinceEvent` for why a probability could not keep
  // this promise however steep it was made.
  const fires =
    drawn || (scenarioNow === null && state.latent.meetingsSinceEvent >= 2)
  // When the fire is *forced* — two quiet meetings have passed — the draw is
  // narrowed to the events that are not good news.
  //
  // The rule says the accumulated imbalance surfaces, and an imbalance
  // surfacing as an energy price *relief* is nonsense. It also broke the
  // catalogue's own invariant: in a calm economy the eligible set skews
  // benign, so forcing a draw from it made the catalogue net disinflationary
  // by itself — exactly what `balance.test.ts` exists to forbid. Measured at
  // −0.16 per meeting on fed/medium against a floor of −0.08.
  const forced = !drawn
  const pool = forced
    ? candidates.filter((candidate) => inflationImpulse(candidate, ctx) > -0.05)
    : candidates
  const usable = pool.length > 0 ? pool : candidates
  const weights = selectionWeights(usable, ctx, scenarioNow === null)
  const index = prng.weightedIndex(weights)

  if (!fires || index < 0) {
    return {
      state: {
        ...state,
        latent: {
          ...state.latent,
          meetingsSinceEvent: state.latent.meetingsSinceEvent + 1,
        },
        rng: prng.getState(),
      },
      resolved: [],
      clues: buildClues(ctx, difficulty.clueThreshold, scenarioNow === null),
    }
  }

  const event = usable[index]
  const immediate = scaleEffects(event.immediate(ctx), severity)
  const delayed = event.delayed(ctx)

  const diagnostics: DiagnosticEvent[] = []
  // Asymmetric effects first, because each one moves the aggregate too — by
  // exactly that member's weight — and the area-wide effects have to land on
  // top of an aggregate that already reflects them. See `engine/members.ts`
  // for the identity this preserves.
  const asymmetric = applyMemberShocks(
    state.members,
    event.memberEffects?.(ctx) ?? [],
    severity,
  )
  // The discharge, which is the other half of Minsky: the crisis *is* the
  // deleveraging. Not all of it — a single bad quarter does not undo three
  // years of accumulated leverage, and a mandate where one shock bought
  // permanent safety would teach the opposite of the hypothesis.
  // The discharge, and **only a crisis discharges.** This was wrong first
  // time: every event burned off 45 % of the accumulated fragility, so a wage
  // round or a data revision deleveraged the financial system, the
  // accumulator never filled, and the mandate-defining crises it exists to
  // produce stayed as rare as before. A minor shock is not the deleveraging —
  // the deleveraging is the thing fragility is *for*.
  const dischargeShare = event.tier === 'major'
    ? INSTITUTIONAL.fragility.discharge
    : INSTITUTIONAL.fragility.minorDischarge
  const discharged = {
    ...state.latent,
    fragility: state.latent.fragility * (1 - dischargeShare),
    meetingsSinceEvent: 0,
  }
  const latent = clampLatentState(
    applyEffects(applyEffects(discharged, asymmetric.aggregate), immediate),
    state.stepIndex,
    diagnostics,
  )

  const pending: PendingEventEffect[] = delayed.map((spec) => ({
    eventId: event.id,
    fireAtStep: state.stepIndex + spec.delaySteps,
    effects: scaleEffects(spec.effects, severity),
  }))

  const record: ResolvedEventRecord = {
    eventId: event.id,
    family: event.family,
    meetingIndex: state.meetingIndex,
    title: event.title,
    newswire: event.newswire,
    immediate: [...asymmetric.aggregate, ...immediate],
    delayedStepDelays: delayed.map((spec) => spec.delaySteps),
    // The queue as scaled, so the same world can be replayed without the
    // player's policy in it. See `ResolvedEventRecord.delayed`.
    delayed: pending.map((entry) => ({
      fireAtStep: entry.fireAtStep,
      effects: entry.effects,
    })),
    // Named so the press can report *which* member was hit rather than
    // reporting an area-wide event that half the area did not experience.
    members: asymmetric.hit,
  }

  const nextState: SimulationState = {
    ...state,
    latent,
    members: asymmetric.members,
    rng: prng.getState(),
    pendingEffects: [...state.pendingEffects, ...pending],
    eventLog: [...state.eventLog, record],
    diagnostics:
      diagnostics.length > 0
        ? [...state.diagnostics, ...diagnostics]
        : state.diagnostics,
  }

  return {
    state: nextState,
    resolved: [record],
    clues: buildClues(
      buildEventContext(nextState),
      difficulty.clueThreshold,
      scenarioNow === null,
    ),
  }
}
