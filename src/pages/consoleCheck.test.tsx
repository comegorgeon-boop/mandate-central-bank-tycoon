import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import {
  MEETING_COUNT,
  availableInstruments,
  type Difficulty,
} from '../simulation/index.ts'

/**
 * Open the full room if this meeting is a quick one.
 *
 * Most meetings now render a five-second surface — one sentence, the dial,
 * done — and the apparatus these tests drive is one gesture behind it. A
 * player reaches the tabs by pressing "Open the room"; so does a test. See
 * `simulation/meeting/tempo.ts`.
 */
function openRoom(): void {
  const open = document.querySelector('[data-open-room]')
  if (open !== null) fireEvent.click(open)
}



/**
 * A whole mandate at each difficulty, driven through the real screens.
 *
 * This is the only test that touches every panel a player actually sees, so it
 * is where a component that renders at easy and throws at hard gets caught. It
 * covers all three modes rather than easy alone, because the modes no longer
 * differ only in constants: medium and hard render panels — the balance sheet
 * and facilities, the divided committee, the free-tone selector — that easy
 * never mounts at all.
 */

const DIFFICULTY_LABEL: Readonly<Record<Difficulty, RegExp>> = {
  easy: /^Easy — /,
  medium: /^Medium — /,
  hard: /^Hard — /,
}

