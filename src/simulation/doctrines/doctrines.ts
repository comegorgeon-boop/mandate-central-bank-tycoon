import type { Institution } from '../types/core.ts'
import type { ObservationSet, SeriesId } from '../types/observation.ts'
import { getInstitution } from '../config/institutions.ts'

/**
 * Ten schools of monetary economics, each arguing for the rate it implies.
 *
 * The point of the game, and the part of it that has to be right. Every
 * argument here should be defensible as written in front of an economist:
 * these are the real positions, with the real authorities, and the
 * recommendation each makes is *computed* from its own logic rather than
 * asserted. A doctrine that said something sensible and recommended something
 * unrelated would be a costume.
 *
 * ## The rules this file is written to
 *
 * **No caricatures.** Each school is stated as its own best advocate would
 * state it, including the two that are usually taught as wrong — fiscal
 * dominance and the neo-Fisherian position are both internally coherent and
 * both have serious economists defending them, and a player who meets them as
 * jokes will be surprised to find them in an exam.
 *
 * **Real citations, named.** Taylor (1993), Kydland and Prescott (1977),
 * Friedman (1968), Barro and Gordon (1983), Blanchard and Summers (1986),
 * Mundell (1963) and Fleming (1962), Sargent and Wallace (1981), Woodford
 * (2003), Svensson (1997), Borio's work at the BIS, Minsky (1986), Cochrane
 * (2016), Williamson (2016). The dates are the papers'. Nothing is attributed
 * to anyone that they did not argue.
 *
 * **Each reads only published data.** The same discipline as every other
 * player-facing derivation: an adviser reading the latent state would be
 * arguing from information the player does not have, which is not advice, it
 * is cheating on the player's behalf.
 *
 * **They must disagree.** The test the player set: under a cost-push shock —
 * inflation up, unemployment up — if two of them say the same thing, one of
 * the two is badly written. `doctrines.test.ts` enforces that on the
 * *arguments*, not merely on the numbers: two schools can arrive at "hold" by
 * reasoning that shares nothing, and the reasoning is the content.
 */

export type DoctrineId =
  | 'rule'
  | 'monetarist'
  | 'keynesian'
  | 'new_keynesian'
  | 'credibility_hawk'
  | 'financial_stability'
  | 'hysteresis'
  | 'open_economy'
  | 'fiscal_dominance'
  | 'neo_fisherian'

/** Everything a doctrine may read. Published figures only. */
export interface DoctrineContext {
  readonly observation: ObservationSet
  readonly institution: Institution
  readonly currentRate: number
  readonly target: number
  readonly natural: number
  /** The rate the rule of thumb implies, as published. */
  readonly taylor: number
  /** The committee's last rate move, in basis points. Zero at the opening. */
  readonly lastMove: number
  /** Meetings held so far. */
  readonly meetingIndex: number
  /**
   * The largest move this desk may make, in basis points.
   *
   * Every school's recommendation is clamped to it, and it has to be the
   * *instrument's* limit rather than a constant here: with a wide enough gap
   * seven of ten schools pinned at the same rail and the room read as
   * unanimous when its members had nothing in common but the ceiling.
   */
  readonly maxMove: number
}

export interface DoctrineView {
  /** The move this school argues for, in basis points. */
  readonly basisPoints: number
  /** Its case, in its own terms. */
  readonly argument: string
  /** The published figure it is arguing from, so the player can check it. */
  readonly evidence: string
}

export interface Doctrine {
  readonly id: DoctrineId
  /** The chair in the room. A position, never a person. */
  readonly name: string
  /**
   * How a colleague refers to them mid-sentence.
   *
   * Stored rather than derived, because lowercasing a name is right for "the
   * hawk" and wrong for "the Keynesian" — a proper adjective does not stop
   * being one because it is in the middle of a sentence.
   */
  readonly addressAs: string
  /** The school, as an economist would name it. */
  readonly school: string
  /** Who argued it, and when. */
  readonly authorities: readonly string[]
  /** The claim, in one sentence, independent of the state. */
  readonly creed: string
  /**
   * What it says to a colleague arguing the other way.
   *
   * `{other}` is replaced with that colleague's name at the table, so the
   * advisers address each other rather than each delivering a lecture into
   * the middle distance. One sentence per school rather than a sentence per
   * *pair*: ninety pieces of copy would be ninety chances to write something
   * only half true, and the disagreement is already carried by the positions.
   */
  readonly counter: string
  /**
   * Whether this school has standing to speak in this state.
   *
   * Eight always do. Two are conditional, and deliberately: fiscal dominance
   * is an argument about a particular fiscal position and the neo-Fisherian
   * case is an argument about a particular impasse. Printed every meeting they
   * would be noise; printed when the state calls them they are the moment a
   * player meets an idea they had been taught was fringe and finds it fits.
   */
  readonly speaks: (ctx: DoctrineContext) => boolean
  readonly view: (ctx: DoctrineContext) => DoctrineView
}

