import type { Difficulty, Institution } from '../types/core.ts'
import type { ObservationSet } from '../types/observation.ts'
import type { PolicyAction, PolicyPackage } from '../types/policy.ts'
import type { RunSession } from '../replay/replayRun.ts'
import {
  availableInstruments,
  getInstrument,
  getInstrumentRange,
} from '../config/instruments.ts'
import { staffRecommendation } from './staffRule.ts'

/**
 * The staff rule, playing the whole toolkit rather than the policy rate alone.
 *
 * Every benchmark in this project until now moved one instrument. That was
 * honest while the rate was the only instrument a player could reach, and it
 * stopped being honest the moment the desk opened the balance sheet and the
 * facilities: measuring whether a difficulty is winnable with a policy that
 * declines to use eleven of its twelve instruments measures the benchmark, not
 * the difficulty.
 *
 * It is still deliberately mediocre, and that matters — if a rule this crude
 * sweeps a difficulty, the difficulty has no decision problem in it. What it
 * adds over `staffRule` is only what any competent committee would do without
 * thinking:
 *
 * - **Never bind to a path it read off untrustworthy data.** Words carry a
 *   leaning, never a promise. This is not caution for its own sake: measured
 *   at hard, the honest *binding* rule breaks 2.3-2.9 promises a mandate,
 *   because hard's observation noise moves its own target between meetings, and
 *   is dismissed in 57-59 % of runs against 19-21 % for the same rule speaking
 *   without binding itself. Committing firmly to a forecast you cannot trust
 *   is a real error and the engine is right to be lethal about it.
 * - **Answer financial stress with the liquidity instruments**, which exist for
 *   exactly that and cost almost nothing when they are not needed.
 * - **Stop draining reserves into a crisis.** Runoff into rising banking stress
 *   is procyclical, and the balance sheet is the instrument that undoes it.
 * - **Never send two signals at once.** Buying assets while raising the rate is
 *   a contradiction the engine prices at 0.4 severity a meeting, and a rule
 *   that did it completed 30 % of hard mandates against 41 % for the same rule
 *   using the rate alone — the facilities were helping and the mixed signal was
 *   costing more than they gained. Liquidity support carries no such conflict,
 *   so it stays.
 *
 * Nothing here reads latent state. Like `staffRule`, it sees the same noisy,
 * late published series the player sees.
 */

/**
 * Banking stress at which the facilities are worth escalating, and the lower
 * level at which they are wound back.
 *
 * Two bars rather than one, because a single one makes the rule *thrash*. Read
 * off the published proxy, which carries a meeting of publication lag and, at
 * hard, six points of noise: a rule that escalates above 45 and stands down
 * below 45 flips its whole balance-sheet stance on measurement error, and
 * measured that way it was setting runoff and taking it off again often enough
 * to trip `easing_rate_while_tightening_balance_sheet` in 14-24 % of meetings.
 * A committee does not reverse its balance-sheet policy because a print moved
 * two points, and neither should the benchmark that stands in for one.
 */
const STRESS_ESCALATE = 45
const STRESS_STAND_DOWN = 30
const STRESS_SEVERE = 65

/** Credit spreads, in percentage points, that count as a funding squeeze. */
const SPREAD_SQUEEZE = 2.6

/**
 * The *widest member* spread, basis points, at which the area is coming apart.
 *
 * Read off the widest member rather than the area-wide average, and that is
 * the substantive choice here: fragmentation is one member coming adrift, not
 * everyone drifting together, and an average is exactly the statistic that
 * hides it. Measured over a quiet ECB mandate the area-wide figure drifts from
 * 71 to 87 basis points while the widest member goes from 65 to 160 — the
 * average reports a calm decade the area did not have.
 *
 * It is also the only clean signal available. National price and labour
 * statistics carry measurement error, and the mean absolute deviation of noisy
 * readings is biased upward by the noise itself, so statistical dispersion
 * bounces between 0.4 and 1.3 on an unshocked hard mandate. A spread is a
 * price: exact, immediate, and not a survey.
 *
 * The bars sit against `MEMBER_DYNAMICS.transmissionBreakSpread` (250, where
 * the common rate stops reaching a member): escalate *before* transmission
 * breaks, because the instrument works on the way up and repairs nothing on
 * the way down.
 */
