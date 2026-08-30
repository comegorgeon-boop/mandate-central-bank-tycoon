import {
  readStance,
  readStanceChange,
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
  restrictive: 'text-sky-300',
  neutral: 'text-neutral-300',
  accommodative: 'text-amber-300',
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
        <dt className="text-xs uppercase tracking-wide text-neutral-500">Stance</dt>
        <dd>
          <span className="text-lg font-semibold text-neutral-400">UNAVAILABLE</span>
          <span className="mt-0.5 block text-xs text-neutral-500">
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
      <dt className="text-xs uppercase tracking-wide text-neutral-500">Stance</dt>
      <dd>
        <span className={`text-lg font-semibold ${LABEL_STYLE[stance.label]}`}>
          {LABEL_TEXT[stance.label]}
        </span>
        <span className="mt-0.5 block text-xs text-neutral-400">
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
}: {
  readonly observation: ObservationSet
  readonly previousObservation: ObservationSet | null
}) {
  const stance = readStance(observation)
  const change = readStanceChange(observation, previousObservation)
  const credibility = observation.indicators.credibility_index?.value ?? null
  const previousCredibility =
    previousObservation?.indicators.credibility_index?.value ?? null
  const credibilityMove =
    credibility === null || previousCredibility === null
      ? null
      : Math.round(credibility - previousCredibility)

  return (
    <section
      aria-label="Policy stance"
      className="mt-4 rounded border border-neutral-800 bg-neutral-900/60 p-4"
    >
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">
            Policy rate
          </dt>
          <dd>
            <span className="text-lg font-semibold tabular-nums text-neutral-50">
              {stance.nominalRate === null ? '—' : `${stance.nominalRate.toFixed(2)} %`}
            </span>
            <span className="mt-0.5 block text-xs text-neutral-400">
              {change === null
                ? 'The rate you set. On its own it says nothing about tight or loose.'
                : `${signed(change.nominal)} since the last meeting.`}
            </span>
          </dd>
        </div>

        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Real rate</dt>
          <dd>
            <span className="text-lg font-semibold tabular-nums text-neutral-50">
              {stance.realRate === null ? '—' : `${stance.realRate.toFixed(2)} %`}
            </span>
            <span className="mt-0.5 block text-xs text-neutral-400">
              Policy rate minus expected inflation
              {stance.expectedInflation !== null &&
                ` (${stance.expectedInflation.toFixed(2)} %)`}
              . This is the rate the economy responds to.
            </span>
          </dd>
        </div>

        <StanceLabelBlock stance={stance} />

        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">
            Your word
          </dt>
          <dd>
            <span className="text-lg font-semibold tabular-nums text-neutral-50">
              {credibility === null ? '—' : Math.round(credibility)}
            </span>
            <span className="mt-0.5 block text-xs text-neutral-400">
              {credibilityMove !== null && credibilityMove !== 0
                ? `${credibilityMove > 0 ? '+' : '−'}${Math.abs(credibilityMove)} since ` +
                  'the last meeting. '
                : ''}
              How far your statements are believed — it scales everything they do.
            </span>
          </dd>
        </div>
      </dl>

      {stance.label !== null && (
        <p className="mt-3 text-sm text-neutral-300">{LABEL_MEANING[stance.label]}</p>
      )}

      {change !== null && (
        <div className="mt-3 border-t border-neutral-800 pt-3">
          <h3 className="text-xs uppercase tracking-wide text-neutral-500">
            How the stance moved since the last meeting
          </h3>
          <dl className="mt-2 max-w-sm text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-400">You moved the policy rate</dt>
              <dd className="tabular-nums text-neutral-200">{signed(change.nominal)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-400">Expected inflation moved</dt>
              <dd className="tabular-nums text-neutral-200">
                {signed(change.expectations)}
              </dd>
            </div>
            <div className="mt-1 flex justify-between gap-4 border-t border-neutral-700 pt-1">
              <dt className="font-medium text-neutral-200">Real rate</dt>
              <dd className="font-medium tabular-nums text-neutral-50">
                {signed(change.real)}
              </dd>
            </div>
          </dl>

          {change.contradictory && (
            <p role="status" className="mt-2 text-sm text-amber-300">
              Your decision moved the stance the other way. Expected inflation moved
              further than the rate did, so{' '}
              {change.nominal > 0
                ? 'raising the rate left policy looser than before.'
                : 'cutting the rate left policy tighter than before.'}
            </p>
          )}

          {!change.contradictory && change.nominal === 0 && Math.abs(change.real) >= 0.05 && (
            <p className="mt-2 text-sm text-neutral-400">
              You held, but the stance still moved{' '}
              {change.real > 0 ? 'tighter' : 'looser'}: expected inflation shifted
              underneath an unchanged rate. Holding is not a neutral act.
            </p>
          )}
        </div>
      )}

      {stance.realRateExPost !== null && stance.headlineInflation !== null && (
        <p className="mt-3 border-t border-neutral-800 pt-3 text-xs text-neutral-500">
          Households feel{' '}
          <span className="tabular-nums text-neutral-400">
            {stance.realRateExPost.toFixed(2)} %
          </span>{' '}
          — the policy rate minus the {stance.headlineInflation.toFixed(2)} % inflation
          they are living through. The economy responds to the expectations measure
          above; the public reacts to this one. The two can point opposite ways.
        </p>
      )}
    </section>
  )
}
