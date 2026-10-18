import { readPublicTrust, trustSentence } from '../meeting/publicTrust.ts'
import {
  readStance,
  readStanceChange,
  type Difficulty,
  type Institution,
  type ObservationSet,
  type StanceLabel,
  type StanceReading,
} from '../../simulation/index.ts'

/**
 * The policy stance, permanently on screen.
 *
 * This exists because a nominal policy rate answers none of the questions the
 * player actually has. Raising the rate three times while expected inflation
 * rises faster is an *easing*, and a screen showing only the nominal rate
 * would report it as three tightenings. The strip shows the real rate, its
 * position against neutral, and — the part that does the teaching — the
 * decomposition of how it moved, so a decision that was cancelled out by
 * expectations is visible as exactly that.
 */

const LABEL_TEXT: Readonly<Record<StanceLabel, string>> = {
  restrictive: 'RESTRICTIVE',
  neutral: 'AROUND NEUTRAL',
  accommodative: 'ACCOMMODATIVE',
}

const LABEL_STYLE: Readonly<Record<StanceLabel, string>> = {
  restrictive: 'text-accent-onwood',
  neutral: 'text-onwood-soft',
  accommodative: 'text-accent-onwood',
}

const LABEL_MEANING: Readonly<Record<StanceLabel, string>> = {
  restrictive: 'Policy is holding demand back and pushing inflation down.',
  accommodative: 'Policy is adding to demand and pushing inflation up.',
  neutral:
    'Policy is neither holding demand back nor adding to it — as far as an ' +
    'estimate this uncertain can tell.',
}

function signed(percentagePoints: number): string {
  const basisPoints = Math.round(percentagePoints * 100)
  if (basisPoints === 0) return '0 bp'
  return `${basisPoints > 0 ? '+' : '−'}${Math.abs(basisPoints)} bp`
}

function StanceLabelBlock({ stance }: { readonly stance: StanceReading }) {
  if (stance.label === null || stance.gap === null || stance.neutralEstimate === null) {
    return (
      <div>
        <dt className="text-xs uppercase tracking-wide text-onwood-faint">Stance</dt>
        <dd>
          <span className="text-lg font-semibold text-onwood-soft">UNAVAILABLE</span>
          <span className="mt-0.5 block text-xs text-onwood-faint">
            The releases needed to place the rate against neutral have not arrived.
          </span>
        </dd>
      </div>
    )
  }

  const distance = Math.abs(stance.gap)
  const position =
    stance.label === 'neutral'
      ? `within ${stance.neutralBand.toFixed(2)} pp of the neutral rate`
      : `${distance.toFixed(2)} pp ${stance.gap > 0 ? 'above' : 'below'} the neutral rate`

  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-onwood-faint">Stance</dt>
      <dd>
        <span className={`text-lg font-semibold ${LABEL_STYLE[stance.label]}`}>
          {LABEL_TEXT[stance.label]}
        </span>
        <span className="mt-0.5 block text-xs text-onwood-soft">
          {position} (estimated {stance.neutralEstimate.toFixed(2)} %, ±
          {stance.neutralUncertainty.toFixed(2)}).
        </span>
      </dd>
    </div>
  )
}

