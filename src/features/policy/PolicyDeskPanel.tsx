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
  availableInstruments,
  setsStandingLevel,
  standingLevel,
  projectPackage,
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
import { InstrumentBrief } from './InstrumentBrief.tsx'
import { RateSlider, type GhostMarker } from './RateSlider.tsx'
import { InstrumentEffectPanel } from './InstrumentEffectPanel.tsx'
import { formatMagnitude } from './InstrumentStepper.tsx'
import { guidancePreview } from './guidancePreview.ts'
import { promiseLedger } from './promiseLedger.ts'
import { ProjectionPanel } from './ProjectionPanel.tsx'
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

/**
 * The benches: everything a decision may need, one click away.
 *
 * Not "advanced options". A committee's words are as much of the decision as
 * its rate, and the balance sheet is a standing instrument that keeps acting
 * whether or not it is looked at. What the bench buys is that only one of them
 * is open at a time, so the dial is the first thing on the desk rather than
 * the fifth.
 */
type BenchId = 'advice' | 'words' | 'toolkit'

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
  const [bench, setBench] = useState<BenchId>('advice')
  const [reviewing, setReviewing] = useState(false)
  const [validation, setValidation] = useState<PolicyValidation | null>(null)

  const { institution, difficulty } = session.state.config
  const instrument = getInstrument('policy_rate')
  const range = useMemo(
    () => (instrument ? getInstrumentRange(instrument, difficulty) : null),
    [instrument, difficulty],
  )

  const ledger = promiseLedger(session.state.guidance, difficulty)
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

  /**
   * The lowest move the track offers.
   *
   * Never one the engine would reject at the effective lower bound: a slider
   * that let the handle reach a value the validator refuses is a control
   * lying about what it does. Rounded *up* to the increment, so the floor is
   * respected rather than approached.
   */
  const sliderMin = useMemo(() => {
    if (range === null) return 0
    const lowest = (floor - currentRate) * 100
    const onGrid = Math.ceil(lowest / range.increment) * range.increment
    return Math.min(range.max, Math.max(range.min, onGrid))
  }, [range, currentRate, floor])

  if (instrument === undefined || range === null) {
    return <p className="text-ink-soft">The policy rate instrument is unavailable.</p>
  }

  const hasToolkit =
    availableInstruments(institution, difficulty).some(
      (entry) => setsStandingLevel(entry.id) && entry.id !== 'forward_guidance',
    )
  const benches: readonly { readonly id: BenchId; readonly label: string }[] = [
    { id: 'advice', label: 'The case' },
    { id: 'words', label: 'The words' },
    ...(hasToolkit ? [{ id: 'toolkit' as const, label: 'The toolkit' }] : []),
  ]

  const resultingRate = currentRate + move / 100
  const marketRate = session.observation.indicators.market_expected_rate?.value ?? null
  const pricedGap =
    marketRate === null ? 0 : Math.round((marketRate - currentRate) * 100)

  // The two references, in basis points of move so they sit on the same
  // track as the handle. See `RateSlider`.
  const markers: GhostMarker[] = []
  if (marketRate !== null) {
    markers.push({
      id: 'market',
      label: 'priced',
      basisPoints:
        Math.round(((marketRate - currentRate) * 100) / range.increment) *
        range.increment,
      rate: marketRate,
    })
  }
  markers.push({
    id: 'taylor',
    label: 'rule of thumb',
    basisPoints:
      Math.round(
        ((session.observation.taylorBenchmark - currentRate) * 100) /
          range.increment,
      ) * range.increment,
    rate: session.observation.taylorBenchmark,
  })


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
        <h2 id="confirm-heading" className="text-lg font-semibold text-ink">
          Confirm the policy package
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Review the whole package before it is put to the committee. Once confirmed,
          the decision is recorded and time advances to the next meeting.
        </p>

        <dl className="mt-4 divide-y divide-edge border-y border-edge text-sm">
          <div className="flex justify-between gap-4 py-2">
            <dt className="text-ink-soft">{instrument.label[institution]}</dt>
            <dd className="tabular-nums text-ink">{formatMove(move)}</dd>
          </div>
          <div className="flex justify-between gap-4 py-2">
            <dt className="text-ink-soft">Rate after the decision</dt>
            <dd className="tabular-nums text-ink">
              {currentRate.toFixed(2)} % → {resultingRate.toFixed(2)} %
            </dd>
          </div>
          {levelActions.map((action) => {
            const definition = getInstrument(action.instrument)
            if (definition === undefined) return null
            const standing = standingLevel(session.state.stance, action.instrument) ?? 0
            return (
              <div key={action.instrument} className="flex justify-between gap-4 py-2">
                <dt className="text-ink-soft">{definition.label[institution]}</dt>
                <dd className="tabular-nums text-ink">
                  {formatMagnitude(standing, definition.unit)} →{' '}
                  {formatMagnitude(action.magnitude, definition.unit)}
                </dd>
              </div>
            )
          })}
          <div className="flex flex-col gap-1 py-2">
            <dt className="text-ink-soft">The statement</dt>
            <dd className="italic text-ink">
              {buildStatement(move, signal, commitment)}
            </dd>
            {commitment === 'conditional_path' && (
              <dd className="text-xs text-ink-faint">
                This is a promise. It is judged in about a year — delivered, or
                broken at a lasting cost to credibility.
              </dd>
            )}
          </div>
        </dl>

        {contradictions.length > 0 && (
          <div className="mt-3 rounded border border-accent bg-accent-surface p-3 text-sm text-accent-strong">
            <p className="font-medium">Mixed signals</p>
            <ul className="mt-1 list-disc pl-5">
              {contradictions.map((contradiction) => (
                <li key={contradiction.code}>{contradiction.message}</li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-accent-strong">
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
            <div className="mt-4 rounded border border-edge-accent bg-sunk p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-accent-strong">
                What the words are expected to do
              </h3>
              <ul className="mt-2 space-y-1 text-sm text-ink-soft">
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
                  <li className="text-accent-strong">
                    This is a promise, judged around meeting {preview.judgedAtMeeting}.
                    Binding is what makes the two effects above roughly twice the
                    size. Delivering it earns{' '}
                    <span className="tabular-nums">
                      +{ledger.nextKeptGain.toFixed(1)}
                    </span>{' '}
                    credibility; moving against it without a shock to justify it
                    costs{' '}
                    <span className="tabular-nums">
                      −{ledger.nextBrokenCredibility.toFixed(0)}
                    </span>{' '}
                    credibility and{' '}
                    <span className="tabular-nums">
                      −{ledger.nextBrokenMarket.toFixed(0)}
                    </span>{' '}
                    market trust, permanently.
                  </li>
                )}
              </ul>
              <p className="mt-2 text-xs text-ink-faint">
                An estimate of direction and rough size, read off the published
                credibility survey — which carries its own error, and markets owe
                nobody their reaction function.
              </p>
            </div>
          )
        })()}

        {/* Per instrument, at every difficulty. A dial's own effect is not a
            reading of the economy, so the information ladder has no claim on
            it — see `InstrumentEffectPanel`. */}
        <InstrumentEffectPanel
          state={session.state}
          actions={buildPackage().actions}
        />

        {/* The learning mandate gets the whole package projected, not just the
            words: it is the mode where a player is meant to form an
            expectation and then check it. Above easy the projection is
            withdrawn with the rest of the reading — see the information
            ladder — and the fan charts remain. */}
        {difficultyConfig.showsPolicyHints &&
          (() => {
            const projection = projectPackage(session.state, buildPackage())
            return projection === null ? null : (
              <ProjectionPanel projection={projection} />
            )
          })()}

        <StancePreview observation={session.observation} move={move} />

        <p className="mt-3 text-sm text-ink-soft">
          {pricedInSummary(move, pricedGap)}
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          Peak effect on inflation and output expected around{' '}
          {formatMeetings(lag.peakMeetings)} from now. Markets and the priced path,
          however, respond the moment this is announced.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={confirm}
            className="rounded-md border border-good bg-good-surface px-4 py-2 text-sm font-semibold text-good-strong shadow-panel transition-colors hover:bg-panel"
          >
            Confirm and advance
          </button>
          <button
            type="button"
            onClick={() => setReviewing(false)}
            className="rounded border border-edge px-4 py-2 text-sm text-ink hover:bg-sunk"
          >
            Back to the desk
          </button>
        </div>
      </section>
    )
  }

  return (
    <section aria-labelledby="desk-heading">
      <h2 id="desk-heading" className="text-lg font-semibold text-ink">
        Policy Desk
      </h2>

      {validation !== null && validation.rejections.length > 0 && (
        <div
          role="alert"
          className="mt-4 rounded border border-bad bg-bad-surface p-3 text-sm text-bad-strong"
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

      <div className="mt-4">
        <RateSlider
          label={instrument.label[institution]}
          currentRate={currentRate}
          value={move}
          min={sliderMin}
          max={range.max}
          step={range.increment}
          markers={markers}
          onChange={setMove}
        />
        <InstrumentBrief instrument={instrument} range={range} value={move} />
        {sliderMin > range.min && (
          <p className="mt-1.5 text-xs text-ink-faint">
            The track stops at {formatMove(sliderMin)} because the rate cannot
            be set below the {floor.toFixed(2)} % effective lower bound.
          </p>
        )}
      </div>

      {/* The number that counts, and one sentence about it.
       *
       * Everything else on this desk moved behind a bench below. What stays is
       * what a chair needs in front of them to make the decision: the dial,
       * the rate it lands on, and what that does to the stance. The screen's
       * standing complaint is that there is too much on it, and a desk with
       * five panels open at once is a desk where the dial is the fifth thing
       * you see. */}
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-y border-edge py-3">
        <span className="text-sm text-ink-soft">The rate after this decision</span>
        <span className="font-display text-2xl font-semibold tabular-nums text-ink">
          {resultingRate.toFixed(2)} %
        </span>
      </div>

      <StancePreview observation={session.observation} move={move} />

      <p className="mt-2 text-sm text-ink-soft">
        {pricedInSummary(move, pricedGap)}
        {showsHints ? ` ${rateEffectHint(move)}` : ''}
      </p>

      {/* The bench. Everything a decision *may* need, one click away and never
          two of them open at once. */}
      <div
        role="tablist"
        aria-label="Policy desk"
        className="mt-5 flex flex-wrap gap-1 border-b border-edge"
      >
        {benches.map((entry) => {
          const selected = entry.id === bench
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              id={`bench-${entry.id}`}
              aria-selected={selected}
              aria-controls={`benchpanel-${entry.id}`}
              onClick={() => setBench(entry.id)}
              className={`-mb-px rounded-t border border-b-0 px-3 py-1.5 text-sm ${
                selected
                  ? 'border-edge bg-sunk font-semibold text-ink'
                  : 'border-transparent text-ink-soft hover:text-ink'
              }`}
            >
              {entry.label}
            </button>
          )
        })}
      </div>

      <div
        role="tabpanel"
        id={`benchpanel-${bench}`}
        aria-labelledby={`bench-${bench}`}
        tabIndex={-1}
        className="rounded-b border border-t-0 border-edge bg-sunk/40 p-3"
      >
        {bench === 'advice' && (
          <>
            {advice !== null && (
              <StaffAdvicePanel recommendation={advice} selectedMove={move} />
            )}
            {committee.length > 0 && (
              <CommitteeSplitPanel views={committee} selectedMove={move} />
            )}
            <p className="mt-3 text-xs text-ink-faint">
              Peak effect around {formatMeetings(lag.peakMeetings)} from now,
              mostly delivered within {formatMeetings(lag.spanMeetings)}. Too
              little tightening lets inflation and expectations drift; too much
              cools employment and strains the financial system. The
              institution&rsquo;s standing depends on that balance over the
              whole mandate, not at any one meeting.
            </p>
          </>
        )}

        {bench === 'words' && (
          <CommunicationPanel
            move={move}
            signal={signal}
            commitment={commitment}
            allowedCommitments={COMMUNICATION_AVAILABILITY[difficulty].commitments}
            difficulty={difficulty}
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
        )}

        {bench === 'toolkit' && (
          <BalanceSheetPanel
            institution={institution}
            difficulty={difficulty}
            stance={session.state.stance}
            balanceSheet={session.observation.indicators.balance_sheet?.value ?? null}
            levels={levels}
            onChange={(id, next) =>
              setLevels((current) => ({ ...current, [id]: next }))
            }
          />
        )}
      </div>

      <button
        type="button"
        onClick={() => setReviewing(true)}
        className="mt-5 rounded-md border border-edge-accent bg-accent px-4 py-2 text-sm font-semibold text-on-accent shadow-panel transition-colors hover:bg-accent-onwood"
      >
        Review policy package
      </button>

      <p className="mt-2 text-xs text-ink-faint">
        {getInstitution(institution).name} mandate — simplified fictional simulation,
        not an official product of any central bank.
      </p>
    </section>
  )
}
