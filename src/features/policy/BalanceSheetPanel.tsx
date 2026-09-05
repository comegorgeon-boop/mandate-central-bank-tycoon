import {
  availableInstruments,
  getInstrumentRange,
  setsStandingLevel,
  standingLevel,
  type Difficulty,
  type Institution,
  type InstrumentId,
  type PolicyStance,
} from '../../simulation/index.ts'
import { InstrumentStepper } from './InstrumentStepper.tsx'

/**
 * Everything in the toolkit that is not the policy rate or the words.
 *
 * The balance sheet, the liquidity facilities, the corridor: instruments that
 * set a standing *level* which stays in force until the committee changes it,
 * rather than a change measured from where things are.
 *
 * Which of them appear is entirely `config/instruments.ts`'s
 * `availableInstruments` — easy reaches only the rate and guidance, medium adds
 * the balance sheet and the institution's main refinancing facility, hard opens
 * the corridor and the emergency backstops. Before this panel existed the desk
 * rendered a hard-coded policy rate at every difficulty, so four instruments
 * that had been configured `availableFrom: 'medium'` since the toolkit was
 * written had never been reachable by a player.
 */

/** Handled by their own dedicated controls, not as standing levels. */
const DEDICATED: ReadonlySet<InstrumentId> = new Set(['policy_rate', 'forward_guidance'])

export function BalanceSheetPanel({
  institution,
  difficulty,
  stance,
  levels,
  onChange,
}: {
  readonly institution: Institution
  readonly difficulty: Difficulty
  readonly stance: PolicyStance
  /** Levels currently selected at the desk, keyed by instrument. */
  readonly levels: Readonly<Partial<Record<InstrumentId, number>>>
  readonly onChange: (instrument: InstrumentId, next: number) => void
}) {
  const instruments = availableInstruments(institution, difficulty).filter(
    (instrument) => !DEDICATED.has(instrument.id) && setsStandingLevel(instrument.id),
  )

  if (instruments.length === 0) return null

  return (
    <section
      aria-labelledby="toolkit-heading"
      className="mt-5 rounded border border-neutral-800 bg-neutral-900 p-4"
    >
      <p className="text-xs uppercase tracking-wide text-neutral-500">
        The rest of the toolkit
      </p>
      <h3 id="toolkit-heading" className="mt-1 text-base font-semibold text-neutral-100">
        Standing settings
      </h3>
      <p className="mt-1 text-sm text-neutral-400">
        These stay in force between meetings. Leaving one alone is a decision to
        keep it where it is, not an absence of one.
      </p>

      <div className="mt-3">
        {instruments.map((instrument) => {
          const standing = standingLevel(stance, instrument.id) ?? 0
          return (
            <InstrumentStepper
              key={instrument.id}
              instrument={instrument}
              range={getInstrumentRange(instrument, difficulty)}
              label={instrument.label[institution]}
              value={levels[instrument.id] ?? standing}
              standing={standing}
              onChange={(next) => onChange(instrument.id, next)}
            />
          )
        })}
      </div>
    </section>
  )
}
