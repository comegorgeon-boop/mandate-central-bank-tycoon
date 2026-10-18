import type {
  CommunicationCommitment,
  CommunicationTone,
  Difficulty,
  GuidanceState,
  ObservationSet,
} from '../../simulation/index.ts'
import {
  GUIDANCE_HORIZON_MEETINGS,
  getInstrument,
  getInstrumentRange,
} from '../../simulation/index.ts'
import { InstrumentBrief } from './InstrumentBrief.tsx'
import { PromisePanel } from './PromisePanel.tsx'
import { promiseLedger } from './promiseLedger.ts'
import {
  COMMITMENT_OPTIONS,
  PATH_OPTIONS,
  TONE_OPTIONS,
  buildStatement,
} from './statement.ts'

/**
 * A read of how keyed-up markets are, from published data only — never
 * latent state, matching every other panel in this build. Deliberately
 * cruder than the engine's own `crisisIntensity`: this only has to tell the
 * player *whether* their words are about to land harder than usual, not by
 * how much.
 */
type MarketMood = 'calm' | 'tense' | 'panicked'

const MOOD_COPY: Readonly<Record<MarketMood, string>> = {
  calm: 'Markets are calm. Words move them, but not by much.',
  tense:
    'Markets are on edge. What you say here will move them harder than usual — ' +
    'reassurance can pay, and staying quiet is not a neutral choice.',
  panicked:
    'Markets are in open distress. This statement will move them hard — a ' +
    'reassurance backed by real action pays; empty calm, or silence, costs.',
}

function marketMood(observation: ObservationSet): MarketMood {
  const volatility = observation.indicators.market_volatility?.value ?? null
  if (volatility === null) return 'calm'
  if (volatility >= 45) return 'panicked'
  if (volatility >= 24) return 'tense'
  return 'calm'
}

/**
 * The communication half of the Policy Desk.
 *
 * Two plain-language choices — where the rate is heading, and how firmly the
 * committee means it — with the basis points as footnotes rather than as the
 * controls. The resulting statement is shown verbatim before it is confirmed,
 * because the statement, not the menu, is what the player is publishing.
 *
 * The standing promise, when there is one, is shown first: a promise the
 * player cannot see is a promise they will break by accident, and the ledger
 * prices exactly that.
 */

const selectedClasses =
  'border-edge-accent bg-accent font-semibold text-on-accent'
const unselectedClasses = 'border-edge text-ink hover:bg-sunk'
const buttonBase =
  'rounded border px-3 py-2 text-sm text-left'

function isBinding(commitment: CommunicationCommitment): boolean {
  return commitment === 'conditional_path' || commitment === 'strong_commitment'
}

function StandingGuidance({
  guidance,
  meetingIndex,
  currentRate,
}: {
  readonly guidance: GuidanceState
  readonly meetingIndex: number
  readonly currentRate: number
}) {
  const path = guidance.impliedRatePath
  if (path === null) return null

  const dueMeeting = guidance.issuedAtMeeting + GUIDANCE_HORIZON_MEETINGS + 1
  const meetingsLeft = dueMeeting - (meetingIndex + 1)
  const gapBp = Math.round((path - currentRate) * 100)

  if (!isBinding(guidance.commitment)) {
    return (
      <p className="mt-3 rounded border border-edge bg-sunk p-3 text-sm text-ink-soft">
        Standing leaning: toward about {path.toFixed(2)} %. It binds nothing and
        lapses on its own.
      </p>
    )
  }

  return (
    <div className="mt-3 rounded border border-edge-accent bg-sunk p-3 text-sm text-accent-strong">
      <p className="font-medium">
        Standing commitment: about {path.toFixed(2)} % — judged around meeting{' '}
        {dueMeeting}
        {meetingsLeft > 0 ? `, ${meetingsLeft} meeting${meetingsLeft === 1 ? '' : 's'} from now` : ' — due now'}
        .
      </p>
      <p className="mt-1 text-accent-strong">
        {Math.abs(gapBp) <= 50
          ? 'The rate is already close enough to count as delivered.'
          : `${Math.abs(gapBp)} bp still to deliver.`}{' '}
        Moving against it, or quietly rewriting it, breaks the promise and costs
        credibility.
      </p>
    </div>
  )
}

