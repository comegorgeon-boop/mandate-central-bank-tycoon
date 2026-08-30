import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from '../App'
import { MEETING_COUNT } from '../simulation/index.ts'

/**
 * The whole loop, driven through the interface.
 *
 * This is the test that says the game is playable: setup, briefing, every
 * scheduled meeting, and the post-mandate report, with no direct calls into
 * the engine.
 */

const MEETINGS = MEETING_COUNT.easy

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

/** Starts a run on a fixed seed, leaving the player at the first meeting. */
function startRunOnSeed(seed: string): void {
  renderAt('/play/setup')

  fireEvent.change(screen.getByLabelText('Scenario seed', { selector: 'input' }), {
    target: { value: seed },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Start the mandate' }))

  expect(screen.getByRole('heading', { name: 'Federal Reserve' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Enter the first meeting' }))
}

/**
 * Dismisses the same-day reaction screen that opens every meeting after the
 * first, so the caller lands on the meeting proper.
 */
function passTheReaction(): void {
  const onward = screen.queryByRole('button', { name: 'Continue to the next meeting' })
  if (onward !== null) fireEvent.click(onward)
}

/** Confirms a move at the current meeting and lands on the next one. */
function decideThisMeeting(move: string = 'Hold'): void {
  fireEvent.click(screen.getByRole('tab', { name: 'Policy Desk' }))
  if (move !== 'Hold') fireEvent.click(screen.getByRole('button', { name: move }))
  fireEvent.click(screen.getByRole('button', { name: 'Review policy package' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm and advance' }))
  passTheReaction()
}

/** The policy rate currently in force, read off the permanent stance strip. */
function policyRateInForce(): number {
  const strip = screen.getByRole('region', { name: 'Policy stance' })
  const match = /Policy rate\s*(-?\d+\.\d+) %/.exec(strip.textContent ?? '')
  return Number(match?.[1])
}

describe('the playable loop', () => {
  it('runs setup, briefing, every meeting and the result screen', () => {
    startRunOnSeed('TEST')

    for (let meeting = 1; meeting <= MEETINGS; meeting += 1) {
      expect(
        screen.getByRole('heading', { name: `Meeting ${meeting} of ${MEETINGS}` }),
      ).toBeInTheDocument()
      decideThisMeeting()
    }

    expect(screen.getByRole('heading', { name: 'Mandate completed' })).toBeInTheDocument()
    expect(screen.getByText(`${MEETINGS} of ${MEETINGS} scheduled meetings served.`)).toBeInTheDocument()

    // A score out of 10,000, with its components broken down.
    expect(screen.getByText('/ 10,000')).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /Price stability/ })).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /Mandate completion/ })).toBeInTheDocument()

    // The four post-mandate charts, each with an accessible summary.
    expect(screen.getByRole('img', { name: /^Inflation\./ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /^Unemployment\./ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /^Policy rate\./ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /^Output gap\./ })).toBeInTheDocument()
  })

  it('shows all four panels at a meeting', () => {
    startRunOnSeed('PANELS')

    const panel = (): HTMLElement => screen.getByRole('tabpanel')

    expect(within(panel()).getByRole('heading', { name: 'Meeting Brief' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Prices' }))
    expect(within(panel()).getByRole('heading', { name: 'Prices' })).toBeInTheDocument()
    expect(within(panel()).getByText('Headline inflation')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Labor' }))
    expect(within(panel()).getByRole('heading', { name: 'Labor' })).toBeInTheDocument()
    expect(within(panel()).getByText('Unemployment rate')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Policy Desk' }))
    expect(within(panel()).getByRole('heading', { name: 'Policy Desk' })).toBeInTheDocument()
  })

  it('applies a rate cut and carries the new rate into the next meeting', () => {
    startRunOnSeed('CUT')

    const before = policyRateInForce()
    expect(Number.isFinite(before)).toBe(true)

    decideThisMeeting('−25 bp')

    expect(screen.getByRole('heading', { name: `Meeting 2 of ${MEETINGS}` })).toBeInTheDocument()
    expect(policyRateInForce()).toBeCloseTo(before - 0.25, 5)
  })

  it('resets the selected move between meetings', () => {
    startRunOnSeed('RESET')

    decideThisMeeting('+50 bp')

    fireEvent.click(screen.getByRole('tab', { name: 'Policy Desk' }))
    expect(screen.getByRole('button', { name: 'Hold' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: '+50 bp' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('offers exactly the moves the engine would accept at the lower bound', () => {
    startRunOnSeed('FLOOR')

    const current = policyRateInForce()
    fireEvent.click(screen.getByRole('tab', { name: 'Policy Desk' }))

    for (const cut of [25, 50, 75, 100]) {
      const offered = screen.queryByRole('button', { name: `−${cut} bp` }) !== null
      expect(offered).toBe(current - cut / 100 >= -1e-9)
    }
  })
})

describe('route guards', () => {
  it('sends a player with no run in progress back to setup', () => {
    renderAt('/play/meeting/3')
    expect(
      screen.getByRole('heading', { name: 'Set up your mandate' }),
    ).toBeInTheDocument()
  })

  it('sends a briefing with no run in progress back to setup', () => {
    renderAt('/play/briefing')
    expect(
      screen.getByRole('heading', { name: 'Set up your mandate' }),
    ).toBeInTheDocument()
  })

  it('advances the URL to the meeting the engine says is current', () => {
    startRunOnSeed('GUARD')
    expect(screen.getByRole('heading', { name: `Meeting 1 of ${MEETINGS}` })).toBeInTheDocument()

    // Nothing navigates on confirmation: the guard notices that the URL still
    // points at meeting one while the run has moved on, and redirects.
    decideThisMeeting()
    expect(screen.getByRole('heading', { name: `Meeting 2 of ${MEETINGS}` })).toBeInTheDocument()
  })
})
