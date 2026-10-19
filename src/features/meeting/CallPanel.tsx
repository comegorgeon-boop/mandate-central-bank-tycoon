import {
  CALL_HORIZON,
  allCallTerms,
  callStake,
  inflationTargetFor,
  type CallBand,
  type RunSession,
} from '../../simulation/index.ts'

/**
 * The call: where inflation will be, and how much you are willing to say it.
 *
 * > "Une fourchette large rapporte peu et coûte peu, une fourchette serrée
 * > rapporte gros et coûte cher. C'est l'arbitrage entre crédibilité et
 * > flexibilité."
 *
 * Three bands, chosen with the stake on screen, settled two meetings later
 * against the figure the agency prints. Declining is always on offer and is
 * the default: a committee that must wager every meeting is not wagering.
 *
 * ## The cost is larger than the reward at every band
 *
 * Deliberately, and the panel shows both so it is not a trick. A forecast is
 * a promise, and the asymmetry between keeping and breaking one is the
 * mechanism the whole credibility block models. Symmetric odds would make the
 * tightest band free expected value and the trade would stop being a trade.
 */
export function CallPanel({
  session,
  centre,
  band,
  onChange,
}: {
  readonly session: RunSession
  /** The figure currently called, or null when declining. */
  readonly centre: number | null
  readonly band: CallBand
  readonly onChange: (centre: number | null, band: CallBand) => void
}) {
  const printed = session.observation.indicators.headline_inflation?.value ?? null
  const target = inflationTargetFor(session.state.config)
  const suggestion = printed ?? target

  // A call cannot be settled after the mandate ends, so it is not offered
  // where there is no time left to settle it. Offering a wager that can never
  // pay is worse than offering none.
  const remaining = session.state.config.meetingCount - session.state.meetingIndex
  if (remaining <= CALL_HORIZON) return null

  // A call already on the table. It cannot be replaced — that is what makes it
  // a wager rather than a rolling forecast — so the panel shows it standing
  // and says when it comes due, instead of offering a bet the engine would
  // refuse.
  const standing = session.state.call
  if (standing !== null) {
    const terms = callStake(session.state, standing.band)
    const due = standing.issuedAtMeeting + CALL_HORIZON - session.state.meetingIndex
    return (
      <section
        aria-labelledby="call-heading"
        data-call="standing"
        className="mt-4 rounded-md border border-edge-accent bg-inset p-3"
      >
        <p
          id="call-heading"
          className="text-2xs font-semibold uppercase tracking-[0.14em] text-onwood-faint"
        >
          Your call, on the table
        </p>
        <p className="mt-1 text-sm text-onwood">
          {standing.centre.toFixed(2)} % give or take{' '}
          {terms.halfWidth.toFixed(2)} —{' '}
          {due <= 0
            ? 'settles with this decision.'
            : due === 1
              ? 'settles next meeting.'
              : `settles in ${due} meetings.`}
        </p>
        <p className="mt-1 text-xs text-onwood-faint">
          +{terms.reward.toFixed(1)} inside, −{terms.cost.toFixed(1)} outside.
          It cannot be withdrawn.
        </p>
      </section>
    )
  }

  const terms = allCallTerms().map((entry) => callStake(session.state, entry.band))
  const active = terms.find((entry) => entry.band === band) ?? terms[0]

  return (
    <section
      aria-labelledby="call-heading"
      data-call=""
      className="mt-4 rounded-md border border-edge-room bg-inset p-3"
    >
      <p
        id="call-heading"
        className="text-2xs font-semibold uppercase tracking-[0.14em] text-onwood-faint"
      >
        Your call
      </p>
      <p className="mt-1 text-sm text-onwood-soft">
        Where headline inflation prints in {CALL_HORIZON} meetings. Published,
        and judged on the figure the agency gives.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-call-band="none"
          aria-pressed={centre === null}
          onClick={() => onChange(null, band)}
          className={`rounded-md border px-3 py-1.5 text-sm ${
            centre === null
              ? 'border-edge-accent bg-accent-surface font-semibold text-on-accent-surface'
              : 'border-edge-room text-onwood-soft hover:text-onwood'
          }`}
        >
          Say nothing
        </button>

        {terms.map((entry) => (
          <button
            key={entry.band}
            type="button"
            data-call-band={entry.band}
            aria-pressed={centre !== null && band === entry.band}
            onClick={() => onChange(centre ?? Math.round(suggestion * 10) / 10, entry.band)}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              centre !== null && band === entry.band
                ? 'border-edge-accent bg-accent-surface font-semibold text-on-accent-surface'
                : 'border-edge-room text-onwood-soft hover:text-onwood'
            }`}
          >
            ±{entry.halfWidth.toFixed(2)}
          </button>
        ))}
      </div>

      {centre !== null && (
        <>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-3">
            <label htmlFor="call-centre" className="text-sm text-onwood-soft">
              Called at
            </label>
            <input
              id="call-centre"
              type="number"
              step={0.1}
              value={centre}
              onChange={(event) => onChange(Number(event.target.value), band)}
              className="w-24 rounded-md border border-edge-room bg-page px-2 py-1 text-sm tabular-nums text-onwood"
            />
            <span className="text-sm tabular-nums text-onwood-soft">
              {(centre - active.halfWidth).toFixed(2)} to{' '}
              {(centre + active.halfWidth).toFixed(2)} %
            </span>
          </div>

          <dl className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <div className="flex items-center gap-2">
              <dt className="text-xs uppercase tracking-wide text-onwood-faint">
                Inside
              </dt>
              <dd className="font-semibold tabular-nums text-good-onwood">
                +{active.reward.toFixed(1)}
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="text-xs uppercase tracking-wide text-onwood-faint">
                Outside
              </dt>
              <dd className="font-semibold tabular-nums text-bad-onwood">
                −{active.cost.toFixed(1)}
              </dd>
            </div>
            <dd className="text-xs text-onwood-faint">credibility, either way</dd>
          </dl>
        </>
      )}
    </section>
  )
}