const FRAGMENTATION_ESCALATE = 200
const FRAGMENTATION_SEVERE = 300

/**
 * Dispersion, in percentage points, past which the aggregate stops being a
 * fair description of the area.
 *
 * Weighted mean absolute deviation. Set above the level an unshocked mandate
 * runs at — measured, unemployment dispersion sits between 0.4 and 1.6 and
 * inflation dispersion between 0.4 and 1.3 with nothing happening at all,
 * because national releases are noisier than the area's and the deviation of
 * noisy readings is biased upward by its own noise. A bar inside that range
 * would be a rule reacting to measurement error.
 */
const UNEMPLOYMENT_DISPERSION_BAR = 1.7
const INFLATION_DISPERSION_BAR = 1.25

/** The tilted recommendation, inside the difficulty's own bounds. */
function tiltedMove(base: number, tilt: number, difficulty: Difficulty): number {
  const instrument = getInstrument('policy_rate')
  if (instrument === undefined) return base
  const range = getInstrumentRange(instrument, difficulty)
  const wanted = base + tilt
  const clamped = Math.min(range.max, Math.max(range.min, wanted))
  // Snap back onto the increment grid: a bound that is not a multiple of the
  // step would otherwise produce a magnitude the validator rejects for a
  // second, entirely different reason.
  return Math.round(clamped / range.increment) * range.increment
}

/** One step of caution, in basis points. Never more. */
function dispersionTilt(observation: ObservationSet): number {
  const area = observation.area
  if (area === null) return 0

  // Unemployment first: a wide labour-market dispersion means tightening the
  // area tightens hardest where it already hurts most.
  if (area.unemploymentDispersion >= UNEMPLOYMENT_DISPERSION_BAR) return -25
  if (area.inflationDispersion >= INFLATION_DISPERSION_BAR) return 25
  return 0
}

function has(
  institution: Institution,
  difficulty: Difficulty,
  id: string,
): boolean {
  return availableInstruments(institution, difficulty).some(
    (instrument) => instrument.id === id,
  )
}