// ---- Reading helpers -------------------------------------------------------

function value(observation: ObservationSet, id: SeriesId): number | null {
  return observation.indicators[id]?.value ?? null
}

/** Rounded onto the 25 bp grid every institution here moves on. */
function grid(basisPoints: number): number {
  const rounded = Math.round(basisPoints / 25) * 25
  // Negative zero is a real value in JavaScript and it is never a
  // recommendation: `Object.is(-0, 0)` is false, so a school recommending a
  // hold would compare unequal to another school recommending a hold.
  return rounded === 0 ? 0 : rounded
}

function clampMove(basisPoints: number, ctx: DoctrineContext): number {
  return Math.min(ctx.maxMove, Math.max(-ctx.maxMove, grid(basisPoints)))
}

function pp(value: number): string {
  return `${value >= 0 ? '' : '−'}${Math.abs(value).toFixed(2)} pp`
}

/** The full move to the rule of thumb, in basis points. */
function taylorGap(ctx: DoctrineContext): number {
  return (ctx.taylor - ctx.currentRate) * 100
}

/**
 * The same rule of thumb computed on **core** rather than headline, in basis
 * points from the current rate.
 *
 * The distinction that makes the room disagree at all. The published
 * benchmark reacts to headline inflation, so under a cost-push shock it runs
 * away — and any school anchored to it runs away with it. Measured on a
 * realistic supply shock, seven of the ten recommended the same maximum move,
 * including three whose entire position is that you should *not* tighten into
 * a relative price change. They were not badly argued; they were badly
 * *wired*, each taking a fraction of a number that had already decided the
 * question.
 *
 * So the schools that say "look through the first-round effect" are anchored
 * here instead, which is that sentence written as arithmetic: the same rule,
 * reading the measure that strips out the shock it says to look through.
 */
function coreTaylorGap(ctx: DoctrineContext): number {
  const core = value(ctx.observation, 'core_inflation')
  const headline = value(ctx.observation, 'headline_inflation')
  if (core === null || headline === null) return taylorGap(ctx)
  // The published benchmark, with core substituted for headline in the level
  // term. Everything else about it — the neutral rate, the gap weight — is
  // already inside `ctx.taylor`, so the substitution is the difference.
  return taylorGap(ctx) - (headline - core) * 100
}

/** True when the labour market reading has not been published yet. */
function labourUnpublished(ctx: DoctrineContext): boolean {
  return value(ctx.observation, 'unemployment') === null
}

function inflationGap(ctx: DoctrineContext): number {
  const headline = value(ctx.observation, 'headline_inflation')
  return headline === null ? 0 : headline - ctx.target
}

function coreGap(ctx: DoctrineContext): number {
  const core = value(ctx.observation, 'core_inflation')
  return core === null ? inflationGap(ctx) : core - ctx.target
}

function unemploymentGap(ctx: DoctrineContext): number {
  const unemployment = value(ctx.observation, 'unemployment')
  return unemployment === null ? 0 : unemployment - ctx.natural
}

/** The wedge that identifies a cost-push shock: headline running past core. */
function wedge(ctx: DoctrineContext): number {
  return inflationGap(ctx) - coreGap(ctx)
}

function anchorDrift(ctx: DoctrineContext): number {
  const long = value(ctx.observation, 'inflation_expectations')
  return long === null ? 0 : long - ctx.target
}

// ---- The ten ---------------------------------------------------------------

