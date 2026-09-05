import { prefersReducedMotion, useSettings, type VisualDirection } from './settings.ts'

/**
 * The settings, as a disclosure rather than a screen.
 *
 * A `<details>` element: keyboard-operable, screen-reader-announced and
 * closable with no state and no focus trap of our own. Two settings is not a
 * modal's worth of preferences, and burying them behind one would mean a
 * player mid-mandate who wants the interval to stop playing has to leave the
 * meeting to say so.
 */

const DIRECTIONS: readonly {
  readonly id: VisualDirection
  readonly name: string
  readonly detail: string
}[] = [
  {
    id: 'papers-on-the-table',
    name: 'Papers on the table',
    detail:
      'A dark walnut room with the briefing documents laid out on it in cream ' +
      'and ink. The strongest separation between the room and the reading.',
  },
  {
    id: 'after-hours',
    name: 'The room after hours',
    detail:
      'The same room with no papers out: walnut throughout, warm off-white ' +
      'text, brass carrying the emphasis. Quieter, and more of a piece.',
  },
]

export function SettingsPanel({ className = '' }: { readonly className?: string }) {
  const { settings, update } = useSettings()
  const reducedMotion = prefersReducedMotion()

  return (
    <details className={`rounded-lg border border-edge-room bg-room ${className}`}>
      <summary className="cursor-pointer list-none px-3 py-2 text-xs uppercase tracking-[0.14em] text-onwood-soft hover:text-onwood">
        Settings
      </summary>

      <div className="border-t border-edge-room px-3 py-3">
        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-wide text-onwood-soft">
            How the room is dressed
          </legend>
          <div className="mt-2 flex flex-col gap-2">
            {DIRECTIONS.map((option) => {
              const selected = option.id === settings.direction
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => update({ direction: option.id })}
                  className={`rounded-md border p-2 text-left ${
                    selected
                      ? 'border-edge-accent bg-inset'
                      : 'border-edge-room hover:bg-inset'
                  }`}
                >
                  <span
                    className={`text-sm font-medium ${
                      selected ? 'text-accent-onwood' : 'text-onwood'
                    }`}
                  >
                    {option.name}
                  </span>
                  <span className="mt-0.5 block text-xs text-onwood-soft">
                    {option.detail}
                  </span>
                </button>
              )
            })}
          </div>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="text-xs font-semibold uppercase tracking-wide text-onwood-soft">
            Between meetings
          </legend>
          <label className="mt-2 flex items-start gap-2 text-sm text-onwood">
            <input
              type="checkbox"
              checked={settings.playTheInterval}
              onChange={(event) => update({ playTheInterval: event.target.checked })}
              className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
            />
            <span>
              Play the interval
              <span className="mt-0.5 block text-xs text-onwood-soft">
                Watch the quarter pass — the curves extend, markets move, the
                dispatches arrive when they happen. Skippable with a click or any
                key while it runs.
              </span>
            </span>
          </label>
          {reducedMotion && (
            <p className="mt-2 text-xs text-accent-onwood">
              Your system asks for reduced motion, so the interval will not play
              whatever this is set to. It arrives already over, with everything
              that happened still listed.
            </p>
          )}
        </fieldset>
      </div>
    </details>
  )
}
