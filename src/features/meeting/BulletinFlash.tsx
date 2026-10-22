import { useEffect, useRef } from 'react'
import type { Bulletin } from '../../simulation/index.ts'

/**
 * The bulletin, taking the screen.
 *
 * > "Une alerte qui prend la main, dans le langage du terminal : un bulletin
 * > d'agence, bandeau rouge ou ambre. […] Elle se referme d'un geste."
 *
 * A wire flash over a dealing screen: a rule of the chassis, a band in the
 * severity's colour, the headline in the terminal's own mono, the three
 * readings as a before-and-after, and one line of what it means. No
 * illustration, no icon, no animation beyond the band arriving — a terminal
 * does not draw pictures, and the one thing this must not look like is a
 * notification.
 *
 * ## Modal, and the three things that costs
 *
 * It genuinely takes the screen, because *"je veux qu'elle me coupe la
 * parole"* and a banner that can be scrolled past is a banner that is scrolled
 * past. Three obligations come with that and all three are met here rather
 * than left to a library:
 *
 *  - **It closes on one gesture** — the button, Escape, or a click on the
 *    scrim. Three ways, because a modal with one exit is a trap, and the
 *    player asked for one gesture rather than one route.
 *  - **Focus moves into it and is returned.** A dialog that does not take
 *    focus is invisible to a keyboard and to a screen reader, and this project
 *    has already shipped exactly that defect once: journal 7, *"a dialog that
 *    never took focus"*.
 *  - **The scrim is `--scrim-wash`, not `--scrim`.** Written as `bg-scrim`
 *    first, and the capture showed the whole screen flat near-black with the
 *    meeting gone — which is journal 21's blocking bug exactly: four opaque
 *    near-black panes over a near-black chassis read as a crash, not as
 *    dimming. `tokens.css` has carried a translucent `--scrim-wash` since,
 *    with that incident written out beside it, and I reached past it for the
 *    opaque one anyway. The meeting now stays visible underneath, which is
 *    also the honest thing: the bulletin is *about* the numbers behind it.
 */
export function BulletinFlash({
  bulletin,
  onDismiss,
}: {
  readonly bulletin: Bulletin
  readonly onDismiss: () => void
}) {
  const dismissRef = useRef<HTMLButtonElement>(null)
  const urgent = bulletin.severity === 'urgent'

  useEffect(() => {
    // Journal 7: a dialog that never took focus. The button rather than the
    // container, so the one gesture that closes it is already under the hand.
    const previous = document.activeElement
    dismissRef.current?.focus()

    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onDismiss()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (previous instanceof HTMLElement) previous.focus()
    }
  }, [onDismiss])

  return (
    <div
      data-bulletin={bulletin.kind}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-scrim-wash p-4 pt-[10vh]"
      onClick={(event) => {
        if (event.target === event.currentTarget) onDismiss()
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="bulletin-headline"
        aria-describedby="bulletin-meaning"
        className="w-full max-w-xl border border-edge-strong bg-page shadow-panel"
      >
        {/* The band. The one piece of colour, and the only thing that has to
            be read before the words. */}
        <div
          className={`flex items-baseline justify-between gap-3 px-3 py-1.5 font-mono text-2xs uppercase tracking-[0.18em] ${
            urgent ? 'bg-bad text-on-bad' : 'bg-accent text-on-accent'
          }`}
        >
          <span className="font-semibold">{bulletin.label}</span>
          <span>{urgent ? 'Urgent' : 'Priority'}</span>
        </div>

        <div className="px-4 py-3">
          <h2
            id="bulletin-headline"
            className="font-mono text-base font-semibold uppercase tracking-[0.06em] text-ink"
          >
            {bulletin.headline}
          </h2>

          {bulletin.readings.length > 0 && (
            <dl className="mt-3 grid grid-cols-3 gap-x-3 gap-y-1 border-y border-edge py-2">
              {bulletin.readings.map((reading) => (
                <div key={reading.label}>
                  <dt className="font-mono text-2xs uppercase tracking-[0.12em] text-ink-faint">
                    {reading.label}
                  </dt>
                  <dd className="font-mono text-sm tabular-nums">
                    <span className="text-ink-faint">{reading.before}</span>
                    <span aria-hidden="true" className="mx-1 text-ink-faint">
                      →
                    </span>
                    <span className={reading.worse ? 'text-bad-strong' : 'text-good-strong'}>
                      {reading.after}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          )}

          <p id="bulletin-meaning" className="mt-3 text-sm leading-relaxed text-ink-soft">
            {bulletin.meaning}
          </p>
        </div>

        <div className="border-t border-edge">
          <button
            ref={dismissRef}
            type="button"
            data-bulletin-dismiss=""
            onClick={onDismiss}
            className="w-full bg-raised px-3 py-2.5 font-mono text-2xs uppercase tracking-[0.18em] text-ink-soft hover:bg-inset hover:text-ink"
          >
            Acknowledged
          </button>
        </div>
      </div>
    </div>
  )
}