export const DOCTRINES: readonly Doctrine[] = [
  {
    id: 'rule',
    name: 'The rule',
    addressAs: 'the rule',
    school: 'Rules over discretion',
    authorities: ['Taylor (1993)', 'Kydland and Prescott (1977)'],
    creed:
      'A published rule beats judgement, not because the rule is wiser in any ' +
      'one meeting but because being predictable is worth more than being ' +
      'clever.',
    counter:
      'Against {other}: every one of those arguments is a reason to ' +
      'depart from the rule, and each one will be available again ' +
      'next meeting under a different name. That is what discretion ' +
      'is — it is never the last exception.',
    speaks: () => true,
    view: (ctx) => {
      const move = clampMove(taylorGap(ctx), ctx)
      return {
        basisPoints: move,
        argument:
          `The rule sets ${ctx.taylor.toFixed(2)} %. You are at ` +
          `${ctx.currentRate.toFixed(2)} %. Set the rule's rate. The case for ` +
          'doing so is not that the formula is wiser than this committee in ' +
          'this meeting — it is that a committee trusted to follow a rule buys ' +
          'a cheaper disinflation than one which has to be believed afresh ' +
          'each time. Discretion that improves on the rule today is discretion ' +
          'that will depart from it on a worse day, and the public knows it.',
        evidence:
          `Rule of thumb ${ctx.taylor.toFixed(2)} %, current rate ` +
          `${ctx.currentRate.toFixed(2)} %, core ${pp(coreGap(ctx))} from target.`,
      }
    },
  },

  {
    id: 'monetarist',
    name: 'The monetarist',
    addressAs: 'the monetarist',
    school: 'Long and variable lags',
    authorities: ['Friedman (1968)', 'Friedman and Schwartz (1963)'],
    creed:
      'Policy acts on the economy of a year and a half hence, so a committee ' +
      'that answers each release is amplifying the cycle it means to damp.',
    counter:
      'Against {other}: whatever the case, it is a case about an ' +
      'economy you are reading with a year and a half of delay. You ' +
      'are proposing to act decisively on information that is already ' +
      'historical.',
    speaks: () => true,
    view: (ctx) => {
      // A third of the way, and nothing at all in the meeting after a large
      // move: the lag means the last one has not arrived to be judged.
      const justMoved = Math.abs(ctx.lastMove) >= 50
      const move = justMoved ? 0 : clampMove(coreTaylorGap(ctx) * 0.4, ctx)
      return {
        basisPoints: move,
        argument: justMoved
          ? `You moved ${Math.abs(ctx.lastMove)} bp last meeting and none of it ` +
            'has arrived. Whatever you are reading today is the result of the ' +
            'rate you set a year and a half ago, not of anything you have done ' +
            'since. Wait. The committees that do the most damage are the ones ' +
            'that keep adding to a dose they have not yet tasted.'
          : `Move ${Math.abs(move)} bp — a third of the way the rule asks for, ` +
            'and no more — then stop. The lag ' +
            'is long and it is *variable*, which is the part that matters: you ' +
            'do not know whether the last move lands next quarter or the one ' +
            'after. A committee that reacts fully to each print will, on ' +
            'average, be tightening into the recovery it caused.',
        evidence:
          `Last move ${ctx.lastMove === 0 ? 'none' : `${ctx.lastMove > 0 ? '+' : '−'}${Math.abs(ctx.lastMove)} bp`}` +
          `; the rule's full gap is ${Math.round(taylorGap(ctx))} bp.`,
      }
    },
  },

  {
    id: 'keynesian',
    name: 'The Keynesian',
    addressAs: 'the Keynesian',
    school: 'The short-run trade-off',
    authorities: ['Phillips (1958)', 'Tobin (1972)'],
    creed:
      'The trade-off is real at the horizon policy acts on, and the cost of ' +
      'unemployment is borne by identifiable people now.',
    counter:
      'Against {other}: the cost you are describing is an abstraction ' +
      'about a price index, and the cost I am describing is people ' +
      'out of work. Both are real; only one of them is measured in ' +
      'lives.',
    speaks: () => true,
    view: (ctx) => {
      // Weighted the other way from the rule: the gap dominates, and a
      // relative-price shock is not the demand this instrument reaches.
      const blind = labourUnpublished(ctx)
      const move = clampMove(
        blind
          ? coreTaylorGap(ctx) * 0.3
          : 100 * (0.6 * coreGap(ctx) - 1.6 * unemploymentGap(ctx)),
        ctx,
      )
      return {
        basisPoints: move,
        argument:
          (blind
            ? 'The labour release has not arrived, which is itself the ' +
              'argument: you are being asked to tighten against a price index ' +
              'that is published fast and an employment figure that is not. '
            : `Unemployment is ${pp(unemploymentGap(ctx))} from its sustainable ` +
              'rate. That is not a temperature reading, it is households. ') +
          'The trade-off is real over the horizon this instrument acts on, and ' +
          'inflation driven by import costs is not the demand a rate reaches — ' +
          'raising into it buys you the recession without buying the ' +
          'disinflation. Weight the half of the mandate that is measured in ' +
          'people.',
        evidence:
          `Unemployment gap ${pp(unemploymentGap(ctx))}, core ${pp(coreGap(ctx))} ` +
          `from target, headline running ${pp(wedge(ctx))} ahead of core.`,
      }
    },
  },

  {
    id: 'new_keynesian',
    name: 'The flexible targeter',
    addressAs: 'the flexible targeter',
    school: 'Flexible inflation targeting',
    authorities: ['Woodford (2003)', 'Svensson (1997)'],
    creed:
      'Look through a relative-price shock — but only for as long as the ' +
      'anchor holds, and the anchor is a number you can read.',
    counter:
      'Against {other}: the question is not which of us is right in ' +
      'general, it is whether the anchor is holding *now*. There is a ' +
      'survey. Read it, and let it decide between us rather than our ' +
      'priors.',
    speaks: () => true,
    view: (ctx) => {
      const drift = anchorDrift(ctx)
      const anchored = Math.abs(drift) <= 0.3
      const long = value(ctx.observation, 'inflation_expectations')
      // Anchored: look through the shock, so read the measure that strips it
      // out. Unanchored: the condition has failed, so read the headline the
      // public is living and act on it.
      const move = anchored
        ? clampMove(coreTaylorGap(ctx) * 0.35, ctx)
        : clampMove(taylorGap(ctx) * 0.8 + 120 * drift, ctx)
      return {
        basisPoints: move,
        argument: anchored
          ? `Five-year expectations read ${long === null ? '—' : `${long.toFixed(2)} %`}. ` +
            'The anchor is holding, so the optimal policy is to accommodate ' +
            'the first-round effect of a relative price change and not the ' +
            'second. Output lost to fighting a price level that has already ' +
            'moved is output lost for nothing. This advice is conditional and ' +
            'the condition is that survey: watch it, not the headline.'
          : `Five-year expectations read ${long === null ? '—' : `${long.toFixed(2)} %`}, ` +
            `which is ${pp(drift)} from target. The condition on looking ` +
            'through a supply shock has failed. Once expectations move, the ' +
            'shock has stopped being a relative price and started being ' +
            'inflation, and the policy reverses — hard, and without apology ' +
            'for having counselled patience while the anchor held.',
        evidence:
          `Five-year survey ${long === null ? 'unpublished' : `${long.toFixed(2)} %`}` +
          `, objective ${ctx.target.toFixed(1)} %.`,
      }
    },
  },

  {
    id: 'credibility_hawk',
    name: 'The hawk',
    addressAs: 'the hawk',
    school: 'Credibility and time consistency',
    authorities: ['Barro and Gordon (1983)', 'the Bundesbank tradition'],
    creed:
      'A recession is cheaper than a de-anchoring, because the next ' +
      'disinflation is priced off this one.',
    counter:
      'Against {other}: you are proposing to spend credibility you ' +
      'did not earn and cannot borrow. Every argument for patience is ' +
      'correct right up to the meeting where it turns out to have ' +
      'been the meeting that mattered.',
    speaks: () => true,
    view: (ctx) => {
      const move = clampMove(
        taylorGap(ctx) * 1.15 + 140 * Math.max(0, anchorDrift(ctx)),
        ctx,
      )
      return {
        basisPoints: move,
        argument:
          'Raise, and raise past where it feels proportionate. The cost of a ' +
          'recession is large, finite and paid once. The cost of people ' +
          'ceasing to believe the objective is paid at every future ' +
          'disinflation, because each one then has to be bought with output ' +
          'the last one failed to buy. Every quarter you look through this, ' +
          'the eventual bill grows. Against the flexible targeter: waiting for ' +
          'the survey to move is waiting for the damage to be done, because by ' +
          'the time the survey moves the belief has already gone.',
        evidence:
          `Headline ${pp(inflationGap(ctx))} from target, five-year ` +
          `expectations ${pp(anchorDrift(ctx))} from it.`,
      }
    },
  },

  {
    id: 'financial_stability',
    name: 'The supervisor',
    addressAs: 'the supervisor',
    school: 'Financial stability',
    authorities: ['Borio (BIS)', 'Minsky (1986)'],
    creed:
      'Stability is destabilising: the damage of cheap money shows up on ' +
      'balance sheets long before it shows up in the price index.',
    counter:
      'Against {other}: you are setting a rate for an economy and I ' +
      'am asking you to look at who is funding it. The inflation ' +
      'print will not tell you the banking system has broken until ' +
      'after it has.',
    speaks: () => true,
    view: (ctx) => {
      const stress = value(ctx.observation, 'bank_stress_proxy') ?? 0
      const valuation = value(ctx.observation, 'asset_valuation') ?? 0
      const strained = stress >= 45
      const frothy = valuation >= 15 && !strained

      const move = strained
        ? clampMove(Math.min(0, coreTaylorGap(ctx) * 0.4) - 25, ctx)
        : frothy
          ? clampMove(Math.max(25, coreTaylorGap(ctx) * 0.6 + 50), ctx)
          : clampMove(coreTaylorGap(ctx) * 0.55, ctx)

      return {
        basisPoints: move,
        argument: strained
          ? `Banking stress reads ${stress.toFixed(0)}. Look at the balance ` +
            'sheets before the price index. Tightening into funding strain is ' +
            'how a liquidity problem becomes a solvency one, and a banking ' +
            'crisis will do more disinflating than any rate you could set — ' +
            'at a price nobody chose.'
          : frothy
            ? `Valuations are ${valuation.toFixed(0)} points above fair value ` +
              'with credit still growing. This is the part of the cycle where ' +
              'the next crisis is being built, and it will not appear in the ' +
              'inflation print until it is too late to lean against. Leaning ' +
              'now is cheaper than the clean-up.'
            : 'Neither the banks nor valuations are asking for anything ' +
              'today. Move with the rule, and keep watching the leverage ' +
              'rather than the price level — that is where the next problem ' +
              'is being written.',
        evidence:
          `Banking stress ${stress.toFixed(0)}, valuation pressure ` +
          `${valuation.toFixed(0)} points from fair value.`,
      }
    },
  },

  {
    id: 'hysteresis',
    name: 'The labour economist',
    addressAs: 'the labour economist',
    school: 'Hysteresis',
    authorities: ['Blanchard and Summers (1986)', 'Yellen (2016)'],
    creed:
      'Unemployment is not a temperature but a scar: capacity leaves with the ' +
      'people who leave the labour force, and does not come back with them.',
    counter:
      'Against {other}: you are treating the sustainable rate of ' +
      'unemployment as a constant. It is not — it follows what you ' +
      'allow, and the damage you are proposing becomes the new ' +
      'baseline you will measure yourself against.',
    speaks: () => true,
    view: (ctx) => {
      const gap = unemploymentGap(ctx)
      const blind = labourUnpublished(ctx)
      const move = clampMove(
        coreTaylorGap(ctx) * 0.4 - 150 * Math.max(0, gap),
        ctx,
      )
      return {
        basisPoints: move,
        argument:
          (blind
            ? 'The labour release is not in yet, and the asymmetry does not ' +
              'wait for it. The sustainable rate of unemployment '
            : `Unemployment is ${pp(gap)} from its sustainable rate, and that rate `) +
          'is not a constant — it follows the unemployment you allow. People ' +
          'out of work long enough lose the attachment, the skills and the ' +
          'employers that would have taken them back, and the supply side of ' +
          'this economy shrinks to match. The asymmetry is the whole argument: ' +
          'an inflation overshoot is reversible and a lost workforce is not. ' +
          'Run it hot before you run it cold.',
        evidence: blind
          ? `Sustainable rate ${ctx.natural.toFixed(1)} %, on a staff estimate ` +
            'that moves with the outcome it is meant to measure. The labour ' +
            'release has not arrived.'
          : `Unemployment gap ${pp(gap)}; sustainable rate ` +
            `${ctx.natural.toFixed(1)} %, on a staff estimate that moves with the ` +
            'outcome it is meant to measure.',
      }
    },
  },

  {
    id: 'open_economy',
    name: 'The external hand',
    addressAs: 'the external hand',
    school: 'Open-economy macroeconomics',
    authorities: ['Mundell (1963)', 'Fleming (1962)'],
    creed:
      'With open capital, the rate and the exchange rate are one instrument; ' +
      'and the half of your tightening that works through the currency is a ' +
      'tightening you export.',
    counter:
      'Against {other}: your instrument is not as domestic as your ' +
      'argument assumes. Part of it runs through the currency, which ' +
      'means part of it lands on economies that did not vote for it ' +
      'and will answer back.',
    speaks: () => true,
    view: (ctx) => {
      const fx = value(ctx.observation, 'exchange_rate')
      const imports = value(ctx.observation, 'import_prices')
      // The currency is already doing part of the work, so discount the move.
      const helping = fx !== null && fx > 100
      const move = clampMove(coreTaylorGap(ctx) * (helping ? 0.35 : 0.7), ctx)
      return {
        basisPoints: move,
        argument:
          (helping
            ? `The currency is at ${fx.toFixed(0)} and import prices are ` +
              `${imports === null ? 'not yet published' : `${imports.toFixed(1)} %`}. ` +
              'A stronger currency is a tightening you did not have to vote ' +
              'for: part of the disinflation is arriving through the import ' +
              'bill while you sit still. Discount your move by what the ' +
              'exchange rate is already delivering.'
            : 'The currency is giving you nothing, so the rate has to do the ' +
              'whole job — which is precisely when the trilemma bites: with ' +
              'capital free to move, you may have the rate you want or the ' +
              'exchange rate you want and not both.') +
          ' And understand what a rise exports: a higher rate here pulls ' +
          'capital in, weakens your partners’ currencies and raises their ' +
          'import costs. They will answer it, and the answer comes back.',
        evidence:
          `Effective exchange rate ${fx === null ? 'unpublished' : fx.toFixed(1)}` +
          `, import prices ${imports === null ? 'unpublished' : `${imports.toFixed(1)} %`}.`,
      }
    },
  },

  {
    id: 'fiscal_dominance',
    name: 'The fiscal realist',
    addressAs: 'the fiscal realist',
    school: 'Fiscal dominance',
    authorities: [
      'Sargent and Wallace (1981)',
      'Cochrane, the fiscal theory of the price level',
    ],
    creed:
      'Where the fiscal authority will not adjust, the monetary authority ' +
      'does not determine the price level — it only chooses when the bill ' +
      'arrives.',
    counter:
      'Against {other}: you are both assuming this committee ' +
      'determines the price level. Where the fiscal authority will ' +
      'not adjust, it does not — and a resolve that cannot be ' +
      'financed is not resolve, it is a timetable.',
    speaks: (ctx) => {
      // Speaks when someone's borrowing cost says the market is asking who
      // pays. In a currency area that is the widest member spread; for a
      // single sovereign it is the long yield running clear of the policy
      // rate, which in an ordinary term structure it always does a little —
      // so the bar is a curve steep enough to be a question about solvency
      // rather than the usual term premium, and it needs the inflation to go
      // with it. At 1.5 pp it fired on a calm opening balance sheet, which is
      // the fringe idea turning up every meeting and becoming wallpaper.
      const widest = ctx.observation.area?.widestSpread ?? null
      if (widest !== null) return widest >= 200
      const long = value(ctx.observation, 'long_rate')
      return (
        long !== null &&
        long - ctx.currentRate >= 2.5 &&
        inflationGap(ctx) >= 1
      )
    },
    view: (ctx) => {
      const widest = ctx.observation.area?.widestSpread ?? null
      const long = value(ctx.observation, 'long_rate')
      // Raising the rate raises the interest bill. Where the fiscal side will
      // not close the gap, that is not disinflationary.
      const move = clampMove(Math.min(0, taylorGap(ctx) * 0.3), ctx)
      return {
        basisPoints: move,
        argument:
          (widest === null
            ? `The long yield is ${long === null ? 'unpublished' : `${long.toFixed(2)} %`} ` +
              `against a policy rate of ${ctx.currentRate.toFixed(2)} %. `
            : `The widest sovereign spread in the union is ${widest} bp. `) +
          'That is the market asking who pays, and the answer is not this ' +
          'committee. Unpleasant monetarist arithmetic: if the fiscal ' +
          'authority will not close its gap, every basis point you add to the ' +
          'policy rate is added to the interest bill, financed by more debt, ' +
          'and the price level ends up wherever the present value of surpluses ' +
          'puts it. Tightening here can *raise* inflation. Against the hawk: ' +
          'there is no amount of resolve that substitutes for a budget.',
        evidence:
          widest === null
            ? `Ten-year yield ${long === null ? 'unpublished' : `${long.toFixed(2)} %`}, policy rate ${ctx.currentRate.toFixed(2)} %.`
            : `Widest member spread ${widest} bp.`,
      }
    },
  },

  {
    id: 'neo_fisherian',
    name: 'The Fisherian',
    addressAs: 'the Fisherian',
    school: 'Neo-Fisherian',
    authorities: ['Cochrane (2016)', 'Williamson (2016)'],
    creed:
      'The nominal rate is the real rate plus expected inflation. Hold the ' +
      'nominal rate down and keep it there, and expected inflation must come ' +
      'down to meet it.',
    counter:
      'Against {other}: you are asserting the sign rather than ' +
      'deriving it. Write down the Fisher relation and tell me which ' +
      'term you think moves when the nominal rate is held high for a ' +
      'decade.',
    speaks: (ctx) => {
      // Rare, and only where the conventional story is visibly failing: the
      // rate has been held high for a while and expectations are still
      // drifting away from target rather than toward it.
      if (ctx.meetingIndex < 5) return false
      const real = ctx.currentRate - (value(ctx.observation, 'inflation_expectations_1y') ?? 0)
      return real >= 1.5 && Math.abs(anchorDrift(ctx)) >= 0.5
    },
    view: (ctx) => {
      const short = value(ctx.observation, 'inflation_expectations_1y')
      const move = clampMove(-Math.max(50, Math.abs(taylorGap(ctx)) * 0.5), ctx)
      return {
        basisPoints: move,
        argument:
          'Consider the possibility that the sign is wrong. The Fisher ' +
          'relation is an identity: the nominal rate equals the real rate plus ' +
          'expected inflation. The real rate is pinned by things this ' +
          'committee does not set. So a nominal rate held high *permanently* ' +
          'is a commitment to high expected inflation, and a nominal rate held ' +
          'low and credibly kept there drags expected inflation down to meet ' +
          `it. You have held ${ctx.currentRate.toFixed(2)} % and one-year ` +
          `expectations are ${short === null ? 'unpublished' : `${short.toFixed(2)} %`} ` +
          'and going the wrong way. The conventional advice has had its turn.',
        evidence:
          `Policy rate ${ctx.currentRate.toFixed(2)} %, one-year expectations ` +
          `${short === null ? 'unpublished' : `${short.toFixed(2)} %`}, five-year ` +
          `${pp(anchorDrift(ctx))} from target.`,
      }
    },
  },
]

