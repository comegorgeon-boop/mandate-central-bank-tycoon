import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { MEETING_COUNT, type Difficulty } from '../simulation/index.ts'

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
  fireEvent.click(screen.getByRole('link', { name: 'Play now' }))
  fireEvent.click(screen.getByRole('button', { name: DIFFICULTY_LABEL[difficulty] }))
  fireEvent.change(screen.getByLabelText('Scenario seed', { selector: 'input' }), {
    target: { value: 'CONSOLE' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Start the mandate' }))
  fireEvent.click(screen.getByRole('button', { name: 'Enter the first meeting' }))

  for (let meeting = 1; meeting <= MEETING_COUNT[difficulty]; meeting += 1) {
    // A mandate can end early — dismissal, a banking crisis, an inflation
    // spiral — and then the meeting screen is gone and the result screen is up.
    // That is a real outcome and the common one at hard, not a failure of this
    // test, so the guard has to come before anything reaches for a tab.
    if (screen.queryByRole('tab', { name: 'Meeting Brief' }) === null) break

    for (const tab of ['Meeting Brief', 'Prices', 'Labor', 'Policy Desk']) {
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
    fireEvent.click(screen.getByRole('link', { name: 'Play now' }))
    fireEvent.click(screen.getByRole('button', { name: DIFFICULTY_LABEL[difficulty] }))
    fireEvent.change(screen.getByLabelText('Scenario seed', { selector: 'input' }), {
      target: { value: 'TOOLKIT' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Start the mandate' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enter the first meeting' }))

    for (let meeting = 0; meeting < advance; meeting += 1) {
      fireEvent.click(screen.getByRole('tab', { name: 'Policy Desk' }))
      fireEvent.click(screen.getByRole('button', { name: 'Review policy package' }))
      fireEvent.click(screen.getByRole('button', { name: 'Confirm and advance' }))
      const onward = screen.queryByRole('button', {
        name: 'Continue to the next meeting',
      })
      if (onward !== null) fireEvent.click(onward)
    }

    fireEvent.click(screen.getByRole('tab', { name: 'Policy Desk' }))
  }

  it('gives easy the rate and the words, and nothing else', () => {
    openTheDesk('easy')
    expect(screen.queryByRole('heading', { name: 'Standing settings' })).toBeNull()
    expect(screen.queryByRole('heading', { name: /committee is/ })).toBeNull()
    expect(screen.queryByText('In what tone?')).toBeNull()
    // The learning mandate keeps its reliable adviser.
    expect(screen.getByRole('heading', { name: /The services recommend/ })).toBeTruthy()
  })

  it('opens the balance sheet at medium, with the advice still on the table', () => {
    openTheDesk('medium', 2)
    expect(screen.getByRole('heading', { name: 'Standing settings' })).toBeTruthy()
    expect(screen.getByText('Securities purchases')).toBeTruthy()
    expect(screen.getByText('Balance sheet runoff')).toBeTruthy()
    expect(screen.getByRole('heading', { name: /The services recommend/ })).toBeTruthy()
    // The words still cannot depart from the deed here.
    expect(screen.queryByText('In what tone?')).toBeNull()
  })

  it('opens the full toolkit and the free tone at hard, and withdraws the recommendation', () => {
    openTheDesk('hard', 2)
    expect(screen.getByRole('heading', { name: 'Standing settings' })).toBeTruthy()
    expect(screen.getByText('Interest on reserve balances')).toBeTruthy()
    expect(screen.getByText('Liquidity swap lines')).toBeTruthy()
    expect(screen.getByText('In what tone?')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /The services recommend/ })).toBeNull()
  })

  it('carries a facility the player moved into the confirmed package', () => {
    openTheDesk('medium')
    // Two steps up from a standing zero: the confirmation must say so, or the
    // player is confirming something they were never shown.
    fireEvent.click(screen.getByRole('button', { name: 'Raise Securities purchases' }))
    fireEvent.click(screen.getByRole('button', { name: 'Raise Securities purchases' }))
    fireEvent.click(screen.getByRole('button', { name: 'Review policy package' }))
    expect(screen.getByText('0.0 % of GDP → 1.0 % of GDP')).toBeTruthy()
  })

  it('says nothing about a facility the player left alone', () => {
    openTheDesk('medium')
    fireEvent.click(screen.getByRole('button', { name: 'Review policy package' }))
    expect(screen.queryByText(/% of GDP →/)).toBeNull()
  })
})
