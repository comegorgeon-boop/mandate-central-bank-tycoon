import { useMemo, useState } from 'react'
import {
  getInstrument,
  getInstrumentRange,
  instrumentRangesFor,
  rateInstrumentLabel,
  getInstitution,
  explainInflation,
  liveShocks,
  unemploymentGap,
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
  CauseBar,
  HeadlineFigure,
  OrderBanner,
  ShockPanel,
} from '../../components/terminal/Explain.tsx'
import { readOrder } from './order.ts'
import { readDispatches } from './dispatches.ts'
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
/**
 * Whether this player has ever moved the dial.
 *
 * > "supprime « Moves in 25 bp steps — arrow keys work » après que le joueur
 * > a bougé le curseur une fois."
 *
 * **Once**, not once per meeting — and the first version got that wrong in a
 * way only the word count caught: the flag was component state, so it reset
 * on every mount and the hint came back at meeting four, and twelve, and
 * twenty-four. Nine words of instruction, re-served to a player who has
 * demonstrably obeyed it, forever.
 *
 * Kept in `localStorage` because it is a fact about the person rather than
 * about the run: having learned that a slider has arrow keys is not something
 * to unlearn when a mandate ends. Wrapped, because a private window or a
 * browser set to block site data throws on access rather than returning null,
 * and a thrown read here would take the meeting screen down with it.
 */
const DIAL_KEY = 'mandate.dial.used'

let hasUsedTheDial = (() => {
  try {
    return globalThis.localStorage?.getItem(DIAL_KEY) === '1'
  } catch {
    return false
  }
})()

