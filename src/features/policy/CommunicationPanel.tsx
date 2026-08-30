import type {
  CommunicationCommitment,
  GuidanceState,
} from '../../simulation/index.ts'
import { GUIDANCE_HORIZON_MEETINGS } from '../../simulation/index.ts'
import {
  COMMITMENT_OPTIONS,
  PATH_OPTIONS,
  buildStatement,
} from './statement.ts'

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
  'border-neutral-300 bg-neutral-200 font-semibold text-neutral-900'
const unselectedClasses = 'border-neutral-700 text-neutral-200 hover:bg-neutral-800'
const buttonBase =
  'rounded border px-3 py-2 text-sm text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400'

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
      <p className="mt-3 rounded border border-neutral-800 bg-neutral-900 p-3 text-sm text-neutral-400">
        Standing leaning: toward about {path.toFixed(2)} %. It binds nothing and
        lapses on its own.
      </p>
    )
  }

  return (
    <div className="mt-3 rounded border border-sky-900 bg-sky-950/40 p-3 text-sm text-sky-200">
      <p className="font-medium">
        Standing commitment: about {path.toFixed(2)} % — judged around meeting{' '}
        {dueMeeting}
        {meetingsLeft > 0 ? `, ${meetingsLeft} meeting${meetingsLeft === 1 ? '' : 's'} from now` : ' — due now'}
        .
      </p>
      <p className="mt-1 text-sky-300/90">
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
  selectedRate,
  pricedRate,
  guidance,
  meetingIndex,
  onSignal,
  onCommitment,
}: {
  readonly move: number
  readonly signal: number
  readonly commitment: CommunicationCommitment
  readonly allowedCommitments: readonly CommunicationCommitment[]
  /** The rate the desk currently has selected, %, after the chosen move. */
  readonly selectedRate: number
  /** The one-year rate markets currently price, or null if unpublished. */
  readonly pricedRate: number | null
  readonly guidance: GuidanceState
  readonly meetingIndex: number
  readonly onSignal: (signal: number) => void
  readonly onCommitment: (commitment: CommunicationCommitment) => void
}) {
  const announcedRate = selectedRate + signal / 100
  const options = COMMITMENT_OPTIONS.filter((option) =>
    allowedCommitments.includes(option.commitment),
  )
  const selectedCommitment = options.find((option) => option.commitment === commitment)

  return (
    <section aria-labelledby="communication-heading" className="mt-6">
      <h3 id="communication-heading" className="text-sm font-medium text-neutral-200">
        The statement
      </h3>
      <p className="mt-1 text-sm text-neutral-400">
        What you say acts on expectations directly, ahead of anything the rate
        itself will do. Markets reprice it the moment it is published — against
        what they already expected, not against zero.
      </p>

      <StandingGuidance
        guidance={guidance}
        meetingIndex={meetingIndex}
        currentRate={selectedRate - move / 100}
      />

      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-neutral-200">
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
                  className={`ml-2 text-xs tabular-nums ${selected ? 'text-neutral-600' : 'text-neutral-500'}`}
                >
                  {option.signal === 0
                    ? 'hold near today’s level'
                    : `${option.signal > 0 ? '+' : '−'}${Math.abs(option.signal)} bp within a year`}
                </span>
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Announced path: about {announcedRate.toFixed(2)} % a year from now
          {pricedRate !== null
            ? ` — markets currently price ${pricedRate.toFixed(2)} %. What moves them is the difference.`
            : '.'}
        </p>
      </fieldset>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-neutral-200">How firmly?</legend>
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
          <p className="mt-2 text-xs text-neutral-500">{selectedCommitment.detail}</p>
        )}
      </fieldset>

      <div className="mt-4 rounded border border-neutral-800 bg-neutral-900 p-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          As the wire will carry it
        </h4>
        <p className="mt-1 text-sm italic text-neutral-300">
          {buildStatement(move, signal, commitment)}
        </p>
      </div>
    </section>
  )
}
