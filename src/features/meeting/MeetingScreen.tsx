import { useEffect, Fragment, useMemo, useState } from 'react'
import {
  decisionFrontPages,
  getInstitution,
  getSeries,
  inflationTargetFor,
  isMajorEvent,
  meetingLabel,
  sustainableRateFor,
  tutorialProgress,
  type MeetingResult,
  type PolicyPackage,
  type RunSession,
  unlockedAt,
} from '../../simulation/index.ts'
import { realiseDue, type LedgerEntry } from '../policy/instrumentLedger.ts'
import type { SettledPromise } from '../policy/settledPromise.ts'
import type { CounterfactualLine } from './counterfactualLine.ts'
import type { Scoreboard } from '../game/doctrineScoreboard.ts'
import { PolicyDeskPanel } from '../policy/PolicyDeskPanel.tsx'
import { ReactionPanel } from '../policy/ReactionPanel.tsx'
import { StanceStrip } from '../policy/StanceStrip.tsx'
import { ChangesPanel } from './panels/ChangesPanel.tsx'
import { DiagnosisPanel } from './panels/DiagnosisPanel.tsx'
import { DispersionPanel } from './panels/DispersionPanel.tsx'
import { PublicFinancesPanel } from './panels/PublicFinancesPanel.tsx'
import { LaborPanel } from './panels/LaborPanel.tsx'
import { MarketsPanel } from './panels/MarketsPanel.tsx'
import { MandateChartPanel } from './panels/MandateChartPanel.tsx'
import { FirstMeetingGuide } from './FirstMeetingGuide.tsx'
import { QuickMeeting } from './QuickMeeting.tsx'
import { DecisiveBanner } from './DecisiveBanner.tsx'
import { readTempo, decisiveMeetingOf } from '../../simulation/meeting/tempo.ts'
import { useNarrowScreen } from '../../components/useNarrowScreen.ts'
import { hasSeenGuide, markGuideSeen } from '../records/storage.ts'
import { MeetingBriefPanel } from './panels/MeetingBriefPanel.tsx'
import { PressPanel } from './panels/PressPanel.tsx'
import { ObjectivePanel } from './panels/ObjectivePanel.tsx'
import { StandingPanel } from './panels/StandingPanel.tsx'
import { OrderBanner } from '../../components/terminal/Explain.tsx'
import { GuillocheBand } from '../../components/engraving/Guilloche.tsx'
import { readOrder } from './order.ts'
import { AimDisclosure } from './AimDisclosure.tsx'
import { BulletinFlash } from './BulletinFlash.tsx'
import { TutorialGoalPanel } from './panels/TutorialGoalPanel.tsx'
import { readStanding } from './standing.ts'
import { PricesPanel } from './panels/PricesPanel.tsx'
import { regimeObjective } from './objective.ts'
import { registerFor } from './register.ts'
import { SettingsPanel } from '../settings/SettingsPanel.tsx'
import { shouldPlayInterval, useSettings } from '../settings/settings.ts'
import { IntervalPlayer } from './IntervalPlayer.tsx'
import { tenureLine } from './tenureLine.ts'

/**
 * One policy meeting.
 *
 * The layout answers the player's three questions in the order they ask them:
 * where does policy stand (the stance strip, permanently), what has changed
 * since last time (the changes panel), and what should I do about it (the
 * tabs, ending at the Policy Desk).
 *
 * The stance strip is above the tabs rather than inside one because a real
 * rate that is only visible on the panel you happen to have open is a real
 * rate you will forget to check — which is exactly how a mandate gets eased by
 * accident.
 *
 * The panels read the observation set exclusively; the latent economy behind
 * it never reaches this component.
 */

type PanelId =
  | 'press'
  | 'brief'
  | 'markets'
  | 'prices'
  | 'labor'
  | 'area'
  | 'treasury'
  | 'desk'

