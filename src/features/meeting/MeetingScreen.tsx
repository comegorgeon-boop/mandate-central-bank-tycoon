import { useState } from 'react'
import {
  getInstitution,
  type MeetingResult,
  type PolicyPackage,
  type RunSession,
} from '../../simulation/index.ts'
import { PolicyDeskPanel } from '../policy/PolicyDeskPanel.tsx'
import { LaborPanel } from './panels/LaborPanel.tsx'
import { MeetingBriefPanel } from './panels/MeetingBriefPanel.tsx'
import { PricesPanel } from './panels/PricesPanel.tsx'

/**
 * One policy meeting.
 *
 * The four panels in this build are Meeting Brief, Prices, Labor and Policy
 * Desk. They read the observation set exclusively; the latent economy behind
 * it never reaches this component.
 */

type PanelId = 'brief' | 'prices' | 'labor' | 'desk'

const TABS: readonly { readonly id: PanelId; readonly label: string }[] = [
  { id: 'brief', label: 'Meeting Brief' },
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

  const { config } = session.state
  const institution = getInstitution(config.institution)
  const meetingNumber = session.state.meetingIndex + 1
  const policyRate = session.state.stance.targetRate
  const severeWarnings = session.outcome.warnings.filter(
    (warning) => warning.severity === 'severe',
  )

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-6 text-neutral-200">
      <header className="border-b border-neutral-800 pb-4">
        <p className="text-xs uppercase tracking-wide text-neutral-500">
          {institution.name} · {config.difficulty} · seed {config.seed}
        </p>
        <h1 className="mt-1 text-xl font-semibold text-neutral-50">
          Meeting {meetingNumber} of {config.meetingCount}
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          Policy rate in force: {policyRate.toFixed(2)} %. Objective:{' '}
          {institution.inflationTarget.toFixed(1)} % inflation.
        </p>
      </header>

      {severeWarnings.length > 0 && (
        <div
          role="alert"
          className="mt-4 rounded border border-amber-700 bg-amber-950/40 p-3 text-sm text-amber-200"
        >
          <p className="font-medium">Mandate at risk</p>
          <ul className="mt-1 list-disc pl-5">
            {severeWarnings.map((warning) => (
              <li key={warning.id}>{warning.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div role="tablist" aria-label="Meeting panels" className="mt-4 flex flex-wrap gap-2">
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
              className={`rounded border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400 ${
                selected
                  ? 'border-neutral-300 bg-neutral-200 font-semibold text-neutral-900'
                  : 'border-neutral-700 text-neutral-200 hover:bg-neutral-800'
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
        className="mt-5"
      >
        {panel === 'brief' && (
          <MeetingBriefPanel
            observation={session.observation}
            outcome={session.outcome}
            institution={config.institution}
          />
        )}
        {panel === 'prices' && (
          <PricesPanel
            observation={session.observation}
            inflationTarget={institution.inflationTarget}
          />
        )}
        {panel === 'labor' && <LaborPanel observation={session.observation} />}
        {panel === 'desk' && (
          <PolicyDeskPanel session={session} onConfirm={onConfirm} />
        )}
      </div>

      {panel !== 'desk' && (
        <button
          type="button"
          onClick={() => setPanel('desk')}
          className="mt-6 rounded border border-neutral-300 bg-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
        >
          Go to the Policy Desk
        </button>
      )}
    </main>
  )
}
