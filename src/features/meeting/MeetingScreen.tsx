import { useState } from 'react'
import {
  getInstitution,
  type MeetingResult,
  type PolicyPackage,
  type RunSession,
} from '../../simulation/index.ts'
import { PolicyDeskPanel } from '../policy/PolicyDeskPanel.tsx'
import { ReactionPanel } from '../policy/ReactionPanel.tsx'
import { StanceStrip } from '../policy/StanceStrip.tsx'
import { ChangesPanel } from './panels/ChangesPanel.tsx'
import { DiagnosisPanel } from './panels/DiagnosisPanel.tsx'
import { LaborPanel } from './panels/LaborPanel.tsx'
import { MajorEventPanel } from './panels/MajorEventPanel.tsx'
import { MarketsPanel } from './panels/MarketsPanel.tsx'
import { MeetingBriefPanel } from './panels/MeetingBriefPanel.tsx'
import { ObjectivePanel } from './panels/ObjectivePanel.tsx'
import { PricesPanel } from './panels/PricesPanel.tsx'
import { regimeObjective } from './objective.ts'
import { registerFor } from './register.ts'
import { SettingsPanel } from '../settings/SettingsPanel.tsx'

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

type PanelId = 'brief' | 'markets' | 'prices' | 'labor' | 'desk'

// Markets sits second, right after the brief and ahead of the statistics, on
// purpose: it is the only panel whose numbers describe *now* rather than a
// reference period already past, so it is where a player should look first and
// where a decision shows up first.
const TABS: readonly { readonly id: PanelId; readonly label: string }[] = [
  { id: 'brief', label: 'Meeting Brief' },
  { id: 'markets', label: 'Markets' },
  { id: 'prices', label: 'Prices' },
  { id: 'labor', label: 'Labor' },
  { id: 'desk', label: 'Policy Desk' },
]

export function MeetingScreen({
  session,
  onConfirm,
}: {
  readonly session: RunSession
  readonly onConfirm: (pkg: PolicyPackage) => MeetingResult
}) {
  const [panel, setPanel] = useState<PanelId>('brief')
  // This component is remounted at every meeting, so the reaction to the
  // decision that opened this meeting is shown exactly once.
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
  const meetingNumber = session.state.meetingIndex + 1
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
              Meeting {meetingNumber} of {config.meetingCount}
            </h1>
          </div>
          <SettingsPanel className="w-full sm:w-72" />
        </div>
      </header>

      {showReaction && session.previousObservation !== null && session.onTheDay !== null ? (
        <div className="mt-5">
          <ReactionPanel
            before={session.previousObservation}
            onTheDay={session.onTheDay}
            newswire={session.newswire}
            onContinue={() => setShowReaction(false)}
          />
        </div>
      ) : (
        <>
          {severeWarnings.length > 0 && (
            <div
              role="alert"
              className="mt-4 rounded-lg border-l-4 border-bad bg-bad-surface p-3 text-sm text-bad-strong shadow-panel"
            >
              <p className="font-display text-base font-semibold">Mandate at risk</p>
              <ul className="mt-1 list-disc pl-5">
                {severeWarnings.map((warning) => (
                  <li key={warning.id}>{warning.message}</li>
                ))}
              </ul>
            </div>
          )}

          <MajorEventPanel
            majorEvent={session.majorEvent}
            eventLog={session.state.eventLog}
            meetingIndex={session.state.meetingIndex}
          />

          <div className="mt-4">
            <ObjectivePanel objective={objective} />
          </div>

          <StanceStrip
            observation={session.observation}
            previousObservation={session.previousObservation}
          />

          <ChangesPanel
            observation={session.observation}
            previousObservation={session.previousObservation}
            institution={config.institution}
          />

          <div
            role="tablist"
            aria-label="Meeting panels"
            className="mt-6 flex flex-wrap gap-1"
          >
            {TABS.map((tab) => {
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
            {panel === 'brief' && (
              <div className="space-y-5">
                {session.observation.diagnosis !== null && (
                  <DiagnosisPanel diagnosis={session.observation.diagnosis} />
                )}
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
