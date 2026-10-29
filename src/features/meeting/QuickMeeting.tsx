import { useMemo, useState } from 'react'
import {
  getInstrument,
  getInstrumentRange,
  instrumentRangesFor,
  rateInstrumentLabel,
  getInstitution,
  explainInflation,
  liveShocks,
  readMandate,
  type ReadingId,
  type CallBand,
  type MeetingResult,
  type PolicyPackage,
  type RunSession,
} from '../../simulation/index.ts'
import { RateSlider, type GhostMarker } from '../policy/RateSlider.tsx'
import { pricedMoveBp, surpriseStake } from './surprise.ts'
import { CallPanel } from './CallPanel.tsx'
import { FoldedPanel } from '../../components/terminal/FoldedPanel.tsx'
import { Chip, Seal } from '../../components/engraving/Chip.tsx'
import {
  CauseBar,
  MandateGauges,
  ShockPanel,
} from '../../components/terminal/Explain.tsx'
import { readDispatches } from './dispatches.ts'

/**
 * The guided opening's three lessons, by id.
 *
 * Not `kind === 'guide'`: `wire-speaking` shares that kind and fires on a
 * crossing late in the mandate, which had the dispatches panel opening itself
 * at meeting seven.
 */
const OPENING_LESSONS: ReadonlySet<string> = new Set(['guide-0', 'guide-1', 'guide-2'])
import { readConsequence } from './consequence.ts'
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

  /* ── The explanation. The order itself is drawn above, by the
        meeting screen; these are the readings it is an order about. ── */
  const stake = surpriseStake(session, move)
  const label =
    rateInstrumentLabel(config) ?? instrument?.label[config.institution] ?? 'Policy rate'
  const chips = stake.beyondPriced ? Math.max(1, Math.round(stake.trust)) : 0
  const direction = move > 0 ? 'up' : move < 0 ? 'down' : 'flat'

  const inflation = explainInflation(session.state.latent, config)
  const shocks = liveShocks(session.state)
  const dispatches = readDispatches(session, { compact: true })
  const board = readMandate(session.state.latent, config)
  const consequence = readConsequence(session, move)

  // The previous meeting's readings, for the gauges' direction arrows. Read
  // from history rather than stored, so it is true after a replay.
  const before = session.state.history.at(-2)?.latent ?? null
  const previousReadings: Partial<Record<ReadingId, number>> =
    before === null
      ? {}
      : {
          inflation: before.inflationHeadline,
          unemployment: before.unemployment,
          growth: before.realGrowth,
        }

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
      {/* The order is drawn by `MeetingScreen`, above this component and
          above the room alike — one banner at the top of both surfaces,
          rather than one per surface that could drift apart. */}
      <PanelGrid>
        <Panel title="Where it stands" span={3} weight={1}>
          {/* Three readings: two to close, one not to break. The gauges make
              the distance a *length*, so the board is readable without
              reading a number — and the two institutions get different
              boards, because their mandates are different. */}
          <MandateGauges board={board} previous={previousReadings} />
          {/*
            Attached to the inflation figure, not laid under all three.

            > "« WHAT IS CAUSING IT » : je ne sais même pas de quoi ça parle.
            > La barre est posée sous les deux chiffres, donc c'est ambigu."

            Exactly the defect: a bar spanning the whole row has no subject.
            It now sits in the first of the three columns, directly beneath
            the number it decomposes, and says what it is — *what is pushing
            inflation* — rather than an unattached "what is causing it".
          */}
          <div className="grid grid-cols-1 border-t border-edge sm:grid-cols-3">
            <div className="min-w-0 px-2 py-1.5 sm:border-r sm:border-edge">
              <p className="font-mono text-2xs uppercase tracking-[0.14em] text-ink-faint">
                What is pushing inflation
              </p>
              <div className="mt-1">
                <CauseBar explanation={inflation} compact legend="folded" />
              </div>
            </div>
            <div className="hidden sm:col-span-2 sm:block" />
          </div>
        </Panel>

        {/* ── Rank one and a half: what is still arriving. The most visible
              thing after the order, because "qu'est-ce qu'il y a, et comment
              on le traite" is most of the game. ───────────────────────── */}
        {/* ── Folded, with its count on the lid. ─────────────────────
              The panel is rank three and was still a block of figures on the
              default screen. `LIVE SHOCKS — 2` says whether it is worth
              opening, which is the rule that makes folding a saving rather
              than a click in front of each piece. */}
        {shocks.length > 0 && (
          <div className="sm:col-span-2">
            <FoldedPanel
              id="live-shocks"
              title="Live shocks"
              state={shocks.length === 1 ? '1 running' : `${shocks.length} running`}
            >
              <ShockPanel shocks={shocks} compact bare />
            </FoldedPanel>
          </div>
        )}

        {/* The wire. Guidance for the first three meetings of every mandate
            at every difficulty, then whatever actually landed — through the
            same slot and in the same voice, so the game stops guiding without
            a seam. No help box: "tout vit dans le terminal". */}
        {dispatches.length > 0 && (
        <FoldedPanel
          id="dispatches"
          title="Dispatches"
          state={
            dispatches.some((dispatch) => dispatch.kind === 'guide')
              ? 'a lesson'
              : dispatches.length === 1
                ? '1 item'
                : `${dispatches.length} items`
          }
          /*
           * **Open for the guided opening, and only that.**
           *
           * Those three lessons come through this same slot — deliberately, so
           * the game stops guiding without a seam — and folding the panel
           * folded them too, which would have hidden the tutorial from the one
           * player it exists for, days after a whole pass about a beginner who
           * could not tell what the game wanted.
           *
           * Gated on the three opening ids rather than on `kind === 'guide'`,
           * which was the first version and was too broad: `wire-speaking`
           * also carries that kind, fires on a crossing much later in the
           * mandate, and had the panel opening itself at meeting seven. Found
           * by printing every panel's open state at every meeting rather than
           * by looking at one screenshot.
           *
           * `FoldedPanel` remembers a player who closes it anyway.
           */
          defaultOpen={dispatches.some((dispatch) =>
            OPENING_LESSONS.has(dispatch.id),
          )}
        >
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
        </FoldedPanel>
        )}

        {/* The desk's own sentence is **not** on the quick surface any more.

            It said "Inflation is 4.9 points above the objective, and there is
            slack in the labour market" — fifteen words describing what the
            order banner two inches above already commands, with a verb and
            the same figure. A description beside an instruction is the exact
            thing this whole pass is about removing, and it was the largest
            single item left in a frozen word budget. It is still the desk's
            line and it is still in the room. */}

        {/* ── The instrument. Two columns of three, because the dial is the
              thing being operated and everything else reports on it. ──── */}
        <Panel
          title={label}
          span={2}
          weight={2}
          /* No `from 3.25` here. The big figure below is the rate after this
             decision and the line under it says `no change`, so at a hold the
             header was printing the same number a second time — two of the
             fourteen figures the default screen had left. */
          right={move === 0 ? 'unchanged' : `${move > 0 ? '+' : '−'}${Math.abs(move)} bp`}
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

        {/* ── What the move would do, in words, live under the thumb.
              Never a figure: this engine is built on the gap between the
              latent state and the published one, and printing a forecast
              would read the hidden state out loud. See `consequence.ts`. ── */}
        <Panel
          title="If you take it"
          weight={2}
          right={move === 0 ? 'holding' : `${move > 0 ? '+' : '−'}${Math.abs(move)} bp`}
        >
          <div className="border-b border-edge px-2 py-1.5">
            <p className="font-mono text-2xs uppercase tracking-[0.16em] text-good">
              What it buys
            </p>
            <p className="mt-0.5 font-mono text-2xs leading-relaxed text-ink">
              {consequence.gain}
            </p>
          </div>
          <div className="px-2 py-1.5">
            <p className="font-mono text-2xs uppercase tracking-[0.16em] text-bad">
              What it costs
            </p>
            <p className="mt-0.5 font-mono text-2xs leading-relaxed text-ink">
              {consequence.risk}
            </p>
          </div>
        </Panel>

        {/* ── The wager, demoted. It is a real mechanic about a second-order
              thing — surprising the market — and it was occupying the place
              where "what does this do to the economy" belonged. Rank three:
              present, quiet, and not what the screen is about. ── */}
        {/* ── The book, folded. ──────────────────────────────────────
              Four rows of figures — priced, surprise, returns, stake — on a
              screen whose whole complaint is figures. The lid says how far the
              dial is from what the market has priced, which is the one number
              the four rows exist to produce: `THE BOOK — 60 bp of surprise`. */}
        <FoldedPanel
          id="the-book"
          title="Against the priced path"
          state={
            priced === null
              ? 'nothing priced'
              : stake.beyondPriced
                ? `${Math.abs(Math.round(move - priced))} bp of surprise`
                : 'priced in'
          }
        >
          <Row label="Priced">
            {priced === null ? (
              <span className="text-ink-faint">—</span>
            ) : (
              <RollingNumber value={priced} decimals={0} suffix=" bp" />
            )}
          </Row>
          <Row label="Surprise">
            {priced === null ? (
              <span className="text-ink-faint">—</span>
            ) : (
              <Figure value={Math.abs(stake.surprise) * 100} decimals={0} suffix=" bp" />
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
        </FoldedPanel>

        {/* NOTE: a second copy of the dial, the wire, the desk and the old
            "The book" panel used to live here. They were left behind when
            the book was replaced by the consequence panel — an insertion
            that added the new block without removing the old one, so the
            screen rendered every one of them twice. Visible instantly in a
            capture and invisible in the diff, which is the whole argument
            for looking at the pictures. */}

        {/* ── The standing call. ──────────────────────────────────────── */}
        {/* ── The wager, folded. ─────────────────────────────────────
              A real mechanic about a second-order thing, and optional by
              design — `pressOptional.test.ts` holds that the press is never
              compulsory and this is the same principle. The lid says whether
              one is standing, because that is the only thing a player needs
              to know without opening it. */}
        <div className="sm:col-span-3">
          <FoldedPanel
            id="your-call"
            title="Your call"
            state={session.state.call === null ? 'none standing' : 'one standing'}
          >
            <CallPanel
              session={session}
              centre={callCentre}
              band={callBand}
              onChange={(centre, band) => {
                setCallCentre(centre)
                setCallBand(band)
              }}
            />
          </FoldedPanel>
        </div>
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

      {/* ── The foot. The seal stays; **the serial does not.**

            It is what a document has, and it is also eight digits on the one
            screen whose complaint is digits — counted by `tools/figures.mjs`
            as a figure, which is fair, because the eye has to read it as one
            before deciding it is ornament. A mark is a mark and a number is a
            number: the seal survives on both counts, the serial survives only
            where there is room for it, which is the confirmation screen and
            the report. ──── */}
      <div className="flex items-center justify-end gap-2 border-t border-edge bg-raised px-2 py-1">
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
