import { useMemo, useState } from 'react'
import {
  getInstrument,
  getInstrumentRange,
  instrumentRangesFor,
  rateInstrumentLabel,
  type MeetingResult,
  type PolicyPackage,
  type RunSession,
} from '../../simulation/index.ts'
import { RateSlider, type GhostMarker } from '../policy/RateSlider.tsx'
import { meetingLine } from './meetingLine.ts'
import { pricedMoveBp, surpriseStake } from './surprise.ts'
import { StakeChips } from './StakeChips.tsx'

/**
 * A meeting that takes five seconds.
 *
 * ## What was removed to make this
 *
 * Everything. The tab strip, the objective restated for the twentieth time,
 * the chart panel, the stance strip, the newspaper as the landing surface,
 * and the button that sends you to the desk — because here the desk *is* the
 * screen. Measured before: 2,510 characters standing between the player and
 * the only control they came to touch, at every one of up to thirty-two
 * meetings, on the easiest mode.
 *
 * None of it is gone from the game. It is one gesture away, behind "open the
 * room", and `dev/twoLines.ts` is the evidence that the gesture is optional:
 * a player who reads only the standing line above this and the sentence below
 * serves 40 of 40 easy mandates and meets the objective in 24 of them.
 *
 * ## And what was added, which is one thing
 *
 * The stake. Moving the dial away from what the market has priced is a
 * **bet** — better transmission if the economy needed the surprise, volatility
 * and credibility if it did not — and until now that was a consequence you
 * read about afterwards. Here it is a number you watch change while your
 * thumb is still on the control, which is the difference between a wager and
 * a form.
 */
export function QuickMeeting({
  session,
  onConfirm,
  onOpenRoom,
}: {
  readonly session: RunSession
  readonly onConfirm: (pkg: PolicyPackage) => MeetingResult
  /** Promotes this meeting to the full apparatus, for this meeting only. */
  readonly onOpenRoom: () => void
}) {
  const [move, setMove] = useState(0)
  const [rejected, setRejected] = useState<string | null>(null)

  const { config } = session.state
  const instrument = getInstrument('policy_rate')
  const range = useMemo(
    () =>
      instrument === undefined
        ? { min: -150, max: 150, increment: 25 }
        : getInstrumentRange(instrument, config.difficulty, instrumentRangesFor(config)),
    [instrument, config],
  )

  const currentRate = session.state.stance.targetRate

  // Where the market expects this meeting to land — not the whole gap to the
  // expected rate. See `pricedMoveBp`.
  const priced = pricedMoveBp(session)
  const markers: GhostMarker[] = []
  if (priced !== null) {
    markers.push({
      id: 'market',
      label: 'priced',
      basisPoints: Math.round(priced / range.increment) * range.increment,
      rate: currentRate + priced / 100,
    })
  }

  const stake = surpriseStake(session, move)
  const line = meetingLine(session)

  const confirm = () => {
    const pkg: PolicyPackage =
      move === 0
        ? { actions: [], communication: null }
        : { actions: [{ instrument: 'policy_rate', magnitude: move }], communication: null }
    const result = onConfirm(pkg)
    if (!result.ok) {
      setRejected(
        result.validation.rejections[0]?.message ?? 'The desk refused that package.',
      )
    }
  }

  return (
    <section
      aria-label="This meeting"
      data-tempo="quick"
      className="mt-4 rounded-lg border border-edge bg-panel p-4 text-ink shadow-panel sm:p-5"
    >
      <p className="text-base text-ink">{line}</p>

      <div className="mt-5" data-guide="rate">
        <RateSlider
          label={rateInstrumentLabel(config) ?? instrument?.label[config.institution] ?? 'Policy rate'}
          currentRate={currentRate}
          value={move}
          min={range.min}
          max={range.max}
          step={range.increment}
          markers={markers}
          // The marks explain themselves on the full surface. Here the sentence
          // above has already said what the meeting is about, and a paragraph
          // under the dial would put back a third of what was just removed.
          explains={false}
          onChange={(basisPoints) => {
            setMove(basisPoints)
            setRejected(null)
          }}
        />
      </div>

      <StakeChips stake={stake} />

      {rejected !== null && (
        <p role="alert" className="mt-3 text-sm text-bad-strong">
          {rejected}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={confirm}
          data-confirm=""
          className="rounded-md border border-edge-accent bg-accent px-4 py-2 text-sm font-semibold text-on-accent shadow-panel transition-colors hover:bg-accent-onwood"
        >
          {move === 0 ? 'Hold, and move on' : 'Take the decision'}
        </button>
        <button
          type="button"
          onClick={onOpenRoom}
          data-open-room=""
          className="text-sm text-ink-soft underline hover:text-ink"
        >
          Open the room
        </button>
      </div>
    </section>
  )
}
