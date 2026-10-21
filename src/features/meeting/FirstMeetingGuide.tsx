import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

/**
 * What a meeting is, said once, to a player who has never been in one.
 *
 * ## Why this is not a page of instructions
 *
 * Because the easy mandate already *is* the tutorial — it has a goal panel, a
 * narrowed toolkit and an adviser who explains himself — and the one thing it
 * could not do was tell a player what they were looking at before they looked
 * at it. A page of text in front of the first meeting would have answered that
 * by making the first thing in the game a document, which is the single most
 * persistent complaint this project has had about itself.
 *
 * So it is a spotlight. Four steps, each one sentence, each pointing at the
 * real control it names — the screen explaining itself rather than a document
 * about the screen. The movement between steps is the whole point: it is the
 * thing that says *this one, here*, and it is the only reason an animation is
 * justified here at all.
 *
 * ## It appears exactly once
 *
 * On the first meeting of the first mandate ever played in this browser, and
 * never again — including after a reload, which is why the flag is written the
 * moment it opens rather than when it is dismissed. A player who refreshes
 * mid-explanation has already seen it.
 *
 * Escape skips it. So does the skip button, which is present from the first
 * step rather than appearing at the end: an explanation you cannot leave is
 * not an explanation, it is a toll.
 */

export interface GuideStep {
  /** `data-guide` value of the element this step points at. */
  readonly anchor: string
  /** One sentence. Twelve words is the budget; most are shorter. */
  readonly line: string
  /** Which tab must be open for the anchor to exist. */
  readonly panel?: string
}

export const GUIDE_STEPS: readonly GuideStep[] = [
  {
    anchor: 'charts',
    line: 'This is the economy you inherited. Everything else explains it.',
  },
  {
    anchor: 'tabs',
    line: 'Your staff brief you here. Read what you need; none of it is hidden.',
  },
  {
    anchor: 'rate',
    line: 'This is the decision. Moving the rate and holding it are both choices.',
    panel: 'desk',
  },
  {
    anchor: 'review',
    line: 'Nothing is final until you confirm. Then the quarter plays out.',
    panel: 'desk',
  },
]

interface Box {
  readonly top: number
  readonly left: number
  readonly width: number
  readonly height: number
}

/**
 * Whether this element has finished arriving.
 *
 * Panels in this interface enter with `animate-rise`, which starts at opacity
 * zero, and a spotlight drawn on the first painted frame rings an empty
 * rectangle — which is what the first version of this did, and what the
 * capture of it showed: a ring around nothing, under a sentence saying "this
 * is the economy you inherited".
 *
 * The child is checked as well as the element, because the anchors here are
 * wrappers and the animation is on the panel inside them.
 */
function painted(element: Element): boolean {
  const opacity = (node: Element) => {
    // An unresolved value means "nothing has said otherwise", which is opaque.
    // Browsers always resolve this; environments that do not return an empty
    // string — and `Number('')` is 0, not NaN, so a numeric guard alone reads
    // every element as fully transparent and the guide waits forever for a
    // screen that had already arrived. Check the string.
    const raw = getComputedStyle(node).opacity
    if (raw === '') return 1
    const value = Number(raw)
    return Number.isFinite(value) ? value : 1
  }
  if (opacity(element) < 0.99) return false
  const child = element.firstElementChild
  return child === null || opacity(child) > 0.99
}

function boxFor(anchor: string): Box | null {
  const element = document.querySelector(`[data-guide="${anchor}"]`)
  if (element === null) return null
  const rect = element.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return null
  const pad = 8
  return {
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  }
}