export const DOCTRINES_BY_ID = new Map<DoctrineId, Doctrine>(
  DOCTRINES.map((doctrine) => [doctrine.id, doctrine]),
)

export function getDoctrine(id: DoctrineId): Doctrine {
  const doctrine = DOCTRINES_BY_ID.get(id)
  if (doctrine === undefined) throw new Error(`Unknown doctrine: ${id}`)
  return doctrine
}

/** Assembles the context a doctrine reads, from published data only. */
export function doctrineContext({
  observation,
  institution,
  currentRate,
  lastMove,
  meetingIndex,
  maxMove,
}: {
  readonly observation: ObservationSet
  readonly institution: Institution
  readonly currentRate: number
  readonly lastMove: number
  readonly meetingIndex: number
  readonly maxMove: number
}): DoctrineContext {
  const config = getInstitution(institution)
  return {
    observation,
    institution,
    currentRate,
    target: config.inflationTarget,
    natural: config.initial.naturalUnemployment,
    taylor: observation.taylorBenchmark,
    lastMove,
    meetingIndex,
    maxMove,
  }
}

/** Every doctrine with standing to speak, with what it would do. */
export function doctrineViews(
  ctx: DoctrineContext,
): readonly { readonly doctrine: Doctrine; readonly view: DoctrineView }[] {
  return DOCTRINES.filter((doctrine) => doctrine.speaks(ctx)).map((doctrine) => ({
    doctrine,
    view: doctrine.view(ctx),
  }))
}
