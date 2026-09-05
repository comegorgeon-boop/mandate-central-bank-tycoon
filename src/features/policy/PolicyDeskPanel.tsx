import { useMemo, useState } from 'react'
import {
  COMMUNICATION_AVAILABILITY,
  POLICY_RATE_FLOOR,
  committeeViews,
  detectContradictions,
  getDifficulty,
  getInstitution,
  getInstrument,
  getInstrumentRange,
  setsStandingLevel,
  standingLevel,
  staffRecommendation,
  type CommunicationCommitment,
  type CommunicationTone,
  type InstrumentId,
  type MeetingResult,
  type PolicyAction,
  type PolicyPackage,
  type PolicyValidation,
  type RunSession,
} from '../../simulation/index.ts'
import { BalanceSheetPanel } from './BalanceSheetPanel.tsx'
import { formatMagnitude } from './InstrumentStepper.tsx'
import { guidancePreview } from './guidancePreview.ts'
import { CommitteeSplitPanel } from './CommitteeSplitPanel.tsx'
import { CommunicationPanel } from './CommunicationPanel.tsx'
import { StaffAdvicePanel } from './StaffAdvicePanel.tsx'
import { StancePreview } from './StancePreview.tsx'
import { formatMeetings, transmissionLag } from './lag.ts'
import { pricedInSummary, rateEffectHint } from './rateCopy.ts'
import { buildStatement, deriveTone } from './statement.ts'