export function CommunicationPanel({
  move,
  signal,
  commitment,
  allowedCommitments,
  difficulty,
  selectedRate,
  pricedRate,
  guidance,
  meetingIndex,
  observation,
  derivedTone,
  chosenTone,
  allowsFreeTone,
  onSignal,
  onCommitment,
  onTone,
}: {
  readonly move: number
  readonly signal: number
  readonly commitment: CommunicationCommitment
  readonly allowedCommitments: readonly CommunicationCommitment[]
  /** Sets guidance's own allowed range, for its brief. */
  readonly difficulty: Difficulty
  /** The rate the desk currently has selected, %, after the chosen move. */
  readonly selectedRate: number
  /** The one-year rate markets currently price, or null if unpublished. */
  readonly pricedRate: number | null
  readonly guidance: GuidanceState
  readonly meetingIndex: number
  readonly observation: ObservationSet
  /** The tone the decision implies, shown as the default and the comparison. */
  readonly derivedTone: CommunicationTone
  /** A tone deliberately chosen against it, where the difficulty allows one. */
  readonly chosenTone: CommunicationTone | null
  readonly allowsFreeTone: boolean
  readonly onSignal: (signal: number) => void
  readonly onCommitment: (commitment: CommunicationCommitment) => void
  readonly onTone: (tone: CommunicationTone | null) => void
}) {
  const announcedRate = selectedRate + signal / 100
  const ledger = promiseLedger(guidance, difficulty)
  const guidanceInstrument = getInstrument('forward_guidance') ?? null
  const guidanceRange =
    guidanceInstrument === null
      ? null
      : getInstrumentRange(guidanceInstrument, difficulty)
  const options = COMMITMENT_OPTIONS.filter((option) =>
    allowedCommitments.includes(option.commitment),
  )
  const selectedCommitment = options.find((option) => option.commitment === commitment)

  return (
    <section aria-labelledby="communication-heading" className="mt-6">
      <h3 id="communication-heading" className="text-sm font-medium text-ink">
        The statement
      </h3>
      <p className="mt-1 text-sm text-ink-soft">
        What you say acts on expectations directly, ahead of anything the rate
        itself will do. Markets reprice it the moment it is published — against
        what they already expected, not against zero.
      </p>

      {(() => {
        const mood = marketMood(observation)
        if (mood === 'calm') return null
        return (
          <p
            className={`mt-3 rounded border p-3 text-sm ${
              mood === 'panicked'
                ? 'border-bad bg-bad-surface text-bad-strong'
                : 'border-accent bg-accent-surface text-accent-strong'
            }`}
          >
            {MOOD_COPY[mood]}
          </p>
        )
      })()}

      <StandingGuidance
        guidance={guidance}
        meetingIndex={meetingIndex}
        currentRate={selectedRate - move / 100}
      />

      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-ink">
          Where is the rate heading from here?
        </legend>
        <div className="mt-2 flex flex-col gap-2">
          {PATH_OPTIONS.map((option) => {
            const selected = option.signal === signal
            return (
              <button
                key={option.signal}
                type="button"
                aria-pressed={selected}
                onClick={() => onSignal(option.signal)}
                className={`${buttonBase} ${selected ? selectedClasses : unselectedClasses}`}
              >
                {option.label}
                <span
                  // The footnote sits *inside* the button, so when the button
                  // is selected its ground is brass and the text has to be ink
                  // on brass, not ink on paper.
                  className={`ml-2 text-xs tabular-nums ${selected ? 'text-on-accent opacity-80' : 'text-ink-faint'}`}
                >
                  {option.signal === 0
                    ? 'hold near today’s level'
                    : `${option.signal > 0 ? '+' : '−'}${Math.abs(option.signal)} bp within a year`}
                </span>
              </button>
            )
          })}
        </div>
        {/* Guidance is an instrument like any other, so it gets the same four
            answers as the dials on the desk — what it is for, how much is a
            lot, what happens if it is abused. Its own definition supplies
            them; nothing about it is written out here. */}
        {guidanceInstrument !== null && guidanceRange !== null && (
          <InstrumentBrief
            instrument={guidanceInstrument}
            range={guidanceRange}
            value={signal}
          />
        )}
        <p className="mt-1.5 text-xs text-ink-faint">
          Announced path: about {announcedRate.toFixed(2)} % a year from now
          {pricedRate !== null
            ? ` — markets currently price ${pricedRate.toFixed(2)} %. What moves them is the difference.`
            : '.'}
        </p>
      </fieldset>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-ink">How firmly?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {options.map((option) => {
            const selected = option.commitment === commitment
            return (
              <button
                key={option.commitment}
                type="button"
                aria-pressed={selected}
                onClick={() => onCommitment(option.commitment)}
                className={`${buttonBase} ${selected ? selectedClasses : unselectedClasses}`}
              >
                {option.label}
              </button>
            )
          })}
        </div>
        {selectedCommitment !== undefined && (
          <p className="mt-2 text-xs text-ink-faint">{selectedCommitment.detail}</p>
        )}
        {/* The other two thirds of the trade. See `promiseLedger.ts`. */}
        <PromisePanel
          commitment={commitment}
          ledger={ledger}
          meetingIndex={meetingIndex}
        />
      </fieldset>

      {allowsFreeTone && (
        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-ink">
            In what tone?
          </legend>
          <p className="mt-1 text-xs text-ink-faint">
            The decision above implies a{' '}
            <span className="text-ink-soft">{derivedTone}</span> statement.
            Departing from it is allowed here, and markets charge for a package
            that argues with itself.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={chosenTone === null}
              onClick={() => onTone(null)}
              className={`${buttonBase} ${chosenTone === null ? selectedClasses : unselectedClasses}`}
            >
              Let the decision speak
            </button>
            {TONE_OPTIONS.map((option) => {
              const selected = option.tone === chosenTone
              return (
                <button
                  key={option.tone}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onTone(option.tone)}
                  className={`${buttonBase} ${selected ? selectedClasses : unselectedClasses}`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
          {chosenTone !== null && (
            <p className="mt-2 text-xs text-ink-faint">
              {TONE_OPTIONS.find((option) => option.tone === chosenTone)?.detail}
            </p>
          )}
        </fieldset>
      )}

      <div className="mt-4 rounded border border-edge bg-sunk p-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
          As the wire will carry it
        </h4>
        <p className="mt-1 text-sm italic text-ink-soft">
          {buildStatement(move, signal, commitment)}
        </p>
      </div>
    </section>
  )
}