function playWholeMandate(difficulty: Difficulty): void {
  fireEvent.click(document.querySelector('[data-start]') as HTMLElement)
  fireEvent.click(screen.getByRole('button', { name: DIFFICULTY_LABEL[difficulty] }))
  fireEvent.change(screen.getByLabelText('Scenario seed', { selector: 'input' }), {
    target: { value: 'CONSOLE' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Start the mandate' }))
  fireEvent.click(screen.getByRole('button', { name: 'Enter the first meeting' }))

  for (let meeting = 1; meeting <= MEETING_COUNT[difficulty]; meeting += 1) {
    // The interval between meetings plays first; skip it, exactly as a
    // player in a hurry would.
    const skipInterval = screen.queryByRole('button', { name: 'Skip to the meeting' })
    if (skipInterval !== null) fireEvent.click(skipInterval)

    // A mandate can end early — dismissal, a banking crisis, an inflation
    // spiral — and then the meeting screen is gone and the result screen is up.
    // That is a real outcome and the common one at hard, not a failure of this
    // test, so the guard has to come before anything reaches for a tab.
    if (screen.queryByRole('tab', { name: 'Meeting Brief' }) === null) break

    for (const tab of ['Meeting Brief', 'Prices', 'Labor', 'Policy Desk']) {
      openRoom()
      fireEvent.click(screen.getByRole('tab', { name: tab }))
    }

    const review = screen.queryByRole('button', { name: 'Review policy package' })
    if (review === null) break
    fireEvent.click(review)
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and advance' }))

    // Every meeting after the first opens on the same-day reaction screen.
    const onward = screen.queryByRole('button', {
      name: 'Continue to the next meeting',
    })
    if (onward !== null) fireEvent.click(onward)
  }
}

describe('console hygiene', () => {
  for (const difficulty of ['easy', 'medium', 'hard'] as const) {
    it(`plays a whole ${difficulty} mandate without logging a warning or an error`, () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      render(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>,
      )

      playWholeMandate(difficulty)

      expect(error.mock.calls).toEqual([])
      expect(warn.mock.calls).toEqual([])

      error.mockRestore()
      warn.mockRestore()
    })
  }
})

describe('both institutions are reachable', () => {
  // The ECB has been fully built, balanced and measured in every sweep since
  // the engine existed, and the setup screen offered only the Fed — half the
  // content unplayable for no reason.
  // Asserted on the *rate instrument's* own institution-specific label, which
  // only `config/instruments.ts` can produce, so this proves the choice reached
  // the engine rather than that a button was pressed.
  for (const [label, rateLabel] of [
    ['Federal Reserve', /Federal funds target range/],
    ['European Central Bank', /Main refinancing rate/],
  ] as const) {
    it(`starts a mandate at the ${label}`, () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>,
      )
      fireEvent.click(document.querySelector('[data-start]') as HTMLElement)
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${label}`) }))
      fireEvent.change(screen.getByLabelText('Scenario seed', { selector: 'input' }), {
        target: { value: 'BOTH' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Start the mandate' }))
      fireEvent.click(screen.getByRole('button', { name: 'Enter the first meeting' }))
      openRoom()
      fireEvent.click(screen.getByRole('tab', { name: 'Policy Desk' }))

      expect(screen.getAllByText(rateLabel).length).toBeGreaterThan(0)
    })
  }
})

describe('the toolkit each difficulty actually reaches', () => {
  /**
   * Opens the desk, optionally a few meetings in.
   *
   * The staff cannot advise at meeting one above easy: core inflation carries a
   * publication lag and easy is the only difficulty that relieves it, so the
   * rule correctly returns nothing rather than guessing. Reaching for a later
   * meeting is the honest way to see the adviser, not a workaround.
   */
  function openTheDesk(difficulty: Difficulty, advance = 0): void {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )
    fireEvent.click(document.querySelector('[data-start]') as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: DIFFICULTY_LABEL[difficulty] }))
    fireEvent.change(screen.getByLabelText('Scenario seed', { selector: 'input' }), {
      target: { value: 'TOOLKIT' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Start the mandate' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enter the first meeting' }))

    // The interval plays first and the same-day reaction second; a player in a
    // hurry skips both, which is what this does before each meeting's desk.
    const reachTheDesk = (): void => {
      const skip = screen.queryByRole('button', { name: 'Skip to the meeting' })
      if (skip !== null) fireEvent.click(skip)
      const onward = screen.queryByRole('button', {
        name: 'Continue to the next meeting',
      })
      if (onward !== null) fireEvent.click(onward)
      openRoom()
      fireEvent.click(screen.getByRole('tab', { name: 'Policy Desk' }))
    }

    for (let meeting = 0; meeting < advance; meeting += 1) {
      reachTheDesk()
      fireEvent.click(screen.getByRole('button', { name: 'Review policy package' }))
      fireEvent.click(screen.getByRole('button', { name: 'Confirm and advance' }))
    }

    reachTheDesk()
  }

  /**
   * Opens one of the desk's benches.
   *
   * The desk shows the dial, the rate it lands on and one sentence; the case,
   * the words and the toolkit are each one click away and only one is open at
   * a time. Reaching for a facility without opening its bench is reaching for
   * something that is deliberately not on screen.
   */
  function openBench(label: 'The case' | 'The words' | 'The toolkit'): void {
    openRoom()
    fireEvent.click(screen.getByRole('tab', { name: label }))
  }

  it('gives easy the rate and the words, and nothing else', () => {
    openTheDesk('easy')
    // No toolkit bench at all: there is nothing behind it to reach.
    expect(screen.queryByRole('tab', { name: 'The toolkit' })).toBeNull()
    expect(screen.queryByRole('heading', { name: /committee is/ })).toBeNull()
    // The case bench opens by default, and carries the committee arguing —
    // at every difficulty. An argument about what to do with a reading is not
    // a reading, so the information ladder has no claim on it.
    expect(screen.getByRole('heading', { name: 'The committee' })).toBeTruthy()
    openBench('The words')
    expect(screen.queryByText('In what tone?')).toBeNull()
  })

  it('opens the balance sheet at medium, with the advice still on the table', () => {
    openTheDesk('medium', 2)
    expect(screen.getByRole('heading', { name: 'The committee' })).toBeTruthy()
    openBench('The toolkit')
    expect(screen.getByRole('heading', { name: 'Standing settings' })).toBeTruthy()
    expect(screen.getByText('Securities purchases')).toBeTruthy()
    expect(screen.getByText('Balance sheet runoff')).toBeTruthy()
    // The words still cannot depart from the deed here.
    openBench('The words')
    expect(screen.queryByText('In what tone?')).toBeNull()
  })

  it('opens the full toolkit and the free tone at hard, and withdraws the recommendation', () => {
    openTheDesk('hard', 2)
    // The smooth single recommendation is gone everywhere, replaced by the
    // schools arguing. What the ladder still withdraws at hard is the shock's
    // *name*, not the argument about what to do with it.
    expect(screen.queryByRole('heading', { name: /The services recommend/ })).toBeNull()
    expect(screen.getByRole('heading', { name: 'The committee' })).toBeTruthy()
    openBench('The toolkit')
    expect(screen.getByRole('heading', { name: 'Standing settings' })).toBeTruthy()
    expect(screen.getByText('Interest on reserve balances')).toBeTruthy()
    expect(screen.getByText('Liquidity swap lines')).toBeTruthy()
    openBench('The words')
    expect(screen.getByText('In what tone?')).toBeTruthy()
  })

  it('carries a facility the player moved into the confirmed package', () => {
    openTheDesk('medium')
    openBench('The toolkit')
    // Two steps up from a standing zero: the confirmation must say so, or the
    // player is confirming something they were never shown.
    fireEvent.click(screen.getByRole('button', { name: 'Raise Securities purchases' }))
    fireEvent.click(screen.getByRole('button', { name: 'Raise Securities purchases' }))
    fireEvent.click(screen.getByRole('button', { name: 'Review policy package' }))
    // Twice over: once in the package summary, and once in the projection of
    // what that instrument on its own is expected to do.
    expect(screen.getAllByText('0.0 % of GDP → 1.0 % of GDP')).toHaveLength(2)
  })

  it('quantifies what each moved instrument is expected to do on its own', () => {
    openTheDesk('medium')
    openBench('The toolkit')
    fireEvent.click(screen.getByRole('button', { name: 'Raise Securities purchases' }))
    fireEvent.click(screen.getByRole('button', { name: 'Review policy package' }))

    const panel = screen
      .getByRole('heading', { name: 'What each instrument is expected to do' })
      .closest('section')
    expect(panel).not.toBeNull()
    // Both halves of the mandate are always reported, even where the effect
    // rounds to nothing over the horizon: "this does not move unemployment
    // within a year" is a fact about the instrument the player needs.
    expect(within(panel!).getByText('Headline inflation')).toBeTruthy()
    expect(within(panel!).getByText('Unemployment rate')).toBeTruthy()
  })

  it('gives every reachable instrument a plain-language purpose', () => {
    // The complaint this answers, verbatim: a player raised a refinancing
    // programme by a point and had no idea what it had done. Purposes live in
    // `config/instruments.ts`, so this checks the screen actually renders one
    // for every instrument the difficulty opens rather than for a chosen few.
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      openTheDesk(difficulty, 2)
      // The purposes are spread across the benches — the rate's is always on
      // screen, guidance's is on the words, the rest on the toolkit — so the
      // union of what each bench renders is what has to cover the toolkit.
      const seen = new Set<string>()
      for (const bench of ['The case', 'The words', 'The toolkit'] as const) {
        const tab = screen.queryByRole('tab', { name: bench })
        if (tab !== null) fireEvent.click(tab)
        for (const instrument of availableInstruments('fed', difficulty)) {
          if (screen.queryAllByText(instrument.purpose).length > 0) {
            seen.add(instrument.id)
          }
        }
      }
      for (const instrument of availableInstruments('fed', difficulty)) {
        expect(instrument.purpose.length, instrument.id).toBeGreaterThan(0)
        expect(seen.has(instrument.id), `${difficulty}: ${instrument.id}`).toBe(true)
      }
      cleanup()
    }
  })

  it('says nothing about a facility the player left alone', () => {
    openTheDesk('medium')
    fireEvent.click(screen.getByRole('button', { name: 'Review policy package' }))
    expect(screen.queryByText(/% of GDP →/)).toBeNull()
  })
})