function rememberTheDial(): void {
  if (hasUsedTheDial) return
  hasUsedTheDial = true
  try {
    globalThis.localStorage?.setItem(DIAL_KEY, '1')
  } catch {
    // A player who cannot be remembered simply sees the hint again. That is
    // the correct failure: the alternative is a crash on a meeting screen.
  }
}

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
  const [touched, setTouched] = useState(hasUsedTheDial)
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

  /* ── The explanation, which is now the top of the screen. ──────────── */
  const order = readOrder(session)
  const inflation = explainInflation(session.state.latent, config)
  const shocks = liveShocks(session.state)
  const dispatches = readDispatches(session, { compact: true })
  const jobsGap = unemploymentGap(session.state.latent)

  // Direction is read against the previous meeting's snapshot rather than
  // against a stored flag, so it is true after a replay and cannot drift.
  const previous = session.state.history.at(-2)?.latent ?? null
  const movedBy = (now: number, before: number | null): 'up' | 'down' | 'flat' =>
    before === null || Math.abs(now - before) < 0.05
      ? 'flat'
      : now > before
        ? 'up'
        : 'down'
  const headlineDirection = movedBy(
    session.state.latent.inflationHeadline,
    previous?.inflationHeadline ?? null,
  )
  const jobsDirection = movedBy(
    session.state.latent.unemployment,
    previous?.unemployment ?? null,
  )
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
      {/* ── Rank one: the order, then the two figures with their causes.
            Always here, at the top, whatever the meeting weighs. ─────── */}
      <OrderBanner
        command={order.command}
        detail={order.detail}
        severity={order.severity}
        compact
      />

      <PanelGrid>
        <Panel title="Where it stands" span={3}>
          <div className="grid grid-cols-1 sm:grid-cols-2">
            <HeadlineFigure
              label="Headline inflation"
              value={inflation.headline}
              because={
                inflation.leading === null || inflation.leading.share < 0.25
                  ? null
                  : `driven by ${inflation.leading.label}`
              }
              direction={headlineDirection}
            />
            <HeadlineFigure
              label="Unemployment"
              value={session.state.latent.unemployment}
              because={
                jobsGap > 0.4
                  ? `${jobsGap.toFixed(1)} above the sustainable rate`
                  : jobsGap < -0.4
                    ? `${Math.abs(jobsGap).toFixed(1)} below the sustainable rate`
                    : 'at the sustainable rate'
              }
              direction={jobsDirection}
            />
          </div>
          {/* The cause as a picture. On a quick meeting the bar is here
              without its legend: the shape is the information, and naming
              every segment is what the heavy meeting is for. */}
          <div className="flex items-center gap-2 border-t border-edge px-2 py-1.5">
            <span className="w-[17ch] shrink-0 font-mono text-2xs uppercase tracking-[0.1em] text-ink-soft">
              What is causing it
            </span>
            <span className="min-w-0 flex-1">
              <CauseBar explanation={inflation} compact />
            </span>
          </div>
        </Panel>

        {/* ── Rank one and a half: what is still arriving. The most visible
              thing after the order, because "qu'est-ce qu'il y a, et comment
              on le traite" is most of the game. ───────────────────────── */}
        <ShockPanel shocks={shocks} compact />

        {/* The wire. Guidance for the first three meetings of every mandate
            at every difficulty, then whatever actually landed — through the
            same slot and in the same voice, so the game stops guiding without
            a seam. No help box: "tout vit dans le terminal". */}
        {dispatches.length > 0 && (
        <Panel title="Dispatches">
          {(
            <ul>
              {dispatches.map((dispatch) => (
                <li
                  key={dispatch.id}
                  className="border-b border-edge px-2 py-1.5 last:border-b-0"
                >
                  <span
                    className={`font-mono text-2xs uppercase tracking-[0.16em] ${
                      dispatch.kind === 'guide' ? 'text-accent-strong' : 'text-ink-faint'
                    }`}
                  >
                    {dispatch.tag}
                  </span>
                  <p className="mt-0.5 font-mono text-2xs leading-relaxed text-ink-soft">
                    {dispatch.text}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        )}

        {/* The desk's own sentence, and the only serif on the screen —
            shown only when it is saying something the shock lines are not.

            A quick meeting's prose budget is twenty-four words and frozen.
            The desk repeating the title of the shock immediately beside it
            spent a third of that budget saying the same thing twice, and the
            order at the top has already said what the meeting is for. */}
        {line !== null &&
          !shocks.some((shock) => line.startsWith(shock.title.slice(0, 12))) && (
            <Panel title="The desk">
              <p className="px-2 py-2 font-display text-xs leading-relaxed text-ink-soft">
                {line}
              </p>
            </Panel>
          )}
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
            <span className="font-mono text-sm text-ink-faint">%</span>
            <span className="ml-auto flex items-baseline gap-1 font-mono text-sm tabular-nums">
              <Arrow direction={direction} invert />
              <span
                className={
                  move > 0
                    ? 'text-bad'
                    : move < 0
                      ? 'text-good'
                      : 'text-ink-faint'
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
              /* No `onDark`. That prop exists for a slider sitting straight
                 on the room, and this one is inside a `Panel` — whose ground
                 is the terminal's dark glass in one direction and cream paper
                 in the other. On-dark tick labels on cream ran 2.35:1. */
              /* The hint retires the moment the player has used the dial
                 once. A line of instruction that is still there after it has
                 been obeyed is not help, it is furniture — and on a screen
                 whose whole argument is that position is stable, a permanent
                 hint occupies a row that a real reading could have had. */
              hint={touched ? null : 'Moves in 25 bp steps — arrow keys work.'}
              onChange={(basisPoints) => {
                setMove(basisPoints)
                rememberTheDial()
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
              <span className="text-ink-faint">—</span>
            ) : (
              <RollingNumber value={priced} decimals={0} suffix=" bp" />
            )}
          </Row>
          <Row label="Your move">
            <RollingNumber value={move} decimals={0} suffix=" bp" />
          </Row>
          <Row label="Surprise">
            {priced === null ? (
              <span className="text-ink-faint">—</span>
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
              <span className="font-semibold text-good">
                <RollingNumber value={stake.reach} prefix="+" suffix=" reach" />
              </span>
            ) : (
              <span className="text-ink-faint">nothing bought</span>
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
                <span className="font-semibold text-bad">
                  <RollingNumber value={stake.trust} decimals={1} suffix=" trust" />
                </span>
              </span>
            ) : (
              <span className="text-ink-faint">nothing at risk</span>
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
          className="border-y border-bad bg-bad-surface px-2 py-1 font-mono text-xs text-bad"
        >
          {rejected}
        </p>
      )}

      {/* ── The committing row. ─────────────────────────────────────── */}
      {/* The action bar sits on the chassis rather than in a panel — it
          paints no ground of its own and inherits `bg-page`, which is dark in
          both directions. So it takes the room's text pair. */}
      <div className="flex items-stretch border-t border-edge-strong bg-room">
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
          className="border-l border-edge-strong px-3 py-2.5 font-mono text-2xs uppercase tracking-[0.18em] text-onwood-soft hover:bg-inset hover:text-onwood"
        >
          Open the room
        </button>
      </div>

      {/* ── The foot. The seal and the serial, kept: they are what a
            document has, and this is still an instrument of policy. ──── */}
      <div className="flex items-center justify-between gap-2 border-t border-edge bg-raised px-2 py-1">
        <SerialNumber
          seed={config.seed}
          meeting={session.state.meetingIndex}
          className="text-ink-faint"
        />
        <span className="flex items-center gap-2">
          <span className="font-mono text-2xs uppercase tracking-[0.18em] text-ink-faint">
            {getInstitution(config.institution).shortName}
          </span>
          <Seal
            size={20}
            letters={config.institution === 'ecb' ? 'ECB' : 'FRS'}
            /* No opacity. The die carries three letters, and eight tenths
               of brass-700 on cream is 4.39:1 — the same defect the lint rule
               forbids in a className, arriving through a prop where the rule
               cannot see it. A drawn thing with text in it is a text element.
               The `opacity` prop stays for the seals that carry none. */
            className="text-accent-strong"
          />
        </span>
      </div>
    </motion.section>
  )
}
