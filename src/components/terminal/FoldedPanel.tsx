import { useCallback, useEffect, useState } from 'react'

/**
 * A panel folded away, with its state on the lid.
 *
 * > "TOUT LE RESTE SE REPLIE derrière un en-tête qu'on ouvre d'un geste […]
 * > RÈGLE IMPORTANTE : UN PANNEAU REPLIÉ AFFICHE SON ÉTAT EN UN MOT, sinon
 * > c'est une boîte mystère et personne ne l'ouvre. « CHOCS EN COURS — 2 »,
 * > « CE QUI POUSSE L'INFLATION — surtout l'énergie », « LE LIVRE — 60 pb de
 * > surprise ». Je dois savoir s'il vaut la peine d'ouvrir sans ouvrir."
 *
 * That rule is the whole component and it is the half that is easy to skip.
 * Folding alone produces a screen of identical closed lids, which is not less
 * information — it is the same information with a click in front of each piece,
 * and the rational response is to open all of them every meeting. **The
 * summary is what makes the fold a saving rather than a tax.** So `state` is
 * required, not optional, and a panel with nothing to say for itself should not
 * be rendered at all.
 *
 * ## What it is built on, and why not a `<details>`
 *
 * It *is* a `<details>`, for the reasons the aim disclosure gives: the keyboard
 * and the browser's own find-in-page reach the content, and the contrast audit
 * opens every disclosure on every state before measuring, so folding prose
 * behind one does not hide it from the check — which is journal 5's defect
 * exactly, arriving as a consequence of a legibility change.
 *
 * ## The memory
 *
 * > "Et le jeu se souvient de ce que j'ai ouvert."
 *
 * Per browser, in `localStorage`, keyed by panel. Not per mandate and not in
 * the save: which panels a player likes open is a fact about the *player*, and
 * carrying it in the decision log would make it part of the run — a replay
 * would then reproduce somebody else's reading habits, and the log is supposed
 * to be the decisions and nothing else.
 *
 * Reads are wrapped, because a private window throws rather than returning
 * null and a meeting screen that cannot render in private browsing would be a
 * strange way to lose a player.
 */

const STORE = 'mandate.folded.v1'

function readOpenSet(): ReadonlySet<string> {
  try {
    const raw = window.localStorage.getItem(STORE)
    if (raw === null) return new Set()
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? new Set(parsed.filter((id) => typeof id === 'string')) : new Set()
  } catch {
    return new Set()
  }
}

function writeOpenSet(ids: ReadonlySet<string>): void {
  try {
    window.localStorage.setItem(STORE, JSON.stringify([...ids]))
  } catch {
    // Private browsing, or storage disabled. The fold still works for this
    // session; it simply will not be remembered, which is the right failure.
  }
}

export function FoldedPanel({
  id,
  title,
  state,
  children,
  defaultOpen = false,
}: {
  /** Stable key for the memory. Never a label — a rename must not forget. */
  readonly id: string
  readonly title: string
  /**
   * The state, in a word or two. **Required.**
   *
   * What the player has to be able to read without opening: how many, which
   * one, how much. "2", "mostly energy", "60 bp of surprise". Never a
   * sentence, and never "see inside".
   */
  readonly state: string
  readonly children: React.ReactNode
  /** For a panel that should start open the first time it is ever seen. */
  readonly defaultOpen?: boolean
}) {
  /*
   * **An untouched panel derives its state; a touched one holds it.**
   *
   * Held in `useState` at first, and that was wrong in a way only a walk
   * found. `MeetingScreen` is described as remounted at every meeting, but
   * React *reconciles* it — same component, same position, so `useState` does
   * not re-initialise. The dispatches panel defaults open while it carries a
   * guided lesson, and once the lesson retired the panel stayed open for the
   * rest of the mandate on three-meeting-old state. Printing every panel's
   * open flag at every meeting is what showed it; a single screenshot had
   * looked fine.
   *
   * So the default is read on every render and only a deliberate toggle is
   * remembered. `stored` is read once per render rather than cached, which is
   * a `localStorage` hit per panel per meeting — cheap, and cheaper than a
   * second source of truth.
   */
  const [userOpen, setUserOpen] = useState<boolean | null>(null)
  const stored = readOpenSet()
  const open =
    userOpen ?? (stored.has(id) || (defaultOpen && !stored.has(`!${id}`)))

  /*
   * **Only a toggle the player performed is remembered.**
   *
   * This wrote on every change of `open`, including the one `defaultOpen`
   * produces — and that is a real conflict rather than a tidiness point. The
   * dispatches panel defaults open while it is carrying a guided lesson; with
   * an unconditional write, those first meetings stored it as a preference and
   * it then stayed open for the whole mandate. Measured, the default screen
   * went from twelve figures back to thirteen, and the cause was the memory
   * faithfully recording something the player never asked for.
   *
   * So the write is gated on `touched`. A panel the player has never touched
   * follows its default; the moment they open or close one, that is theirs and
   * it is kept.
   */
  useEffect(() => {
    if (userOpen === null) return
    const next = new Set(readOpenSet())
    if (userOpen) {
      next.add(id)
      next.delete(`!${id}`)
    } else {
      next.delete(id)
      // A closed panel that defaults open has to remember being closed, or it
      // reopens at the next meeting and the memory looks broken in the one
      // direction a player would notice.
      next.add(`!${id}`)
    }
    writeOpenSet(next)
  }, [id, userOpen])

  /*
   * **`toggle` fires on programmatic changes too, and that is the whole trap.**
   *
   * `<details open={open}>` has React set the property; the browser then
   * dispatches `toggle` exactly as it would for a click. So the first render
   * of a panel whose default is open fired this handler, which recorded it as
   * the player's preference and wrote it to storage — and the panel then
   * stayed open for the rest of the mandate, and for every later mandate in
   * that browser, having never been touched.
   *
   * Found by printing `localStorage` beside every panel's open flag at every
   * meeting: `store=["dispatches"]` on a walk that never clicked a lid. Three
   * attempts at this component and all three were the same mistake in
   * different clothes — treating something the code did as something the
   * player did.
   *
   * An echo of our own render carries the value we are already rendering, so
   * it is ignored. A real click always differs from it.
   */
  const onToggle = useCallback(
    (event: React.SyntheticEvent<HTMLDetailsElement>) => {
      const next = event.currentTarget.open
      if (next === open) return
      setUserOpen(next)
    },
    [open],
  )

  return (
    <details
      data-folded={id}
      open={open}
      onToggle={onToggle}
      className="border-b border-edge bg-raised last:border-b-0"
    >
      <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3 px-2 py-1.5 hover:bg-inset">
        <span className="font-mono text-2xs uppercase tracking-[0.16em] text-ink-faint">
          {title}
        </span>
        {/*
            The state, and it is deliberately the brighter of the two. The
            title says which box this is; the state says whether it is worth
            opening, and that is the question being answered.
        */}
        <span className="truncate font-mono text-2xs tracking-[0.04em] text-ink-soft">
          {state}
        </span>
      </summary>
      <div className="border-t border-edge px-2 py-2">{children}</div>
    </details>
  )
}