export function StanceStrip({
  observation,
  previousObservation,
  difficulty,
  institution,
  objective,
  sustainable,
}: {
  readonly observation: ObservationSet
  readonly previousObservation: ObservationSet | null
  /** Sets the objective and the sustainable rate the trust terms read against. */
  readonly institution: Institution
  /** The mandate's own objective and sustainable rate. See `standing.ts`. */
  readonly objective: number
  readonly sustainable: number
  /**
   * Decides how many figures stand permanently on screen.
   *
   * The learning mandate carries the three that a decision is made from and
   * drops public approval, which is the one figure here a player cannot act on
   * — there is no lever that moves it and no choice it settles. It is not
   * removed, it is in the fold with the arithmetic. Above easy it stays out,
   * because from medium the political cost of being right is a real
   * consideration and approval is where it first shows.
   */
  readonly difficulty: Difficulty
}) {
  const stance = readStance(observation)
  const change = readStanceChange(observation, previousObservation)
  const showsApproval = difficulty !== 'easy'
  /**
   * Whether each figure carries its own definition.
   *
   * The learning mandate only. A chair on medium has met the real rate; a
   * definition repeated at the top of every screen of every meeting of their
   * forty-eighth mandate is not teaching anything, it is four lines of prose
   * standing between five numbers and the charts underneath them. The *change*
   * since the last meeting is kept at every difficulty, because that is a
   * reading rather than a gloss.
   *
   * This is the density rule applied where it bites: less text on the screen,
   * never more, and nothing removed from the game — the definitions are still
   * on the indicator panels, under every series, at every difficulty.
   */
  const explains = difficulty === 'easy'
  const trust = readPublicTrust(observation, institution, objective, sustainable)
  const credibility = observation.indicators.credibility_index?.value ?? null
  const previousCredibility =
    previousObservation?.indicators.credibility_index?.value ?? null
  const credibilityMove =
    credibility === null || previousCredibility === null
      ? null
      : Math.round(credibility - previousCredibility)
  // Approval sits beside credibility because the two answer different
  // questions and a player who conflates them will misread both: markets ask
  // whether you will do what you said, the public asks whether prices and
  // jobs are all right. They routinely move in opposite directions, and
  // watching this one climb is the clearest sign a mandate is going well
  // rather than merely not going wrong.
  const approval = observation.indicators.public_approval?.value ?? null
  const previousApproval =
    previousObservation?.indicators.public_approval?.value ?? null
  const approvalMove =
    approval === null || previousApproval === null
      ? null
      : Math.round(approval - previousApproval)

  return (
    <section
      aria-label="Policy stance"
      className="mt-4 rounded border border-edge-room bg-room/60 p-4"
    >
      <dl
        className={`grid gap-4 sm:grid-cols-2 ${
          showsApproval ? 'lg:grid-cols-5' : 'lg:grid-cols-4'
        }`}
      >
        <div>
          <dt className="text-xs uppercase tracking-wide text-onwood-faint">
            Policy rate
          </dt>
          <dd>
            <span className="text-lg font-semibold tabular-nums text-onwood">
              {stance.nominalRate === null ? '—' : `${stance.nominalRate.toFixed(2)} %`}
            </span>
            <span className="mt-0.5 block text-xs text-onwood-soft">
              {change === null
                ? explains
                  ? 'The rate you set. On its own it says nothing about tight or loose.'
                  : 'The rate you set.'
                : `${signed(change.nominal)} since the last meeting.`}
            </span>
          </dd>
        </div>

        <div>
          <dt className="text-xs uppercase tracking-wide text-onwood-faint">Real rate</dt>
          <dd>
            <span className="text-lg font-semibold tabular-nums text-onwood">
              {stance.realRate === null ? '—' : `${stance.realRate.toFixed(2)} %`}
            </span>
            <span className="mt-0.5 block text-xs text-onwood-soft">
              Policy rate minus expected inflation
              {stance.expectedInflation !== null &&
                ` (${stance.expectedInflation.toFixed(2)} %)`}
              {explains ? '. This is the rate the economy responds to.' : '.'}
            </span>
          </dd>
        </div>

        <StanceLabelBlock stance={stance} />

        <div>
          <dt className="text-xs uppercase tracking-wide text-onwood-faint">
            Your word
          </dt>
          <dd>
            <span className="text-lg font-semibold tabular-nums text-onwood">
              {credibility === null ? '—' : Math.round(credibility)}
            </span>
            <span className="mt-0.5 block text-xs text-onwood-soft">
              {credibilityMove !== null && credibilityMove !== 0
                ? `${credibilityMove > 0 ? '+' : '−'}${Math.abs(credibilityMove)} since ` +
                  'the last meeting. '
                : ''}
              {explains
                ? 'How far your statements are believed — it scales everything they do.'
                : ''}
            </span>
          </dd>
        </div>

        {showsApproval && (
        <div>
          <dt className="text-xs uppercase tracking-wide text-onwood-faint">
            Public trust
          </dt>
          <dd>
            <span
              className={`text-lg font-semibold tabular-nums ${
                approvalMove === null || approvalMove === 0
                  ? 'text-onwood'
                  : approvalMove > 0
                    ? 'text-good-onwood'
                    : 'text-bad-onwood'
              }`}
            >
              {approval === null ? '—' : Math.round(approval)}
            </span>
            <span className="mt-0.5 block text-xs text-onwood-soft">
              {approvalMove !== null && approvalMove !== 0
                ? `${approvalMove > 0 ? '+' : '−'}${Math.abs(approvalMove)} since the ` +
                  'last meeting. '
                : ''}
              {explains
                ? 'What the public makes of the prices and the jobs they live with.'
                : ''}
            </span>
            {/* Decomposed, because the number alone was read as a verdict on
                conduct and it has no conduct term at all. See
                `meeting/publicTrust.ts`. */}
            {trust !== null && (
              <span className="mt-1 block text-xs text-onwood-faint">
                {trustSentence(trust)}
              </span>
            )}
          </dd>
        </div>
        )}
      </dl>

      {stance.label !== null && explains && (
        <p className="mt-3 text-sm text-onwood-soft">{LABEL_MEANING[stance.label]}</p>
      )}

      {/* The decomposition and the ex-post footnote fold.
       *
       * Both are worth reading and neither is worth reading *every* meeting,
       * which is the distinction this whole density pass turns on: the five
       * figures above are what a chair checks before every decision, and the
       * arithmetic behind them is what they open when one of the five is
       * surprising. Left permanently open, they were four hundred pixels of
       * prose standing between the numbers and the charts.
       *
       * The one thing that does not fold is a stance that moved the *other
       * way* from the decision — a hold that tightened, a cut that tightened.
       * That is the single most surprising thing this panel can report and the
       * one a player is most likely to miss, so it stays on the surface. */}
      {(change !== null || stance.realRateExPost !== null) && (
        <details className="group mt-3 border-t border-edge-room pt-3">
          <summary className="cursor-pointer list-none text-xs uppercase tracking-wide text-onwood-faint underline decoration-dotted underline-offset-2 marker:content-none">
            <span className="group-open:hidden">
              How the stance moved, and what households feel
            </span>
            <span className="hidden group-open:inline">Close</span>
          </summary>

      {change !== null && (
        <div className="mt-3">
          <dl className="mt-2 max-w-sm text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-onwood-soft">You moved the policy rate</dt>
              <dd className="tabular-nums text-onwood">{signed(change.nominal)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-onwood-soft">Expected inflation moved</dt>
              <dd className="tabular-nums text-onwood">
                {signed(change.expectations)}
              </dd>
            </div>
            <div className="mt-1 flex justify-between gap-4 border-t border-edge-room pt-1">
              <dt className="font-medium text-onwood">Real rate</dt>
              <dd className="font-medium tabular-nums text-onwood">
                {signed(change.real)}
              </dd>
            </div>
          </dl>

        </div>
      )}

      {!showsApproval && approval !== null && (
        <p className="mt-3 text-sm text-onwood-soft">
          Public trust reads{' '}
          <span className="tabular-nums text-onwood">{Math.round(approval)}</span>
          {approvalMove !== null && approvalMove !== 0
            ? `, ${approvalMove > 0 ? 'up' : 'down'} ${Math.abs(approvalMove)} since the last meeting`
            : ''}
          . {trust === null
            ? 'It is what the public makes of the prices and the jobs they are living with.'
            : trustSentence(trust)}
        </p>
      )}

      {stance.realRateExPost !== null && stance.headlineInflation !== null && (
        <p className="mt-3 text-xs text-onwood-faint">
          Households feel{' '}
          <span className="tabular-nums text-onwood-soft">
            {stance.realRateExPost.toFixed(2)} %
          </span>{' '}
          — the policy rate minus the {stance.headlineInflation.toFixed(2)} % inflation
          they are living through. The economy responds to the expectations measure
          above; the public reacts to this one. The two can point opposite ways.
        </p>
      )}
        </details>
      )}

      {change !== null && change.contradictory && (
        <p role="status" className="mt-3 text-sm text-accent-onwood">
          Your decision moved the stance the other way. Expected inflation moved
          further than the rate did, so{' '}
          {change.nominal > 0
            ? 'raising the rate left policy looser than before.'
            : 'cutting the rate left policy tighter than before.'}
        </p>
      )}

      {change !== null &&
        !change.contradictory &&
        change.nominal === 0 &&
        Math.abs(change.real) >= 0.05 && (
          <p className="mt-3 text-sm text-onwood-soft">
            You held, but the stance still moved{' '}
            {change.real > 0 ? 'tighter' : 'looser'}: expected inflation shifted
            underneath an unchanged rate. Holding is not a neutral act.
          </p>
        )}
    </section>
  )
}