// The press sits first because it is what a chair reads first, and because it
// is now the only place the news is: the major-event banner and the flat wire
// list that used to sit above the tabs were three unranked channels competing
// for the same attention, which is how a player ends up reading none of them.
//
// Markets sits next, ahead of the statistics, on purpose: it is the only panel
// whose numbers describe *now* rather than a reference period already past, so
// it is where a decision shows up first.
const TABS: readonly { readonly id: PanelId; readonly label: string }[] = [
  { id: 'press', label: 'The Press' },
  { id: 'brief', label: 'Meeting Brief' },
  { id: 'markets', label: 'Markets' },
  { id: 'prices', label: 'Prices' },
  { id: 'labor', label: 'Labor' },
  // Only where there is an area to disperse. See `DispersionPanel`.
  { id: 'area', label: 'The Area' },
  { id: 'treasury', label: 'The Treasury' },
  { id: 'desk', label: 'Policy Desk' },
]

export function MeetingScreen({
  session,
  ledger,
  settled,
  counterfactual,
  scoreboard,
  onConfirm,
}: {
  readonly session: RunSession
  /** Projections due to be checked against what happened. See `runContext`. */
  readonly ledger: readonly LedgerEntry[]
  /** A promise the last decision settled, if it settled one. */
  readonly settled: SettledPromise | null
  /** What the policy has delivered, exactly. Null before the first decision. */
  readonly counterfactual: CounterfactualLine | null
  /** Which school has been right so far. */
  readonly scoreboard: Scoreboard
  readonly onConfirm: (pkg: PolicyPackage) => MeetingResult
}) {
  const [panel, setPanel] = useState<PanelId>('press')
  // Phone width puts the tab the player came for above the context. See the
  // comment at the swap itself.
  const narrow = useNarrowScreen()
  // What kind of meeting this is — see `simulation/meeting/tempo.ts`. Derived
  // in the engine so it replays; a tempo computed here would differ between a
  // run and its replay the moment this file changed.
  const { tempo, because } = useMemo(() => readTempo(session), [session])
  // A quick meeting the player has chosen to open. Reset on every meeting,
  // because the component is remounted at each one.
  const [roomOpen, setRoomOpen] = useState(false)
  const quick = tempo === 'quick' && !roomOpen
  const order = readOrder(session)

  /*
   * The bulletin that takes the screen: a major event, or something critical
   * that has just *become* critical. Null at most meetings by construction —
   * see `explain/bulletin.ts` for why every kind fires on a transition rather
   * than on a state, and for the per-mandate cap.
   *
   * `useState` keyed on nothing, because this component is remounted at every
   * meeting: dismissing it dismisses it for this meeting and the next one
   * starts clean, which is the same mechanism the interval player and the
   * reaction screen already use.
   */
  const bulletin = session.bulletin
  const [bulletinSeen, setBulletinSeen] = useState(false)

  const { settings } = useSettings()
  // This component is remounted at every meeting, so each of these is shown
  // exactly once, in order: first the interval that has just elapsed, then the
  // same-day reaction to the decision that opened it, then the meeting.
  const [playingInterval, setPlayingInterval] = useState(
    () => session.interval.length > 0 && shouldPlayInterval(settings),
  )
  const [showReaction, setShowReaction] = useState(
    session.onTheDay !== null && session.previousObservation !== null,
  )
  // What a meeting is, shown once per browser, on the first one. The flag is
  // written here rather than on dismissal so a reload mid-explanation does not
  // start it again — see `hasSeenGuide`.
  const [showGuide, setShowGuide] = useState(() => {
    if (session.state.meetingIndex !== 0 || hasSeenGuide()) return false
    markGuideSeen()
    return true
  })

  const { config } = session.state
  const institution = getInstitution(config.institution)
  // Difficulty decides the language the numbers are published in, not only
  // which of them are shown. See `features/meeting/register.ts`.
  const register = registerFor(config.difficulty)
  // What winning looks like *now*. Under a cost-push shock this is not the
  // standing objective, and the score follows it — see `objective.ts`.
  // `inflationTargetFor`, not the institution's: 1929-33 was run to a stable
  // price level and telling that player to bring inflation back to 2 % is the
  // game being wrong about the thing it is teaching.
  const objective = regimeObjective(
    session.observation,
    inflationTargetFor(session.state.config),
  )

  /*
   * Every *phase* opens at the top, not just every route.
   *
   * > "Quand j'entre dans une réunion la page s'ouvre au milieu et je dois
   * > scroller VERS LE HAUT pour lire l'ordre. On ne doit JAMAIS avoir à
   * > remonter."
   *
   * `ScrollToTop` handles route changes and is not enough on its own: the
   * interval player, the reaction screen and the meeting itself are three
   * phases of the *same* route, and the transitions between them are where a
   * player actually lands mid-page — they press a button near the bottom of
   * a long screen and the next phase renders under a scroll position that
   * belonged to the last one.
   *
   * Measured before this: playing twelve meetings on a phone, the screen
   * opened scrolled by between 451 and 1,399 pixels at *every single one*,
   * with the order line above the fold each time.
   */
  useEffect(() => {
    globalThis.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    // `showGuide` is in here too: the first-meeting guide scrolls its own
    // anchors into view, which is right while it is running and leaves the
    // player a thousand pixels down the page the moment it finishes.
  }, [session.state.meetingIndex, playingInterval, showReaction, showGuide])
  // How the mandate is going, in both directions. The interface used to
  // signal only danger; a mandate going well now says so, and names why.
  // The mandate's own objective and sustainable rate, not the institution's.
  const mandateObjective = inflationTargetFor(config)
  const sustainable = sustainableRateFor(config)
  const standing = readStanding(
    session.observation,
    session.outcome,
    config.institution,
    mandateObjective,
    sustainable,
  )
  // The same reading a meeting ago, so the panel can tell "it is going well"
  // from "it has *started* going well" — the second is a moment and the first
  // is a state, and only one of them is worth marking.
  const previousStanding =
    session.previousObservation === null
      ? null
      : readStanding(
          session.previousObservation,
          session.outcome,
          config.institution,
          mandateObjective,
          sustainable,
        )
  // Easy ends on a goal rather than a clock, so the goal is on screen at every
  // meeting. Null at every other difficulty.
  const tutorial = tutorialProgress(session.state)
  // What the instruments moved four meetings ago actually produced. Empty at
  // most meetings; shown on the transition screen when it is not.
  const realised = realiseDue(
    ledger,
    session.state.meetingIndex,
    session.observation,
  )
  // The morning after the decision that opened this meeting. Derived from the
  // decision the player actually confirmed, so the papers are reacting to them
  // rather than to the state of the world.
  const lastDecision = session.decisions.at(-1)
  const frontPages =
    lastDecision === undefined || session.previousObservation === null
      ? []
      : decisionFrontPages({
          observation: session.previousObservation,
          institution: config.institution,
          decision: {
            basisPoints:
              lastDecision.package.actions.find(
                (action) => action.instrument === 'policy_rate',
              )?.magnitude ?? 0,
            rate: session.state.stance.targetRate,
            committed:
              lastDecision.package.communication?.commitment === 'conditional_path' ||
              lastDecision.package.communication?.commitment === 'strong_commitment',
          },
        })

  // Indicators joining the dashboard at this meeting, on the learning mandate.
  // Empty everywhere else. See `observation/unlock.ts`.
  const newSeries = unlockedAt(config.difficulty, session.state.meetingIndex)
    .map((id) => getSeries(id)?.label)
    .filter((label): label is string => label !== undefined)

  // In a historical mandate the meeting has a date, and the date is the
  // better name for it: "Meeting 6 of 32" tells you where you are in a
  // schedule, "March 18, 1980" tells you what is happening outside.
  const dated = meetingLabel(config, session.state.meetingIndex)
  // A mandate-defining crisis now lives on the press page rather than in a
  // banner above the tabs. That is the right home for it — it is the lead
  // story, and three unranked news channels competing above the fold is what
  // made the screen unreadable — but a crisis behind a tab has to announce
  // itself, so the tab carries a mark on the meeting one breaks.
  const breaking =
    session.majorEvent !== null && isMajorEvent(session.majorEvent.eventId)
  const severeWarnings = session.outcome.warnings.filter(
    (warning) => warning.severity === 'severe',
  )

  /*
   * Full width, no gutter, no centred column.
   *
   * > "Fini la colonne étroite au milieu du vide : des panneaux accolés,
   * > séparés par des filets d'un pixel, qui occupent toute la largeur."
   *
   * The `mx-auto max-w-3xl px-4` that was here is the single most reliable
   * tell that a page was laid out as a document. A terminal has no margins:
   * it fills the glass, and what organises it is rules rather than
   * whitespace.
   */
  /*
   * `onwood`, not `ink`, and the distinction is the oldest live rule in this
   * project's design system.
   *
   * `ink` is text on a **panel**, whose material flips between the two
   * directions — walnut in the terminal, cream paper in papers-on-the-table.
   * `onwood` is text on the **room**, which is dark in both. This `<main>`,
   * its status strip and the tab strip all sit on the room, so they take the
   * room's pair.
   *
   * A sweep that moved every `onwood` to `ink` this pass caught these four by
   * accident: correct in the terminal, where both resolve to the same grey,
   * and 1.5:1 in papers-on-the-table, where `ink` is a dark brown on dark
   * wood. Which is the same mistake this file's own header warns about,
   * approached from the other side — and a reminder that "it looked right"
   * only ever means "it looked right in the direction I was looking at".
   */
  return (
    <main className="min-h-screen w-full bg-page text-onwood">
      {/*
        The note's own border, in the printed direction only.

        This is the drawn furniture the project already owns — a hypotrochoid
        braid, computed rather than drawn — and it is what makes the second
        direction *a banknote* rather than the terminal with the lights on.
        It is hidden in the terminal because a dealing screen has no engraved
        border, and `aria-hidden` in both because it says nothing.
      */}
      <div aria-hidden="true" className="hidden text-accent-strong direction-paper:block">
        <GuillocheBand height={14} lines={3} frequency={21} waist={0.42} opacity={0.5} />
      </div>

      {/* The status strip. On a terminal the identity of the machine is one
          line of small type across the top, not a title block. */}
      {/* `bg-room`, not `bg-raised`. The status strip is the machine's own
          chrome rather than a document on it, so it belongs on the room —
          which is dark in both directions and therefore pairs with `onwood`.
          On `bg-raised` it was cream in papers-on-the-table and carrying
          on-wood text at 3.1:1. */}
      <header className="border-b border-edge-accent bg-room px-2 py-1">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <p className="font-mono text-2xs uppercase tracking-[0.16em] text-onwood-faint">
              {institution.name} ·{' '}
              {dated === null ? config.difficulty : 'historical'} · seed{' '}
              {config.seed}
            </p>
            <h1 className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-accent-onwood">
              {/*
                "Meeting 3 of 16" is gone, and it had to go: under a survival
                structure there is no N. You serve until you are revoked, and
                a denominator is a promise the game does not make. What
                replaces it is the thing a governor actually knows — which
                term they are in, and how far the next hearing is.

                The two institutions read differently here on purpose. A Fed
                Chair counts down to a reappointment they can fail; an ECB
                President, whose term is non-renewable and who cannot be
                removed, has nothing to count down to and is told the year
                instead. See `config/tenure.ts`.
              */}
              {dated !== null ? dated : tenureLine(session)}
            </h1>
          </div>
          <SettingsPanel className="w-full sm:w-72" />
        </div>
      </header>

      {playingInterval ? (
        <div className="mt-5">
          <IntervalPlayer
            frames={session.interval}
            onDone={() => setPlayingInterval(false)}
          />
        </div>
      ) : showReaction && session.previousObservation !== null && session.onTheDay !== null ? (
        <div className="mt-5">
          <ReactionPanel
            before={session.previousObservation}
            onTheDay={session.onTheDay}
            headlines={session.newswire.length + (breaking ? 1 : 0)}
            frontPages={frontPages}
            promise={settled}
            realised={realised}
            vote={session.vote}
            call={session.call}
            config={config}
            current={session.observation}
            // Only after the decisive meeting, which promised it.
            fork={
              session.state.meetingIndex === decisiveMeetingOf(session) + 1
                ? counterfactual
                : null
            }
            onContinue={() => setShowReaction(false)}
          />
        </div>
      ) : (
        <>
          {/*
              **The bulletin, before the guide and before the meeting.**

              It is the only thing in the game that interrupts, and the order
              matters: a flash drawn *under* the first-meeting spotlight would
              be an alarm behind a tutorial. It is also deliberately not shown
              during the interval or the reaction screen above — those are
              already a sequence the player is stepping through, and an alarm
              inside a cutscene is a third thing happening at once.
          */}
          {bulletin !== null && !bulletinSeen && (
            <BulletinFlash
              bulletin={bulletin}
              onDismiss={() => setBulletinSeen(true)}
            />
          )}

          {showGuide && (
            <FirstMeetingGuide
              onPanel={(next) => setPanel(next as PanelId)}
              onDone={() => {
                setShowGuide(false)
                // Back to the newspaper, which is where a meeting opens. The
                // guide ends on the desk because that is what its last step
                // points at, and leaving a first-time player there would skip
                // them past every screen that tells them why they are moving
                // anything.
                setPanel('press')
              }}
            />
          )}

          {/* Two groups, and on a phone they swap.

              The context — where the economy is — and then the work: the tab
              strip and the panel the player came to read.

              Measured before changing it: on a 390-wide screen the header,
              the objective, three stacked charts and the stance strip come to
              1,518 pixels, or 1.8 phone-heights, *before* the tab you came
              for — at every one of up to thirty-two meetings. On a desktop
              that is one glance. On a phone it is a scroll performed
              thirty-two times, and it was the oldest complaint on this
              project.

              So the narrow layout puts the work first and the context under
              it. Nothing is hidden and nothing is cut: a played mandate
              reported that from about the fifth meeting players look only at
              the charts, and the charts are still there — one swipe down,
              which on a phone is where the second thing goes.

              Reordered in the DOM rather than with a CSS `order`, so the
              keyboard visits what the eye sees. Both groups are keyed, so
              crossing the breakpoint moves them rather than rebuilding them —
              a remount would close every disclosure the player had opened.
              See `components/useNarrowScreen.ts`. */}
          {/*
            The order, at the top of both surfaces, carrying the alarms.

            What used to be here was the standing line — *"The mandate is on
            an even keel / The record so far"*, in a serif, on a lighter
            ground, directly above the order and saying the same thing less
            usefully. It was the last piece of the old world on the screen.

            Deleting it outright would have thrown away the one thing it did
            carry that nothing else does: the severe warnings, which are the
            alarms that say a mandate is about to end. So it is absorbed
            rather than removed — the banner takes them, which is where an
            alarm belongs anyway. An alarm underneath the instruction is an
            alarm you read second.

            The record itself is not lost either: it is the standing panel in
            the room, one click away, where a record belongs.
          */}
          <OrderBanner
            command={order.command}
            detail={order.detail}
            severity={severeWarnings.length > 0 ? 'urgent' : order.severity}
            compact={quick}
            warnings={severeWarnings.map((warning) => warning.message)}
          />

          {/* "What am I trying to do?", at one gesture, on both surfaces.

              A player who knows which way to move the rate at every meeting
              and never learns what the rate is being moved toward has a very
              good interface to a game they are not playing. The guided
              opening, the order line and the consequence copy all answer
              *what should I do with this number*; this is the other question,
              and it was being asked in a loop. Closed it costs one line. */}
          <AimDisclosure config={session.state.config} compact={quick} />

          {/* The record, in the room rather than above the order.
              What has been held and what is slipping is a thing to consult,
              not a thing to be told before every decision — so it keeps its
              panel and loses its place at the top of the screen. */}
          {!quick && (
            <StandingPanel
              standing={standing}
              previousTone={previousStanding?.tone ?? null}
              severeWarnings={severeWarnings}
            />
          )}

          {/* The meeting this mandate is remembered by: announced the meeting
              before, so it can be dreaded, and marked when it arrives. */}
          <DecisiveBanner session={session} />

          {because !== null && (
            <p
              data-because=""
              className="mt-3 text-sm text-onwood-soft"
            >
              {because}
            </p>
          )}

          {quick ? (
            <QuickMeeting
              session={session}
              onConfirm={onConfirm}
              onOpenRoom={() => setRoomOpen(true)}
              shock={session.majorEvent?.title ?? session.minorEvents[0]?.title ?? null}
            />
          ) : narrow ? (
            <>
              <Fragment key="work">
            <div
              role="tablist"
              aria-label="Meeting panels"
              data-guide="tabs"
              className="mt-6 flex flex-wrap gap-1"
            >
              {TABS.filter(
                (tab) => tab.id !== 'area' || session.observation.area !== null,
              ).map((tab) => {
                const selected = tab.id === panel
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    id={`tab-${tab.id}`}
                    aria-selected={selected}
                    aria-controls={`panel-${tab.id}`}
                    onClick={() => setPanel(tab.id)}
                    // The selected tab is a sheet of paper pulled forward out of
                    // the stack; the rest are still in the room.
                    // Not animated, deliberately. A tab moving between paper and
                    // walnut is a discrete change of state, and interpolating it
                    // puts dark ink on a still-dark ground for the length of the
                    // transition — measured at 1.11:1 on every tab change, which
                    // is worse than anything this redesign set out to fix.
                    className={`-mb-px rounded-t-md border border-b-0 px-3 py-2 text-sm ${
                      selected
                        ? 'border-edge bg-panel font-semibold text-ink'
                        : 'border-edge-room bg-room text-onwood-soft hover:bg-inset hover:text-onwood'
                    }`}
                  >
                    {tab.label}
                    {tab.id === 'press' && breaking && (
                      <>
                        <span
                          aria-hidden="true"
                          className="ml-1.5 inline-block h-2 w-2 rounded-full bg-bad align-middle"
                        />
                        <span className="sr-only"> — breaking news</span>
                      </>
                    )}
                  </button>
                )
              })}
            </div>

            <div
              role="tabpanel"
              id={`panel-${panel}`}
              aria-labelledby={`tab-${panel}`}
              tabIndex={-1}
              className="rounded-lg rounded-tl-none border border-edge bg-panel p-4 text-ink shadow-panel sm:p-5"
            >
              {panel === 'press' && <PressPanel session={session} />}
              {panel === 'brief' && (
                <div className="space-y-5">
                  {session.observation.diagnosis !== null && (
                    <DiagnosisPanel diagnosis={session.observation.diagnosis} />
                  )}
                  {/* "What changed since the last meeting" used to sit above the
                      tabs, permanently, at five items of two lines each. It is
                      the brief's own subject and it belongs in the brief: a
                      panel a player must scroll past to reach the interface is
                      a panel that has stopped being read. */}
                  <ChangesPanel
                    objective={mandateObjective}
                    observation={session.observation}
                    previousObservation={session.previousObservation}
                    institution={config.institution}
                    counterfactual={counterfactual}
                    newSeries={newSeries}
                  />
                  <MeetingBriefPanel
                    objective={mandateObjective}
                    observation={session.observation}
                    outcome={session.outcome}
                    institution={config.institution}
                  />
                </div>
              )}
              {panel === 'markets' && (
                <MarketsPanel
                  observation={session.observation}
                  previousObservation={session.previousObservation}
                  difficulty={config.difficulty}
                />
              )}
              {panel === 'prices' && (
                <PricesPanel
                  observation={session.observation}
                  inflationTarget={inflationTargetFor(config)}
                  register={register}
                  difficulty={config.difficulty}
                />
              )}
              {panel === 'labor' && (
                <LaborPanel
                  observation={session.observation}
                  register={register}
                  difficulty={config.difficulty}
                />
              )}
              {panel === 'area' && session.observation.area !== null && (
                <DispersionPanel area={session.observation.area} />
              )}
              {/* The public finances. Behind a tab, not above it, because they
                  are not in the mandate and a player who never opens this tab
                  has not missed anything they are graded on — they have missed
                  the reason a fiscal-dominance episode turns up later. */}
              {panel === 'treasury' && (
                <PublicFinancesPanel
                  config={config}
                  latent={session.state.latent}
                  history={session.state.history.map((entry) => entry.latent)}
                />
              )}
              {panel === 'desk' && (
                <PolicyDeskPanel
                  session={session}
                  scoreboard={scoreboard}
                  onConfirm={onConfirm}
                />
              )}
            </div>

            {panel !== 'desk' && (
              <button
                type="button"
                onClick={() => setPanel('desk')}
                className="mt-6 rounded-md border border-edge-accent bg-accent px-4 py-2 text-sm font-semibold text-on-accent shadow-panel transition-colors hover:bg-accent-onwood"
              >
                Go to the Policy Desk
              </button>
            )}
              </Fragment>
              <Fragment key="context">
            {tutorial !== null && <TutorialGoalPanel progress={tutorial} />}

            {/* On the tutorial these two said the same thing in different words,
                one directly above the other: "repair the economy, then hold it
                there" and "bring inflation back to 2 % without breaking
                employment". The tutorial goal *is* the objective there, stated
                in the two numbers that end the mandate, so the general statement
                is the one that goes. Above easy there is no tutorial goal and
                the objective panel is the only thing saying what winning is —
                and it is the panel that changes under a supply shock, which is
                the whole reason it is on screen. */}
            {tutorial === null && (
              <div className="mt-4">
                <ObjectivePanel objective={objective} />
              </div>
            )}

            {/* The charts, before any prose. A played mandate reported that from
                about the fifth meeting the player had stopped reading and was
                looking only at these — which is the correct instinct about what
                a macroeconomic series is for, and an indictment of a layout that
                had them nowhere. */}
            <div data-guide="charts">
              <MandateChartPanel observation={session.observation} config={config} />
            </div>

            <StanceStrip
              objective={mandateObjective}
              sustainable={sustainable}
              observation={session.observation}
              previousObservation={session.previousObservation}
              difficulty={config.difficulty}
              institution={config.institution}
            />

              </Fragment>
            </>
          ) : (
            <>
              <Fragment key="context">
            {tutorial !== null && <TutorialGoalPanel progress={tutorial} />}

            {/* On the tutorial these two said the same thing in different words,
                one directly above the other: "repair the economy, then hold it
                there" and "bring inflation back to 2 % without breaking
                employment". The tutorial goal *is* the objective there, stated
                in the two numbers that end the mandate, so the general statement
                is the one that goes. Above easy there is no tutorial goal and
                the objective panel is the only thing saying what winning is —
                and it is the panel that changes under a supply shock, which is
                the whole reason it is on screen. */}
            {tutorial === null && (
              <div className="mt-4">
                <ObjectivePanel objective={objective} />
              </div>
            )}

            {/* The charts, before any prose. A played mandate reported that from
                about the fifth meeting the player had stopped reading and was
                looking only at these — which is the correct instinct about what
                a macroeconomic series is for, and an indictment of a layout that
                had them nowhere. */}
            <div data-guide="charts">
              <MandateChartPanel observation={session.observation} config={config} />
            </div>

            <StanceStrip
              objective={mandateObjective}
              sustainable={sustainable}
              observation={session.observation}
              previousObservation={session.previousObservation}
              difficulty={config.difficulty}
              institution={config.institution}
            />

              </Fragment>
              <Fragment key="work">
            <div
              role="tablist"
              aria-label="Meeting panels"
              data-guide="tabs"
              className="mt-6 flex flex-wrap gap-1"
            >
              {TABS.filter(
                (tab) => tab.id !== 'area' || session.observation.area !== null,
              ).map((tab) => {
                const selected = tab.id === panel
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    id={`tab-${tab.id}`}
                    aria-selected={selected}
                    aria-controls={`panel-${tab.id}`}
                    onClick={() => setPanel(tab.id)}
                    // The selected tab is a sheet of paper pulled forward out of
                    // the stack; the rest are still in the room.
                    // Not animated, deliberately. A tab moving between paper and
                    // walnut is a discrete change of state, and interpolating it
                    // puts dark ink on a still-dark ground for the length of the
                    // transition — measured at 1.11:1 on every tab change, which
                    // is worse than anything this redesign set out to fix.
                    className={`-mb-px rounded-t-md border border-b-0 px-3 py-2 text-sm ${
                      selected
                        ? 'border-edge bg-panel font-semibold text-ink'
                        : 'border-edge-room bg-room text-onwood-soft hover:bg-inset hover:text-onwood'
                    }`}
                  >
                    {tab.label}
                    {tab.id === 'press' && breaking && (
                      <>
                        <span
                          aria-hidden="true"
                          className="ml-1.5 inline-block h-2 w-2 rounded-full bg-bad align-middle"
                        />
                        <span className="sr-only"> — breaking news</span>
                      </>
                    )}
                  </button>
                )
              })}
            </div>

            <div
              role="tabpanel"
              id={`panel-${panel}`}
              aria-labelledby={`tab-${panel}`}
              tabIndex={-1}
              className="rounded-lg rounded-tl-none border border-edge bg-panel p-4 text-ink shadow-panel sm:p-5"
            >
              {panel === 'press' && <PressPanel session={session} />}
              {panel === 'brief' && (
                <div className="space-y-5">
                  {session.observation.diagnosis !== null && (
                    <DiagnosisPanel diagnosis={session.observation.diagnosis} />
                  )}
                  {/* "What changed since the last meeting" used to sit above the
                      tabs, permanently, at five items of two lines each. It is
                      the brief's own subject and it belongs in the brief: a
                      panel a player must scroll past to reach the interface is
                      a panel that has stopped being read. */}
                  <ChangesPanel
                    objective={mandateObjective}
                    observation={session.observation}
                    previousObservation={session.previousObservation}
                    institution={config.institution}
                    counterfactual={counterfactual}
                    newSeries={newSeries}
                  />
                  <MeetingBriefPanel
                    objective={mandateObjective}
                    observation={session.observation}
                    outcome={session.outcome}
                    institution={config.institution}
                  />
                </div>
              )}
              {panel === 'markets' && (
                <MarketsPanel
                  observation={session.observation}
                  previousObservation={session.previousObservation}
                  difficulty={config.difficulty}
                />
              )}
              {panel === 'prices' && (
                <PricesPanel
                  observation={session.observation}
                  inflationTarget={inflationTargetFor(config)}
                  register={register}
                  difficulty={config.difficulty}
                />
              )}
              {panel === 'labor' && (
                <LaborPanel
                  observation={session.observation}
                  register={register}
                  difficulty={config.difficulty}
                />
              )}
              {panel === 'area' && session.observation.area !== null && (
                <DispersionPanel area={session.observation.area} />
              )}
              {/* The public finances. Behind a tab, not above it, because they
                  are not in the mandate and a player who never opens this tab
                  has not missed anything they are graded on — they have missed
                  the reason a fiscal-dominance episode turns up later. */}
              {panel === 'treasury' && (
                <PublicFinancesPanel
                  config={config}
                  latent={session.state.latent}
                  history={session.state.history.map((entry) => entry.latent)}
                />
              )}
              {panel === 'desk' && (
                <PolicyDeskPanel
                  session={session}
                  scoreboard={scoreboard}
                  onConfirm={onConfirm}
                />
              )}
            </div>

            {panel !== 'desk' && (
              <button
                type="button"
                onClick={() => setPanel('desk')}
                className="mt-6 rounded-md border border-edge-accent bg-accent px-4 py-2 text-sm font-semibold text-on-accent shadow-panel transition-colors hover:bg-accent-onwood"
              >
                Go to the Policy Desk
              </button>
            )}
              </Fragment>
            </>
          )}
        </>
      )}
    </main>
  )
}
