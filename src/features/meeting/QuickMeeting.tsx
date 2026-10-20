import { useMemo, useState } from 'react'
import {
  getInstrument,
  getInstrumentRange,
  instrumentRangesFor,
  rateInstrumentLabel,
  getInstitution,
  type CallBand,
  type MeetingResult,
  type PolicyPackage,
  type RunSession,
} from '../../simulation/index.ts'
import { RateSlider, type GhostMarker } from '../policy/RateSlider.tsx'
import { meetingLine } from './meetingLine.ts'
import { pricedMoveBp, surpriseStake } from './surprise.ts'
import { CallPanel } from './CallPanel.tsx'
import { Chip, Seal, SerialNumber } from '../../components/engraving/Chip.tsx'
import {
  Arrow,
  Figure,
  Notched,
  Panel,
  PanelGrid,
  Row,
  useNotch,
} from '../../components/terminal/Terminal.tsx'
import {
  RollingNumber,
  ThrownChip,
  motion,
  useReducedMotion,
  useShake,
  SPRING,
} from '../../components/engraving/motion.tsx'

/**
 * The decision, as a line on a dealing-room terminal.
 *
 * ## What this screen is now
 *
 * Amber on near-black, panels tiled edge to edge with one-pixel rules
 * between them, every figure and every label in IBM Plex Mono, decimals
 * under each other, values flashing green or red for half a second when they
 * move. The reference is the genre of terminal that sat on every dealing desk
 * from the eighties on — not any one maker's machine, and nothing of anyone's
 * is borrowed here.
 *
 * The engraved governor who used to stand on the right is **gone**. Two
 * reasons and the second is the real one: the portrait was not good enough,
 * and a terminal has no pictures on it. An illustration on a dealing screen
 * is the tell that the screen is a drawing of a dealing screen.
 *
 * What survives from the banknote pass is what a *document* has rather than
 * what a *picture* has: the seal, and the serial number derived from the
 * run's own seed so two plays of a seed carry the same one.
 *
 * ## The book
 *
 * The right-hand panel is a bookmaker's slip and it is the hook of the whole
 * game: the surprise, the return and the stake **recompute under the thumb**,
 * continuously, while the dial moves — and flash as they change. Nothing
 * appears or disappears while you drag; the rows are always there and it is
 * the values that go quiet inside the priced band.
 *
 * **The odds are the engine's own constants.** `surpriseStake` reads the same
 * coefficients `applyPolicyPackage` will apply, so the slip is not a
 * dramatisation of the wager — it is the wager, priced. Only the presentation
 * is a bookmaker's.
 *
 * ## Why the columns are nailed down
 *
 * A terminal is dense, and density is only readable when it is *stable in
 * position*: the eye learns where to look and genuinely stops seeing the
 * rest. Every row here uses the shared `Row`, whose label column is a
 * constant, so no figure in this game ever moves between one meeting and the
 * next. A row with nothing to say prints an em dash; it does not collapse.
 */
