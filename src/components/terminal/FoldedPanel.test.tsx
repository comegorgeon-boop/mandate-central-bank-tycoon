import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { FoldedPanel } from './FoldedPanel.tsx'

/**
 * **The two rules that make a fold a saving rather than a tax.**
 *
 * > "UN PANNEAU REPLIÉ AFFICHE SON ÉTAT EN UN MOT, sinon c'est une boîte
 * > mystère et personne ne l'ouvre. […] Et le jeu se souvient de ce que j'ai
 * > ouvert."
 *
 * Folding on its own does not reduce anything: it is the same information with
 * a click in front of each piece, and the rational response is to open
 * everything every meeting. The state on the lid is what lets a player decide
 * *not* to open one, and the memory is what stops them re-deciding every
 * meeting. Both are the feature; neither is a nicety.
 *
 * The third test is the one that earned its place. Three attempts at this
 * component were all the same mistake in different clothes — treating
 * something the *code* did as something the *player* did — and the last of
 * them is subtle enough to come back: `<details open={…}>` fires `toggle` on
 * a programmatic change exactly as it does on a click, so React's own render
 * was being written to storage as a preference.
 */

function store(): readonly string[] {
  const raw = window.localStorage.getItem('mandate.folded.v1')
  return raw === null ? [] : (JSON.parse(raw) as string[])
}

describe('a folded panel', () => {
  it('shows its state on the lid without being opened', () => {
    cleanup()
    window.localStorage.clear()
    render(
      <FoldedPanel id="probe-state" title="Live shocks" state="2 running">
        <p>the detail</p>
      </FoldedPanel>,
    )
    // Both halves are readable while shut: which box this is, and whether it
    // is worth opening.
    expect(screen.getByText('Live shocks')).toBeInTheDocument()
    expect(screen.getByText('2 running')).toBeInTheDocument()
    expect(screen.getByRole('group')).not.toHaveAttribute('open')
  })

  it('remembers a panel the player opened', () => {
    cleanup()
    window.localStorage.clear()
    const { unmount } = render(
      <FoldedPanel id="probe-memory" title="The book" state="60 bp">
        <p>the detail</p>
      </FoldedPanel>,
    )
    /*
     * The browser's own sequence, not `fireEvent.click`. jsdom does not
     * implement the native `<details>` behaviour, so clicking the summary
     * changes nothing and the assertion below would fail for a reason that has
     * nothing to do with this component — which it did on the first run. What
     * a real browser does is set `open` and dispatch `toggle`, and the live
     * path is verified separately by driving an actual meeting.
     */
    const panel = screen.getByRole('group') as HTMLDetailsElement
    panel.open = true
    fireEvent(panel, new Event('toggle', { bubbles: false }))
    expect(store()).toContain('probe-memory')
    unmount()

    // A fresh mount — which is what a later meeting is — finds it open.
    render(
      <FoldedPanel id="probe-memory" title="The book" state="60 bp">
        <p>the detail</p>
      </FoldedPanel>,
    )
    expect(screen.getByRole('group')).toHaveAttribute('open')
  })

  it('does not record a default as something the player chose', () => {
    cleanup()
    window.localStorage.clear()
    /*
     * The trap, in one assertion. `<details open>` dispatches `toggle` when
     * React sets the property, so a panel that *starts* open fired the
     * handler and wrote itself to storage as a preference — and then stayed
     * open for every later mandate in that browser, having never been
     * touched. Measured on a walk: `store=["dispatches"]` after a run that
     * never clicked a lid.
     */
    render(
      <FoldedPanel id="probe-default" title="Dispatches" state="a lesson" defaultOpen>
        <p>the lesson</p>
      </FoldedPanel>,
    )
    expect(screen.getByRole('group')).toHaveAttribute('open')
    expect(
      store(),
      'a panel that opened because of its own default must not be remembered ' +
        'as a player preference — it will outlive the reason it was open',
    ).toEqual([])
  })

  it('follows a changed default while it is untouched', () => {
    cleanup()
    window.localStorage.clear()
    // The dispatches panel defaults open while it carries a guided lesson and
    // shut afterwards. React reconciles the meeting screen rather than
    // remounting it, so a panel holding its own state stayed open on
    // three-meeting-old information.
    const { rerender } = render(
      <FoldedPanel id="probe-follow" title="Dispatches" state="a lesson" defaultOpen>
        <p>x</p>
      </FoldedPanel>,
    )
    expect(screen.getByRole('group')).toHaveAttribute('open')

    rerender(
      <FoldedPanel id="probe-follow" title="Dispatches" state="1 item">
        <p>x</p>
      </FoldedPanel>,
    )
    expect(screen.getByRole('group')).not.toHaveAttribute('open')
  })
})
