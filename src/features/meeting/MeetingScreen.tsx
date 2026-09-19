import { useState } from 'react'
import {
  getInstitution,
  isMajorEvent,
  tutorialProgress,
  type MeetingResult,
  type PolicyPackage,
  type RunSession,
} from '../../simulation/index.ts'
import { realiseDue, type LedgerEntry } from '../policy/instrumentLedger.ts'
import type { SettledPromise } from '../policy/settledPromise.ts'
import type { CounterfactualLine } from './counterfactualLine.ts'
import { PolicyDeskPanel } from '../policy/PolicyDeskPanel.tsx'
import { ReactionPanel } from '../policy/ReactionPanel.tsx'
import { StanceStrip } from '../policy/StanceStrip.tsx'
import { ChangesPanel } from './panels/ChangesPanel.tsx'
import { DiagnosisPanel } from './panels/DiagnosisPanel.tsx'
import { DispersionPanel } from './panels/DispersionPanel.tsx'
import { LaborPanel } from './panels/LaborPanel.tsx'
import { MarketsPanel } from './panels/MarketsPanel.tsx'
import { MandateChartPanel } from './panels/MandateChartPanel.tsx'
import { MeetingBriefPanel } from './panels/MeetingBriefPanel.tsx'
import { PressPanel } from './panels/PressPanel.tsx'
import { ObjectivePanel } from './panels/ObjectivePanel.tsx'
import { StandingPanel } from './panels/StandingPanel.tsx'
import { TutorialGoalPanel } from './panels/TutorialGoalPanel.tsx'
import { readStanding } from './standing.ts'
import { PricesPanel } from './panels/PricesPanel.tsx'
import { regimeObjective } from './objective.ts'
import { registerFor } from './register.ts'
import { SettingsPanel } from '../settings/SettingsPanel.tsx'
import { shouldPlayInterval, useSettings } from '../settings/settings.ts'
import { IntervalPlayer } from './IntervalPlayer.tsx'

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

type PanelId = 'press' | 'brief' | 'markets' | 'prices' | 'labor' | 'area' | 'desk'

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
  { id: 'desk', label: 'Policy Desk' },
]

export function MeetingScreen({
  session,
  ledger,
  settled,
  counterfactual,
  onConfirm,
}: {
  readonly session: RunSession
  /** Projections due to be checked against what happened. See `runContext`. */
  readonly ledger: readonly LedgerEntry[]
  /** A promise the last decision settled, if it settled one. */
  readonly settled: SettledPromise | null
  /** What the policy has delivered, exactly. Null before the first decision. */
  readonly counterfactual: CounterfactualLine | null
  readonly onConfirm: (pkg: PolicyPackage) => MeetingResult
}) {
  const [panel, setPanel] = useState<PanelId>('press')
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

  const { config } = session.state
  const institution = getInstitution(config.institution)
  // Difficulty decides the language the numbers are published in, not only
  // which of them are shown. See `features/meeting/register.ts`.
  const register = registerFor(config.difficulty)
  // What winning looks like *now*. Under a cost-push shock this is not the
  // standing objective, and the score follows it — see `objective.ts`.
  const objective = regimeObjective(session.observation, institution.inflationTarget)
  // How the mandate is going, in both directions. The interface used to
  // signal only danger; a mandate going well now says so, and names why.
  const standing = readStanding(session.observation, session.outcome, config.institution)
  // The same reading a meeting ago, so the panel can tell "it is going well"
  // from "it has *started* going well" — the second is a moment and the first
  // is a state, and only one of them is worth marking.
  const previousStanding =
    session.previousObservation === null
      ? null
      : readStanding(session.previousObservation, session.outcome, config.institution)
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
  const meetingNumber = session.state.meetingIndex + 1
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

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-6 text-onwood">
      {/* The brass rule under the header is the room's one piece of hardware:
          it marks where the institution ends and the meeting begins. */}
      <header className="border-b-2 border-edge-accent pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-2xs uppercase tracking-[0.14em] text-onwood-faint">
              {institution.name} · {config.difficulty} · seed {config.seed}
            </p>
            <h1 className="mt-1 font-display text-2xl font-semibold text-onwood">
              {/* A tutorial has no scheduled length, so "of N" would be a
                  promise it does not make: N is the point at which it gives
                  up, not the point at which it ends. */}
              {tutorial === null
                ? `Meeting ${meetingNumber} of ${config.meetingCount}`
                : `Meeting ${meetingNumber}`}
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
            promise={settled}
            realised={realised}
            onContinue={() => setShowReaction(false)}
          />
        </div>
      ) : (
        <>
          <StandingPanel
            standing={standing}
            previousTone={previousStanding?.tone ?? null}
            severeWarnings={severeWarnings}
          />

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
          <MandateChartPanel
            observation={session.observation}
            institution={config.institution}
          />

          <StanceStrip
            observation={session.observation}
            previousObservation={session.previousObservation}
            difficulty={config.difficulty}
            institution={config.institution}
          />

          <div
            role="tablist"
            aria-label="Meeting panels"
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
                  observation={session.observation}
                  previousObservation={session.previousObservation}
                  institution={config.institution}
                  counterfactual={counterfactual}
                />
                <MeetingBriefPanel
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
              />
            )}
            {panel === 'prices' && (
              <PricesPanel
                observation={session.observation}
                inflationTarget={institution.inflationTarget}
                register={register}
              />
            )}
            {panel === 'labor' && (
              <LaborPanel observation={session.observation} register={register} />
            )}
            {panel === 'area' && session.observation.area !== null && (
              <DispersionPanel area={session.observation.area} />
            )}
            {panel === 'desk' && (
              <PolicyDeskPanel session={session} onConfirm={onConfirm} />
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
        </>
      )}
    </main>
  )
}