export function toolkitPackage(
  session: RunSession,
  institution: Institution,
  difficulty: Difficulty,
): PolicyPackage {
  const advice = staffRecommendation(session.observation, institution, difficulty)
  // ---- The dispersion tilt -------------------------------------------------
  //
  // A currency area's aggregate can be a poor description of the area. When
  // unemployment is spread widely across members, area-wide slack understates
  // how much of the area is in real difficulty, and a committee that reads
  // only the aggregate tightens into it; when inflation is spread widely, the
  // aggregate understates how far the worst member has run.
  //
  // One step, capped, and only past a bar. This is not a second reaction
  // function competing with the first — it is the caution a committee setting
  // one rate for members who need different ones actually shows, and without
  // it the rule is *structurally* blind to every asymmetric event in the
  // catalog: measured, three of them changed nothing at all.
  // Clamped to what the instrument actually allows. The staff rule can already
  // be at the difficulty's maximum move, and a tilt on top of it produced a
  // package the engine rejected outright — which ends a run on a technicality
  // rather than on policy, and which the 150-seed sweep found on the thirteenth
  // meeting of an ECB hard mandate.
  const tilt = dispersionTilt(session.observation)
  const move = tiltedMove(advice?.basisPoints ?? 0, tilt, difficulty)
  const actions: PolicyAction[] = []
  if (move !== 0) actions.push({ instrument: 'policy_rate', magnitude: move })

  const indicators = session.observation.indicators
  const stress = indicators.bank_stress_proxy?.value ?? 0
  const spread = indicators.credit_spread?.value ?? 0
  const stance = session.state.stance

  // Hysteresis: once the facilities are up they stay up until stress has
  // genuinely receded, rather than following each print up and down.
  const alreadySupporting =
    stance.runoffPace === 0 ||
    stance.discountWindowLevel > 0 ||
    stance.targetedRefinancing > 0 ||
    stance.assetPurchasePace > 0
  const strained = alreadySupporting
    ? stress >= STRESS_STAND_DOWN || spread >= SPREAD_SQUEEZE
    : stress >= STRESS_ESCALATE || spread >= SPREAD_SQUEEZE
  const severe = stress >= STRESS_SEVERE

  // Liquidity, where the institution has it. Escalated against real stress and
  // wound back when it passes — signalling a backstop with no stress to justify
  // it unsettles markets, which `INSTRUMENT_EFFECTS` prices directly.
  const facility = institution === 'fed' ? 'discount_window' : 'targeted_refinancing'
  if (has(institution, difficulty, facility)) {
    const wanted =
      institution === 'fed'
        ? severe
          ? 3
          : strained
            ? 2
            : 0
        : severe
          ? 3
          : strained
            ? 2
            : 0
    const current =
      institution === 'fed' ? stance.discountWindowLevel : stance.targetedRefinancing
    if (Math.abs(wanted - current) > 1e-9) {
      actions.push({ instrument: facility, magnitude: wanted })
    }
  }

  // Do not drain reserves into a squeeze — and do not drain them while easing
  // either. Cutting the rate with the balance sheet still running off is a
  // package arguing with itself through two channels at once, and the engine
  // charges for it every meeting it continues, which is right: it is exactly
  // the mixed signal real committees are criticised for.
  if (has(institution, difficulty, 'balance_sheet_runoff')) {
    const wanted = strained || move < 0 ? 0 : 1
    if (Math.abs(wanted - stance.runoffPace) > 1e-9) {
      actions.push({ instrument: 'balance_sheet_runoff', magnitude: wanted })
    }
  }

  // ---- Fragmentation: the decision the Fed never has to take --------------
  //
  // A currency area can be coming apart while the aggregate the committee
  // targets says almost nothing is happening — that is what "asymmetric"
  // means, and it is the whole difficulty of setting one rate for members who
  // need different ones. A rule that reads only area-wide inflation and
  // unemployment is *structurally* blind to it, which is why every asymmetric
  // event in the catalog changed nothing at all until this block existed:
  // measured, four of them scored zero out of 48 on `consequence.test.ts`.
  const fragmentation =
    session.observation.area?.widestSpread ??
    indicators.fragmentation_spread?.value ??
    0
  const fragmenting = fragmentation >= FRAGMENTATION_ESCALATE
  const fragmentingBadly = fragmentation >= FRAGMENTATION_SEVERE

  if (has(institution, difficulty, 'transmission_protection')) {
    const wanted = fragmentingBadly ? 3 : fragmenting ? 2 : 0
    if (Math.abs(wanted - stance.transmissionProtection) > 1e-9) {
      actions.push({ instrument: 'transmission_protection', magnitude: wanted })
    }
  }

  // Buy into a genuine dislocation, and stop when it clears — but never while
  // raising the rate, which is a mixed signal the engine charges for and which
  // measurably cost more than the purchases were worth.
  //
  // Purchases compress sovereign spreads as well as term premia, so where the
  // dedicated instrument is not open they are the area's only answer to
  // fragmentation. That is why the ECB reaches for them at a lower bar than
  // the Fed: the same programme is doing a second job.
  if (has(institution, difficulty, 'asset_purchases')) {
    const dislocated = severe || (institution === 'ecb' && fragmentingBadly)
    const wanted = dislocated && move <= 0 ? 2 : 0
    if (Math.abs(wanted - stance.assetPurchasePace) > 1e-9) {
      actions.push({ instrument: 'asset_purchases', magnitude: wanted })
    }
  }

  return {
    actions,
    communication: {
      tone: move > 0 ? 'hawkish' : move < 0 ? 'dovish' : 'neutral',
      emphasis: strained ? 'financial_stability' : 'inflation',
      // A leaning, never a promise. See the doc comment above.
      commitment: 'weak_bias',
      channel: 'statement',
    },
  }
}
