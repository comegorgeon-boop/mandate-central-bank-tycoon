import { useMemo, useState } from 'react'
import {
  COMMUNICATION_AVAILABILITY,
  POLICY_RATE_FLOOR,
  detectContradictions,
  getDifficulty,
  getInstitution,
  getInstrument,
  getInstrumentRange,
  staffRecommendation,
  type CommunicationCommitment,
  type MeetingResult,
  type PolicyPackage,
  type PolicyValidation,
  type RunSession,
} from '../../simulation/index.ts'
import { CommunicationPanel } from './CommunicationPanel.tsx'
import { StaffAdvicePanel } from './StaffAdvicePanel.tsx'
import { StancePreview } from './StancePreview.tsx'
import { formatMeetings, transmissionLag } from './lag.ts'
import { pricedInSummary, rateEffectHint } from './rateCopy.ts'
import { buildStatement, deriveTone } from './statement.ts'

/**
 * The Policy Desk.
 *
 * This build exposes a single instrument, the policy rate. Its allowed moves,
 * increments, floor and transmission characteristics all come from the
 * engine's configuration rather than from this component, so unlocking the
 * rest of the toolkit later means rendering more instruments, not rewriting
 * the arithmetic.
 */

const CHANNEL_LABEL: Readonly<Record<string, string>> = {
  interest_rate: 'Interest rates',
  credit: 'Credit',
  asset_prices: 'Asset prices',
  exchange_rate: 'Exchange rate',
  expectations: 'Expectations',
  bank_liquidity: 'Bank liquidity',
  sovereign_spreads: 'Sovereign spreads',
}

function formatMove(basisPoints: number): string {
  if (basisPoints === 0) return 'Hold'
  return `${basisPoints > 0 ? '+' : '−'}${Math.abs(basisPoints)} bp`
}

