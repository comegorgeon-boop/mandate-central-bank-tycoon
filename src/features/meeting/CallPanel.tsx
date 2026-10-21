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
        aria-label="Your call, on the table"
        data-call="standing"
        className="py-1"
      >
        <p className="font-mono text-xs text-ink">
          {standing.centre.toFixed(2)} % give or take{' '}
          {terms.halfWidth.toFixed(2)} —{' '}
          {due <= 0
            ? 'settles with this decision.'
            : due === 1
              ? 'settles next meeting.'
              : `settles in ${due} meetings.`}
        </p>
        <p className="mt-1 font-mono text-2xs text-ink-faint">
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
      aria-label="Your call"
      data-call=""
      className="py-1"
    >
      {/* Seven words, not seventeen.
          "Published, and judged on the figure the agency gives" is true, and
          it is the same true thing at every meeting of every mandate — which
          makes it furniture rather than information. The quick surface's
          prose budget is frozen, so a clause that never changes is the first
          thing that has to go: it is on the card behind the row, where it is
          read once. */}
      <p className="font-mono text-xs text-ink-soft">
        Where headline inflation prints in {CALL_HORIZON} meetings.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-call-band="none"
          aria-pressed={centre === null}
          onClick={() => onChange(null, band)}
          className={`border px-3 py-1.5 font-mono text-sm ${
            centre === null
              ? 'border-edge-accent bg-accent-surface font-semibold text-on-accent-surface'
              : 'border-edge-room text-ink-soft hover:text-ink'
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
            className={`border px-3 py-1.5 font-mono text-sm ${
              centre !== null && band === entry.band
                ? 'border-edge-accent bg-accent-surface font-semibold text-on-accent-surface'
                : 'border-edge-room text-ink-soft hover:text-ink'
            }`}
          >
            ±{entry.halfWidth.toFixed(2)}
          </button>
        ))}
      </div>

      {centre !== null && (
        <>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-3">
            <label htmlFor="call-centre" className="text-sm text-ink-soft">
              Called at
            </label>
            <input
              id="call-centre"
              type="number"
              step={0.1}
              value={centre}
              onChange={(event) => onChange(Number(event.target.value), band)}
              className="w-24 border border-edge-room bg-page px-2 py-1 font-mono text-sm tabular-nums text-ink"
            />
            <span className="text-sm tabular-nums text-ink-soft">
              {(centre - active.halfWidth).toFixed(2)} to{' '}
              {(centre + active.halfWidth).toFixed(2)} %
            </span>
          </div>

          <dl className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <div className="flex items-center gap-2">
              <dt className="text-xs uppercase tracking-wide text-ink-faint">
                Inside
              </dt>
              <dd className="font-semibold tabular-nums text-good">
                +{active.reward.toFixed(1)}
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="text-xs uppercase tracking-wide text-ink-faint">
                Outside
              </dt>
              <dd className="font-semibold tabular-nums text-bad">
                −{active.cost.toFixed(1)}
              </dd>
            </div>
            <dd className="text-xs text-ink-faint">credibility, either way</dd>
          </dl>
        </>
      )}
    </section>
  )
}
