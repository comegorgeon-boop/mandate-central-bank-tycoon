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
  balanceSheet,
  levels,
  onChange,
}: {
  readonly institution: Institution
  readonly difficulty: Difficulty
  readonly stance: PolicyStance
  /**
   * The institution's own holdings, % of GDP. Null if unpublished.
   *
   * A player entering a purchase pace in % of GDP asked, in as many words, how
   * much they had. The engine has published this series with no lag and no
   * measurement error since it existed, and no screen had ever rendered it.
   */
  readonly balanceSheet: number | null
  /** Levels currently selected at the desk, keyed by instrument. */
  readonly levels: Readonly<Partial<Record<InstrumentId, number>>>
  readonly onChange: (instrument: InstrumentId, next: number) => void
}) {
  const instruments = availableInstruments(institution, difficulty).filter(
    (instrument) => !DEDICATED.has(instrument.id) && setsStandingLevel(instrument.id),
  )

  if (instruments.length === 0) return null

  /*
   * **The balance-sheet sentence needs the balance-sheet controls, not the
   * balance-sheet series.**
   *
   * It used to be gated on `balanceSheet !== null`, which asks whether the
   * holdings are *published* — and they are published at every difficulty,
   * with no lag and no measurement error. So the moment this panel first
   * rendered at easy, it explained that "purchases add to that at an annual
   * pace and runoff subtracts from it" on a screen carrying neither control:
   * `asset_purchases` and `balance_sheet_runoff` are both
   * `availableFrom: 'medium'`.
   *
   * Found by photographing the easy desk rather than by any test, and it is
   * this project's own parade again — copy describing a control that is not
   * there, which is the same defect as a gate that cannot fire, read from the
   * other end. The condition is now what the sentence is actually about.
   */
  const explainsBalanceSheet = instruments.some(
    (instrument) =>
      instrument.id === 'asset_purchases' || instrument.id === 'balance_sheet_runoff',
  )

  return (
    <section
      aria-labelledby="toolkit-heading"
      className="mt-5 rounded border border-edge bg-sunk p-4"
    >
      <p className="text-xs uppercase tracking-wide text-ink-faint">
        The rest of the toolkit
      </p>
      <h3 id="toolkit-heading" className="mt-1 text-base font-semibold text-ink">
        Standing settings
      </h3>
      <p className="mt-1 text-sm text-ink-soft">
        These stay in force between meetings. Leaving one alone is a decision to
        keep it where it is, not an absence of one.
        {balanceSheet !== null && explainsBalanceSheet && (
          <>
            {' '}
            The balance sheet currently holds{' '}
            <span className="font-medium tabular-nums text-ink">
              {balanceSheet.toFixed(1)} % of GDP
            </span>{' '}
            in assets; purchases add to that at an annual pace and runoff subtracts
            from it.
          </>
        )}
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