export function PolicyDeskPanel({
  session,
  onConfirm,
}: {
  readonly session: RunSession
  /**
   * Submits the package. Returns the engine's verdict: a rejected package
   * leaves the run untouched and sends the player back to the desk with the
   * reasons attached.
   */
  readonly onConfirm: (pkg: PolicyPackage) => MeetingResult
}) {
  const [move, setMove] = useState(0)
  const [signal, setSignal] = useState(0)
  const [commitment, setCommitment] = useState<CommunicationCommitment>('none')
  const [reviewing, setReviewing] = useState(false)
  const [validation, setValidation] = useState<PolicyValidation | null>(null)

  const { institution, difficulty } = session.state.config
  const instrument = getInstrument('policy_rate')
  const range = useMemo(
    () => (instrument ? getInstrumentRange(instrument, difficulty) : null),
    [instrument, difficulty],
  )

  const currentRate = session.state.stance.targetRate
  const floor = POLICY_RATE_FLOOR[institution]
  const lag = useMemo(() => transmissionLag(difficulty), [difficulty])
  const difficultyConfig = getDifficulty(difficulty)
  const showsHints = difficultyConfig.showsPolicyHints

  const advice = useMemo(
    () =>
      difficultyConfig.showsStaffRecommendation
        ? staffRecommendation(session.observation, institution, difficulty)
        : null,
    [difficultyConfig, session.observation, institution, difficulty],
  )

  const options = useMemo(() => {
    if (range === null) return []
    const result: number[] = []
    for (let bp = range.min; bp <= range.max + 1e-9; bp += range.increment) {
      const rounded = Math.round(bp)
      // Never offer a move the engine would reject at the lower bound.
      if (currentRate + rounded / 100 >= floor - 1e-9) result.push(rounded)
    }
    return result
  }, [range, currentRate, floor])

  if (instrument === undefined || range === null) {
    return <p className="text-neutral-300">The policy rate instrument is unavailable.</p>
  }

  const resultingRate = currentRate + move / 100
  const marketRate = session.observation.indicators.market_expected_rate?.value ?? null
  const pricedGap =
    marketRate === null ? 0 : Math.round((marketRate - currentRate) * 100)

  // The desk always publishes a statement. What varies is whether the words
  // put anything on the record: a remark colours the tone and no more, while
  // a leaning or a commitment registers the announced path with the engine.
  const buildPackage = (): PolicyPackage => ({
    actions: [
      ...(move === 0 ? [] : [{ instrument: 'policy_rate', magnitude: move } as const]),
      ...(commitment === 'none'
        ? []
        : [{ instrument: 'forward_guidance', magnitude: signal } as const]),
    ],
    communication: {
      tone: deriveTone(move, signal, commitment),
      emphasis: 'inflation',
      commitment,
      channel: 'statement',
    },
  })

  const confirm = (): void => {
    const result = onConfirm(buildPackage())
    if (result.ok) return
    setValidation(result.validation)
    setReviewing(false)
  }

  if (reviewing) {
    const contradictions = detectContradictions(session.state, buildPackage())
    return (
      <section aria-labelledby="confirm-heading">
        <h2 id="confirm-heading" className="text-lg font-semibold text-neutral-50">
          Confirm the policy package
        </h2>
        <p className="mt-1 text-sm text-neutral-400">
          Review the whole package before it is put to the committee. Once confirmed,
          the decision is recorded and time advances to the next meeting.
        </p>

        <dl className="mt-4 divide-y divide-neutral-800 border-y border-neutral-800 text-sm">
          <div className="flex justify-between gap-4 py-2">
            <dt className="text-neutral-400">{instrument.label[institution]}</dt>
            <dd className="tabular-nums text-neutral-50">{formatMove(move)}</dd>
          </div>
          <div className="flex justify-between gap-4 py-2">
            <dt className="text-neutral-400">Rate after the decision</dt>
            <dd className="tabular-nums text-neutral-50">
              {currentRate.toFixed(2)} % → {resultingRate.toFixed(2)} %
            </dd>
          </div>
          <div className="flex flex-col gap-1 py-2">
            <dt className="text-neutral-400">The statement</dt>
            <dd className="italic text-neutral-200">
              {buildStatement(move, signal, commitment)}
            </dd>
            {commitment === 'conditional_path' && (
              <dd className="text-xs text-neutral-500">
                This is a promise. It is judged in about a year — delivered, or
                broken at a lasting cost to credibility.
              </dd>
            )}
          </div>
        </dl>

        {contradictions.length > 0 && (
          <div className="mt-3 rounded border border-amber-700 bg-amber-950/40 p-3 text-sm text-amber-200">
            <p className="font-medium">Mixed signals</p>
            <ul className="mt-1 list-disc pl-5">
              {contradictions.map((contradiction) => (
                <li key={contradiction.code}>{contradiction.message}</li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-amber-300/80">
              You can confirm it anyway — committees sometimes mean to — but
              markets charge credibility for a package that argues with itself.
            </p>
          </div>
        )}

        <StancePreview observation={session.observation} move={move} />

        <p className="mt-3 text-sm text-neutral-400">
          {pricedInSummary(move, pricedGap)}
        </p>
        <p className="mt-2 text-sm text-neutral-400">
          Peak effect on inflation and output expected around{' '}
          {formatMeetings(lag.peakMeetings)} from now. Markets and the priced path,
          however, respond the moment this is announced.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={confirm}
            className="rounded border border-emerald-600 bg-emerald-900/40 px-4 py-2 text-sm font-medium text-emerald-100 hover:bg-emerald-900/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
          >
            Confirm and advance
          </button>
          <button
            type="button"
            onClick={() => setReviewing(false)}
            className="rounded border border-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
          >
            Back to the desk
          </button>
        </div>
      </section>
    )
  }

  return (
    <section aria-labelledby="desk-heading">
      <h2 id="desk-heading" className="text-lg font-semibold text-neutral-50">
        Policy Desk
      </h2>
      <p className="mt-1 text-sm text-neutral-400">{instrument.description}</p>

      {validation !== null && validation.rejections.length > 0 && (
        <div
          role="alert"
          className="mt-4 rounded border border-red-800 bg-red-950/50 p-3 text-sm text-red-200"
        >
          <p className="font-medium">The package was rejected.</p>
          <ul className="mt-1 list-disc pl-5">
            {validation.rejections.map((rejection) => (
              <li key={`${rejection.code}-${rejection.instrument ?? 'none'}`}>
                {rejection.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-neutral-200">
          {instrument.label[institution]} — currently {currentRate.toFixed(2)} %
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {options.map((option) => {
            const selected = option === move
            return (
              <button
                key={option}
                type="button"
                aria-pressed={selected}
                onClick={() => setMove(option)}
                className={`rounded border px-3 py-2 text-sm tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400 ${
                  selected
                    ? 'border-neutral-300 bg-neutral-200 font-semibold text-neutral-900'
                    : 'border-neutral-700 text-neutral-200 hover:bg-neutral-800'
                }`}
              >
                {formatMove(option)}
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Moves in steps of {range.increment} bp, from {range.min} to {range.max} bp.
          The rate cannot be set below the {floor.toFixed(2)} % effective lower bound.
        </p>
      </fieldset>

      <StancePreview observation={session.observation} move={move} />

      {advice !== null && (
        <StaffAdvicePanel recommendation={advice} selectedMove={move} />
      )}

      <CommunicationPanel
        move={move}
        signal={signal}
        commitment={commitment}
        allowedCommitments={COMMUNICATION_AVAILABILITY[difficulty].commitments}
        selectedRate={resultingRate}
        pricedRate={marketRate}
        guidance={session.state.guidance}
        meetingIndex={session.state.meetingIndex}
        onSignal={setSignal}
        onCommitment={setCommitment}
      />

      <dl className="mt-5 divide-y divide-neutral-800 border-y border-neutral-800 text-sm">
        <div className="flex justify-between gap-4 py-2">
          <dt className="text-neutral-400">Resulting policy rate</dt>
          <dd className="tabular-nums text-neutral-50">{resultingRate.toFixed(2)} %</dd>
        </div>
        <div className="flex justify-between gap-4 py-2">
          <dt className="text-neutral-400">Transmission channels</dt>
          <dd className="text-right text-neutral-200">
            {instrument.channels.map((channel) => CHANNEL_LABEL[channel] ?? channel).join(', ')}
          </dd>
        </div>
        <div className="flex justify-between gap-4 py-2">
          <dt className="text-neutral-400">Expected lag</dt>
          <dd className="text-right text-neutral-200">
            peaks around {formatMeetings(lag.peakMeetings)}, mostly delivered within{' '}
            {formatMeetings(lag.spanMeetings)}
          </dd>
        </div>
        <div className="flex justify-between gap-4 py-2">
          <dt className="text-neutral-400">Priced in?</dt>
          <dd className="max-w-md text-right text-neutral-200">
            {pricedInSummary(move, pricedGap)}
          </dd>
        </div>
      </dl>

      {showsHints && (
        <div className="mt-4 rounded border border-neutral-800 bg-neutral-900 p-3">
          <h3 className="text-sm font-medium text-neutral-200">Estimated effect</h3>
          <p className="mt-1 text-sm text-neutral-400">{rateEffectHint(move)}</p>
          <p className="mt-2 text-xs text-neutral-500">
            An estimate of direction, not a promise of magnitude. The economy is
            simultaneously being moved by forces this desk does not control.
          </p>
        </div>
      )}

      <p className="mt-4 text-xs text-neutral-500">
        Risks both ways: too little tightening lets inflation and expectations drift,
        while too much cools employment and can strain the financial system. The
        institution&rsquo;s standing depends on getting that balance right over the
        whole mandate, not at any one meeting.
      </p>

      <button
        type="button"
        onClick={() => setReviewing(true)}
        className="mt-5 rounded border border-neutral-300 bg-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
      >
        Review policy package
      </button>

      <p className="mt-2 text-xs text-neutral-500">
        {getInstitution(institution).name} mandate — simplified fictional simulation,
        not an official product of any central bank.
      </p>
    </section>
  )
}
