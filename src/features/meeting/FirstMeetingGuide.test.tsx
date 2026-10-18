// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { FirstMeetingGuide, GUIDE_STEPS } from './FirstMeetingGuide.tsx'
import { clearGuideSeen, hasSeenGuide, markGuideSeen } from '../records/storage.ts'

/**
 * The explanation shown once, and the two things that would make it a bug.
 *
 * **It must point at something.** Every step names an element by a
 * `data-guide` attribute, and an attribute is exactly the kind of thing a
 * refactor removes without noticing — at which point the guide silently rings
 * nothing, or never appears, and no other test in this project would fail. So
 * the steps are checked against the attributes the game actually renders, in
 * `MeetingScreen.test` territory, and here against a stand-in that proves the
 * mechanism.
 *
 * **It must be leaveable, and it must not come back.** An explanation a player
 * cannot escape is a toll, and one that reappears after a reload is a bug they
 * cannot describe in words that sound like one.
 */

function harness(onDone = () => {}) {
  // Stand-ins for the real anchors, with the geometry jsdom will not produce
  // on its own: every rect is zero there, and the component refuses to draw
  // around a zero-sized box — correctly, since that is what an unmounted
  // anchor looks like.
  for (const step of GUIDE_STEPS) {
    const node = document.createElement('div')
    node.setAttribute('data-guide', step.anchor)
    node.getBoundingClientRect = () =>
      ({ top: 100, left: 50, width: 400, height: 80 }) as DOMRect
    node.scrollIntoView = () => {}
    document.body.append(node)
  }
  return render(<FirstMeetingGuide onPanel={() => {}} onDone={onDone} />)
}

describe('the first-meeting explanation', () => {
  beforeEach(() => {
    clearGuideSeen()
    document.body.replaceChildren()
  })

  it('opens on the first step and counts them honestly', async () => {
    harness()
    expect(await screen.findByText(`1 of ${GUIDE_STEPS.length}`)).toBeTruthy()
    expect(screen.getByText(GUIDE_STEPS[0].line)).toBeTruthy()
  })

  it('walks every step and finishes', async () => {
    const onDone = vi.fn()
    harness(onDone)

    for (let step = 0; step < GUIDE_STEPS.length; step += 1) {
      await waitFor(() => expect(screen.getByText(GUIDE_STEPS[step].line)).toBeTruthy())
      const last = step + 1 === GUIDE_STEPS.length
      // The last button says "Begin", not "Next": it is the one that puts the
      // player in the meeting rather than moving them along a list.
      fireEvent.click(screen.getByRole('button', { name: last ? 'Begin' : 'Next' }))
    }
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('can be left at the first step', async () => {
    const onDone = vi.fn()
    harness(onDone)
    await waitFor(() => expect(screen.getByText(GUIDE_STEPS[0].line)).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('can be left with the keyboard', async () => {
    const onDone = vi.fn()
    harness(onDone)
    await waitFor(() => expect(screen.getByText(GUIDE_STEPS[0].line)).toBeTruthy())
    fireEvent.keyDown(globalThis.document, { key: 'Escape' })
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('is a dialog, and takes the focus', async () => {
    harness()
    const dialog = await screen.findByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    await waitFor(() =>
      expect(document.activeElement?.getAttribute('data-guide-next')).toBe(''),
    )
  })

  it('keeps every step to one short sentence', () => {
    // The guardrail the whole feature exists under: less text on screen, never
    // more. Twelve words was the budget; this is the thing that keeps a later
    // edit from quietly turning it into a paragraph.
    for (const step of GUIDE_STEPS) {
      const words = step.line.split(/\s+/).length
      expect(words, `"${step.line}" is ${words} words`).toBeLessThanOrEqual(14)
    }
  })
})

describe('every step points at something the game renders', () => {
  it('names an anchor that exists in the source', async () => {
    // The whole feature hangs on four `data-guide` attributes in three other
    // files, and an attribute is exactly what a refactor deletes without
    // noticing. Nothing else in this suite would fail if one went: the guide
    // would simply never draw, in a build whose tests were all green — which
    // is this project's own documented failure mode.
    // Read through Vite's `?raw` rather than `node:fs`, so the test depends on
    // the same module graph the app is built from and needs no node types.
    const all = [
      (await import('./MeetingScreen.tsx?raw')).default,
      (await import('../policy/PolicyDeskPanel.tsx?raw')).default,
      (await import('../policy/RateSlider.tsx?raw')).default,
    ].join('\n')
    for (const step of GUIDE_STEPS) {
      expect(
        all.includes(`data-guide="${step.anchor}"`),
        `no element carries data-guide="${step.anchor}"`,
      ).toBe(true)
    }
  })
})

describe('shown once per browser', () => {
  beforeEach(() => {
    clearGuideSeen()
  })

  it('starts unseen and stays seen', () => {
    expect(hasSeenGuide()).toBe(false)
    markGuideSeen()
    expect(hasSeenGuide()).toBe(true)
  })

  it('survives a storage that refuses to answer', () => {
    const original = globalThis.localStorage.getItem
    try {
      globalThis.localStorage.getItem = () => {
        throw new Error('blocked')
      }
      // A browser that will not tell us is treated as one that has not seen
      // it. Showing a four-step explanation once too often is a far smaller
      // failure than never showing it at all.
      expect(hasSeenGuide()).toBe(false)
    } finally {
      globalThis.localStorage.getItem = original
    }
  })
})