export function FirstMeetingGuide({
  onPanel,
  onDone,
}: {
  /** Open a tab, so a step can point at something inside one. */
  readonly onPanel: (panel: string) => void
  readonly onDone: () => void
}) {
  const [index, setIndex] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const step = GUIDE_STEPS[index]

  // Open the tab this step lives in *before* measuring, or the anchor is not
  // mounted yet and the spotlight lands on nothing.
  useEffect(() => {
    if (step.panel !== undefined) onPanel(step.panel)
  }, [step, onPanel])

  // Measured after layout rather than in an effect, because a spotlight drawn
  // one frame late is a spotlight drawn around where the control used to be.
  useLayoutEffect(() => {
    let frame = 0
    let tries = 0
    const measure = () => {
      const element = document.querySelector(`[data-guide="${step.anchor}"]`)
      if (element === null || !painted(element)) {
        // Not mounted yet — a tab that was just asked to open — or mounted and
        // still rising. Look again next frame rather than ringing a rectangle
        // that has nothing in it.
        if (tries++ < 120) {
          frame = requestAnimationFrame(measure)
          return
        }
        // Two seconds and it is not there, which is a real state rather than a
        // failure: a **quick** meeting has no tab strip and no review button,
        // so two of these four steps have nothing to point at. Skip to the
        // next one. The first version stalled here instead, leaving a scrim
        // over a screen whose Next button pointed at nothing — which is how a
        // tutorial becomes a trap.
        setIndex((current) =>
          current + 1 < GUIDE_STEPS.length ? current + 1 : current,
        )
        if (index + 1 >= GUIDE_STEPS.length) onDone()
        return
      }
      // Scrolled into view before it is measured, and this is not a nicety.
      // The confirm button sits below the fold on every viewport this game
      // supports, so the first version of this pointed a spotlight and a
      // caption at a position off the bottom of the screen: a step that
      // explained the most important control in the game by highlighting
      // nothing the player could see.
      // Guarded: this is a browser affordance, not a requirement. Where it is
      // missing the spotlight still lands on the anchor — it simply lands on
      // wherever the anchor already was.
      element.scrollIntoView?.({ block: 'center', behavior: 'instant' })
      const found = boxFor(step.anchor)
      if (found !== null) setBox(found)
    }
    measure()
    return () => cancelAnimationFrame(frame)
  }, [step, index, onDone])

  // Keep the spotlight on the control when the page moves under it.
  useEffect(() => {
    const update = () => setBox(boxFor(step.anchor))
    globalThis.addEventListener('resize', update)
    globalThis.addEventListener('scroll', update, true)
    return () => {
      globalThis.removeEventListener('resize', update)
      globalThis.removeEventListener('scroll', update, true)
    }
  }, [step])

  const advance = useCallback(() => {
    if (index + 1 >= GUIDE_STEPS.length) onDone()
    else setIndex(index + 1)
  }, [index, onDone])

  // `drawn` rather than `box` in the dependencies, and it has to be both of
  // those things. Without it the effect runs once on mount — while the box is
  // still being measured and the component is rendering nothing — so the focus
  // call lands on a button that does not exist yet and a keyboard player opens
  // the guide with the caret still behind it. With `box` itself, every scroll
  // re-measures and the focus is stolen back on each one.
  const drawn = box !== null
  useEffect(() => {
    if (drawn) nextRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDone()
    }
    globalThis.addEventListener('keydown', onKey)
    return () => globalThis.removeEventListener('keydown', onKey)
  }, [index, onDone, drawn])

  if (box === null) return null

  // Below the spotlight if there is room, above it otherwise, and then clamped
  // into the viewport regardless. The caption is the one thing here that must
  // never be off screen: a spotlight nobody can read is a dimmed room.
  const CAPTION = 140
  const viewport = globalThis.innerHeight
  const below = box.top + box.height + CAPTION < viewport
  const captionTop = Math.min(
    Math.max(12, below ? box.top + box.height + 12 : box.top - CAPTION + 8),
    Math.max(12, viewport - CAPTION - 12),
  )

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="How a meeting works"
      data-guide-overlay=""
      className="fixed inset-0 z-50"
    >
      {/*
        The dimmed ground, drawn as four panes around the spotlight rather
        than as one box with a hole in it: a `box-shadow` cutout would tint
        the control it is meant to be showing, and this interface has already
        shipped one invisible panel for exactly that kind of shortcut.

        **Washed, not filled.** These were `bg-scrim`, which is opaque — and
        an opaque near-black pane over a near-black chassis does not read as
        dimmed, it reads as gone. On a phone, where the spotlighted control is
        a forty-pixel strip, that painted eight hundred pixels of flat black
        and the guide looked like a crash. See `--scrim-wash` in tokens.css.
      */}
      <div aria-hidden="true" className="absolute inset-0">
        <div
          className="absolute left-0 right-0 top-0 bg-scrim-wash transition-all duration-200"
          style={{ height: Math.max(0, box.top) }}
        />
        <div
          className="absolute left-0 right-0 bottom-0 bg-scrim-wash transition-all duration-200"
          style={{ top: box.top + box.height }}
        />
        <div
          className="absolute left-0 bg-scrim-wash transition-all duration-200"
          style={{ top: box.top, height: box.height, width: Math.max(0, box.left) }}
        />
        <div
          className="absolute right-0 bg-scrim-wash transition-all duration-200"
          style={{ top: box.top, height: box.height, left: box.left + box.width }}
        />
        {/* The ring itself. This is the sentence's subject. */}
        <div
          className="absolute rounded-lg border-2 border-edge-accent transition-all duration-200"
          style={{
            top: box.top,
            left: box.left,
            width: box.width,
            height: box.height,
          }}
        />
      </div>

      <div
        className="absolute left-1/2 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-edge bg-panel p-4 text-ink shadow-panel transition-all duration-200"
        style={{ top: captionTop }}
      >
        <p className="text-2xs uppercase tracking-[0.14em] text-ink-faint">
          {index + 1} of {GUIDE_STEPS.length}
        </p>
        <p className="mt-1 text-sm text-ink">{step.line}</p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onDone}
            data-guide-skip=""
            className="text-xs text-ink-faint underline hover:text-ink"
          >
            Skip
          </button>
          <button
            ref={nextRef}
            type="button"
            onClick={advance}
            data-guide-next=""
            className="rounded-md border border-edge-accent bg-accent-surface px-3 py-1.5 text-sm font-semibold text-on-accent-surface"
          >
            {index + 1 === GUIDE_STEPS.length ? 'Begin' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
