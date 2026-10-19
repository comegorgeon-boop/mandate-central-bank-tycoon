import { prefersReducedMotion, useSettings, type VisualDirection } from './settings.ts'
import { play, setSoundEnabled } from './sound.ts'

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
    id: 'after-hours',
    name: 'The room after hours',
    detail:
      'Walnut throughout, warm off-white text, brass carrying the emphasis. ' +
      'One material, so the eye adjusts once rather than on every panel.',
  },
  {
    id: 'papers-on-the-table',
    name: 'Papers on the table',
    detail:
      'The briefing documents laid out in cream and ink on the dark room. ' +
      'More striking, and a harder read over a whole mandate.',
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
                dispatches arrive when they happen. It stops at the end and waits
                for you; Enter, Space, Escape or a click gets past it sooner.
              </span>
            </span>
          </label>
          <label className="mt-3 flex items-start gap-2 text-sm text-onwood">
            <input
              type="checkbox"
              data-sound=""
              checked={settings.sound}
              onChange={(event) => {
                update({ sound: event.target.checked })
                setSoundEnabled(event.target.checked)
                // The first cue is the confirmation that it worked, and it
                // doubles as the gesture browsers require before an audio
                // context may start.
                if (event.target.checked) play('stake')
              }}
              className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
            />
            <span>
              Sound
              <span className="mt-0.5 block text-xs text-onwood-soft">
                Three short cues and no more: the dial's detent, a stake pushed
                onto the table, a wager turning over. Synthesised in the
                browser — nothing is downloaded, and with this off no audio is
                created at all.
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