/**
 * The Policy Desk.
 *
 * What the committee can reach is `config/instruments.ts`'s
 * `availableInstruments`, not a list in this file: the rate and the words have
 * dedicated controls because each is a *change* rather than a level, and
 * everything else — the balance sheet, the facilities, the corridor — is
 * rendered generically from its own definition by `BalanceSheetPanel`. Allowed
 * moves, increments, floors and transmission characteristics all come from the
 * engine's configuration, so opening an instrument to a difficulty is a change
 * to the config and never to a screen.
 *
 * That indirection was already the intention and was not, until now, the fact:
 * the desk rendered a hard-coded policy rate at every difficulty, so four
 * instruments configured `availableFrom: 'medium'` when the toolkit was
 * written had never once been reachable by a player.
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
  // Standing levels the player has moved this meeting, keyed by instrument.
  // Absent means "leave it where it is", which is why this is a sparse record
  // rather than a full stance: an untouched facility must produce no action at
  // all, so the package says nothing about instruments the committee did not
  // discuss.
  const [levels, setLevels] = useState<Partial<Record<InstrumentId, number>>>({})
  // Only reachable where the difficulty lets the words depart from the deed.
  const [chosenTone, setChosenTone] = useState<CommunicationTone | null>(null)
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

  // Hard replaces the single recommendation with a divided committee rather
  // than removing advice altogether: an empty screen teaches nothing, while a
  // disagreement between colleagues reading the same numbers is exactly the
  // decision the mode is about.
  const committee = useMemo(
    () =>
      difficultyConfig.splitsCommittee
        ? committeeViews(session.observation, institution, difficulty)
        : [],
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

  // Only instruments the player actually moved reach the package. An
  // untouched facility must produce no action at all: `deriveStance` writes
  // every action it is given straight into the standing stance, so emitting
  // the current level as an action would be harmless today and a silent
  // overwrite the moment anything else could move a facility.
  const levelActions: PolicyAction[] = Object.entries(levels)
    .filter(([id, value]) => {
      const instrumentId = id as InstrumentId
      if (!setsStandingLevel(instrumentId)) return false
      const standing = standingLevel(session.state.stance, instrumentId) ?? 0
      return Math.abs(value - standing) > 1e-9
    })
    .map(([id, value]) => ({ instrument: id as InstrumentId, magnitude: value }))

  // The desk always publishes a statement. What varies is whether the words
  // put anything on the record: a remark colours the tone and no more, while
  // a leaning or a commitment registers the announced path with the engine.
  //
  // The tone is derived from the decision everywhere the difficulty does not
  // let the words depart from the deed. Where it does — hard only — saying one
  // thing while doing another becomes possible, which is what makes bluffing a
  // move rather than an impossibility. It is priced: `detectContradictions`
  // charges credibility and market trust for a package that argues with itself.
  const tone = chosenTone ?? deriveTone(move, signal, commitment)

  const buildPackage = (): PolicyPackage => ({
    actions: [
      ...(move === 0 ? [] : [{ instrument: 'policy_rate', magnitude: move } as const]),
      ...(commitment === 'none'
        ? []
        : [{ instrument: 'forward_guidance', magnitude: signal } as const]),
      ...levelActions,
    ],
    communication: {
      tone,
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
          {levelActions.map((action) => {
            const definition = getInstrument(action.instrument)
            if (definition === undefined) return null
            const standing = standingLevel(session.state.stance, action.instrument) ?? 0
            return (
              <div key={action.instrument} className="flex justify-between gap-4 py-2">
                <dt className="text-neutral-400">{definition.label[institution]}</dt>
                <dd className="tabular-nums text-neutral-50">
                  {formatMagnitude(standing, definition.unit)} →{' '}
                  {formatMagnitude(action.magnitude, definition.unit)}
                </dd>
              </div>
            )
          })}
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

        {commitment !== 'none' && (() => {
          // What the words are about to be worth, before they are published.
          // Measured paired over 120 seeds per bucket with the rate trajectory
          // held identical between the arms, saying this rather than nothing is
          // worth 78 to 173 points and closes 0.05 to 0.22 pp of the one-year
          // expectations miss — winning four seeds in five. The instrument was
          // never weak; nothing on the screen connected the sentence to the
          // numbers it moved. See `guidancePreview.ts`.
          const preview = guidancePreview({
            observation: session.observation,
            announcedRate: resultingRate + signal / 100,
            commitment,
            meetingIndex: session.state.meetingIndex,
          })
          const moved = Math.abs(preview.pricedPathMove) >= 0.01
          const pulled = Math.abs(preview.expectationsPullPerYear) >= 0.01

          return (
            <div className="mt-4 rounded border border-sky-900 bg-sky-950/30 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-sky-400">
                What the words are expected to do
              </h3>
              <ul className="mt-2 space-y-1 text-sm text-neutral-300">
                <li>
                  {moved
                    ? `Markets reprice the one-year path by about ${preview.pricedPathMove > 0 ? '+' : '−'}${Math.abs(preview.pricedPathMove).toFixed(2)} pp today, before any rate has moved.`
                    : 'Markets already price this path, so saying it moves them very little today.'}
                </li>
                <li>
                  {pulled
                    ? `One-year inflation expectations are pulled about ${preview.expectationsPullPerYear > 0 ? '+' : '−'}${Math.abs(preview.expectationsPullPerYear).toFixed(2)} pp a year for as long as this stands — ahead of anything the rate itself will do.`
                    : 'Expectations are barely moved: this announcement says little markets did not already assume.'}
                </li>
                {preview.binding && (
                  <li className="text-sky-200">
                    This is a promise, judged around meeting {preview.judgedAtMeeting}.
                    Binding is what makes the two effects above roughly twice the
                    size — and a promise the data moves out from under costs far
                    more than it bought.
                  </li>
                )}
              </ul>
              <p className="mt-2 text-xs text-neutral-500">
                An estimate of direction and rough size, read off the published
                credibility survey — which carries its own error, and markets owe
                nobody their reaction function.
              </p>
            </div>
          )
        })()}

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

      {committee.length > 0 && (
        <CommitteeSplitPanel views={committee} selectedMove={move} />
      )}

      <BalanceSheetPanel
        institution={institution}
        difficulty={difficulty}
        stance={session.state.stance}
        levels={levels}
        onChange={(id, next) => setLevels((current) => ({ ...current, [id]: next }))}
      />

      <CommunicationPanel
        move={move}
        signal={signal}
        commitment={commitment}
        allowedCommitments={COMMUNICATION_AVAILABILITY[difficulty].commitments}
        selectedRate={resultingRate}
        pricedRate={marketRate}
        guidance={session.state.guidance}
        meetingIndex={session.state.meetingIndex}
        observation={session.observation}
        derivedTone={deriveTone(move, signal, commitment)}
        chosenTone={difficultyConfig.choosesTone ? chosenTone : null}
        allowsFreeTone={difficultyConfig.choosesTone}
        onSignal={setSignal}
        onCommitment={setCommitment}
        onTone={setChosenTone}
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