export function QuickMeeting({
  session,
  onConfirm,
  onOpenRoom,
  shock = null,
}: {
  readonly session: RunSession
  readonly onConfirm: (pkg: PolicyPackage) => MeetingResult
  /** Promotes this meeting to the full apparatus, for this meeting only. */
  readonly onOpenRoom: () => void
  /** Title of a crisis that landed in the interval, if one did. */
  readonly shock?: string | null
}) {
  const [move, setMove] = useState(0)
  const [touched, setTouched] = useState(false)
  const [rejected, setRejected] = useState<string | null>(null)
  const [callCentre, setCallCentre] = useState<number | null>(null)
  const [callBand, setCallBand] = useState<CallBand>('even')
  const reduced = useReducedMotion()

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
  const resulting = currentRate + move / 100
  const shake = useShake(shock)
  // One pulse per detent crossed, so dragging across six notches ticks six
  // times rather than smearing into one.
  const notch = useNotch(Math.round(move / range.increment))

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
  const label =
    rateInstrumentLabel(config) ?? instrument?.label[config.institution] ?? 'Policy rate'
  const chips = stake.beyondPriced ? Math.max(1, Math.round(stake.trust)) : 0
  const direction = move > 0 ? 'up' : move < 0 ? 'down' : 'flat'

  const confirm = () => {
    const pkg: PolicyPackage = {
      actions: move === 0 ? [] : [{ instrument: 'policy_rate', magnitude: move }],
      communication: null,
      call: callCentre === null ? null : { centre: callCentre, band: callBand },
    }
    const result = onConfirm(pkg)
    if (!result.ok) {
      setRejected(
        result.validation.rejections[0]?.message ?? 'The desk refused that package.',
      )
    }
  }

  return (
    <motion.section
      aria-label="This meeting"
      data-tempo="quick"
      style={shake === false ? undefined : shake}
      className="mt-3 border-y border-edge-strong bg-page"
    >
      {/* The one written line on the screen, and the only thing in a serif.
          Everything else is machine output and is set as machine output. */}
      <p className="border-b border-edge-panel bg-raised px-2 py-1.5 font-display text-sm leading-snug text-ink-primary">
        {line}
      </p>

      <PanelGrid>
        {/* ── The instrument. Two columns of three, because the dial is the
              thing being operated and everything else reports on it. ──── */}
        <Panel
          title={label}
          span={2}
          right={`from ${currentRate.toFixed(2)}`}
          className="p-0"
        >
          <div className="flex items-baseline gap-2 px-2 pt-2">
            <Notched pulse={notch}>
              <Figure value={resulting} size="hero" invert />
            </Notched>
            <span className="font-mono text-sm text-ink-muted">%</span>
            <span className="ml-auto flex items-baseline gap-1 font-mono text-sm tabular-nums">
              <Arrow direction={direction} invert />
              <span
                className={
                  move > 0
                    ? 'text-bad-onwood'
                    : move < 0
                      ? 'text-good-onwood'
                      : 'text-ink-muted'
                }
              >
                {move === 0 ? 'hold' : `${move > 0 ? '+' : '−'}${Math.abs(move)} bp`}
              </span>
            </span>
          </div>

          <div className="px-2 pb-1 pt-2" data-guide="rate">
            <RateSlider
              label={label}
              currentRate={currentRate}
              value={move}
              min={range.min}
              max={range.max}
              step={range.increment}
              markers={markers}
              explains={false}
              showHeader={false}
              onDark
              /* The hint retires the moment the player has used the dial
                 once. A line of instruction that is still there after it has
                 been obeyed is not help, it is furniture — and on a screen
                 whose whole argument is that position is stable, a permanent
                 hint occupies a row that a real reading could have had. */
              hint={touched ? null : 'Moves in 25 bp steps — arrow keys work.'}
              onChange={(basisPoints) => {
                setMove(basisPoints)
                setTouched(true)
                setRejected(null)
              }}
            />
          </div>
        </Panel>

        {/* ── The book. Recomputes under the thumb, continuously. ─────── */}
        <Panel title="The book" right={stake.beyondPriced ? 'live' : 'priced in'}>
          <Row label="Priced">
            {priced === null ? (
              <span className="text-ink-muted">—</span>
            ) : (
              <RollingNumber value={priced} decimals={0} suffix=" bp" />
            )}
          </Row>
          <Row label="Your move">
            <RollingNumber value={move} decimals={0} suffix=" bp" />
          </Row>
          <Row label="Surprise">
            {priced === null ? (
              <span className="text-ink-muted">—</span>
            ) : (
              <Figure
                value={Math.abs(stake.surprise) * 100}
                decimals={0}
                suffix=" bp"
              />
            )}
          </Row>
          <Row label="Returns">
            {stake.beyondPriced ? (
              <span className="font-semibold text-good-onwood">
                <RollingNumber value={stake.reach} prefix="+" suffix=" reach" />
              </span>
            ) : (
              <span className="text-ink-muted">nothing bought</span>
            )}
          </Row>
          {/* The chips are capped at four and the row never wraps.
              `whitespace-nowrap` is not a detail here: a stack of six 14 px
              chips plus the figure is wider than the value column on a phone,
              and what that produced was a two-line Stake row — the one thing
              this layout promises never to do. A terminal row that reflows
              has broken its whole contract, so the decoration yields and the
              figure, which is the information, does not. */}
          <Row label="Stake">
            {stake.beyondPriced ? (
              <span className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                <span aria-hidden="true" className="flex shrink-0 items-center gap-[1px]">
                  {Array.from({ length: Math.min(chips, 4) }, (_, index) => (
                    <ThrownChip key={index} index={index}>
                      <Chip size={12} tone="bad" />
                    </ThrownChip>
                  ))}
                </span>
                <span className="font-semibold text-bad-onwood">
                  <RollingNumber value={stake.trust} decimals={1} suffix=" trust" />
                </span>
              </span>
            ) : (
              <span className="text-ink-muted">nothing at risk</span>
            )}
          </Row>
        </Panel>

        {/* ── The standing call. ──────────────────────────────────────── */}
        <Panel title="Your call" span={3}>
          <div className="px-2 py-1">
            <CallPanel
              session={session}
              centre={callCentre}
              band={callBand}
              onChange={(centre, band) => {
                setCallCentre(centre)
                setCallBand(band)
              }}
            />
          </div>
        </Panel>
      </PanelGrid>

      {rejected !== null && (
        <p
          role="alert"
          className="border-y border-bad bg-bad-surface px-2 py-1 font-mono text-xs text-bad-onwood"
        >
          {rejected}
        </p>
      )}

      {/* ── The committing row. ─────────────────────────────────────── */}
      <div className="flex items-stretch border-t border-edge-strong">
        <motion.button
          type="button"
          onClick={confirm}
          data-confirm=""
          whileTap={reduced ? undefined : { scale: 0.99 }}
          transition={SPRING}
          className="flex-1 bg-accent px-3 py-2.5 font-mono text-sm font-semibold uppercase tracking-[0.18em] text-on-accent"
        >
          {move === 0 ? 'Hold' : 'Take it'}
        </motion.button>
        <button
          type="button"
          onClick={onOpenRoom}
          data-open-room=""
          className="border-l border-edge-strong px-3 py-2.5 font-mono text-2xs uppercase tracking-[0.18em] text-ink-secondary hover:bg-raised hover:text-ink-primary"
        >
          Open the room
        </button>
      </div>

      {/* ── The foot. The seal and the serial, kept: they are what a
            document has, and this is still an instrument of policy. ──── */}
      <div className="flex items-center justify-between gap-2 border-t border-edge-panel bg-raised px-2 py-1">
        <SerialNumber
          seed={config.seed}
          meeting={session.state.meetingIndex}
          className="text-ink-muted"
        />
        <span className="flex items-center gap-2">
          <span className="font-mono text-2xs uppercase tracking-[0.18em] text-ink-muted">
            {getInstitution(config.institution).shortName}
          </span>
          <Seal
            size={20}
            letters={config.institution === 'ecb' ? 'ECB' : 'FRS'}
            opacity={0.8}
            className="text-accent-onwood"
          />
        </span>
      </div>
    </motion.section>
  )
}
