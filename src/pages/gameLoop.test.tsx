import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from '../App'
import {
  POLICY_RATE_FLOOR,
  getDifficulty,
  getInstrument,
  getInstrumentRange,
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
 * The whole loop, driven through the interface.
 *
 * This is the test that says the game is playable: setup, briefing, every
 * scheduled meeting, and the post-mandate report, with no direct calls into
 * the engine.
 */

// Easy is a tutorial: it ends when its objective is reached, so nothing can
// know its length in advance. Its give-up cap is the only bound there is, and
// it is read from the config rather than from `MEETING_COUNT`, which the
// tutorial does not use.
const MEETING_CAP = getDifficulty('easy').tutorialGoal?.maxMeetings ?? 0

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
/**
 * Gets from a confirmed decision to the next meeting's screens.
 *
 * Two things now sit between them, in order: the interval playing out, and the
 * same-day reaction to the decision that opened it. Both are skippable, and a
 * player in a hurry skips both, which is what this does.
 */
function passTheReaction(): void {
  const skipInterval = screen.queryByRole('button', { name: 'Skip to the meeting' })
  if (skipInterval !== null) fireEvent.click(skipInterval)
  const onward = screen.queryByRole('button', { name: 'Continue to the next meeting' })
  if (onward !== null) fireEvent.click(onward)
}

/** The rate slider on the desk. A native range input, so arrows work. */
function rateSlider(): HTMLInputElement {
  return screen.getByRole('slider', { name: /rate|range/i }) as HTMLInputElement
}

/** Confirms a move, in basis points, and lands on the next meeting. */
function decideThisMeeting(basisPoints = 0): void {
  openRoom()
  fireEvent.click(screen.getByRole('tab', { name: 'Policy Desk' }))
  if (basisPoints !== 0) {
    fireEvent.change(rateSlider(), { target: { value: String(basisPoints) } })
  }
  fireEvent.click(screen.getByRole('button', { name: 'Review policy package' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm and advance' }))
  passTheReaction()
}

/** The policy rate currently in force, read off the permanent stance strip. */
function policyRateInForce(): number {
  openRoom()
  const strip = screen.getByRole('region', { name: 'Policy stance' })
  const match = /Policy rate\s*(-?\d+\.\d+) %/.exec(strip.textContent ?? '')
  return Number(match?.[1])
}

describe('the playable loop', () => {
  it('runs setup, briefing, every meeting and the result screen', () => {
    startRunOnSeed('TEST')

    // Play until the tutorial ends of its own accord, which is the point of it:
    // it stops when the objective is reached, not after a set number of
    // meetings. The cap only bounds the loop.
    let played = 0
    for (let meeting = 1; meeting <= MEETING_CAP; meeting += 1) {
      const heading = screen.queryByRole('heading', { name: `Meeting ${meeting}` })
      if (heading === null) break
      played += 1
      decideThisMeeting()
    }
    expect(played).toBeGreaterThan(1)

    // Either ending is a legitimate run; both are endings the tutorial has.
    expect(
      screen.getByRole('heading', { name: /Objective (met|not reached)/ }),
    ).toBeInTheDocument()
    expect(screen.getByText(/meetings? served|repaired and held/)).toBeInTheDocument()
    // A score out of 10,000, with its components broken down.
    expect(screen.getByText('/ 10,000')).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /Price stability/ })).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /Mandate completion/ })).toBeInTheDocument()

    // The four post-mandate charts, each with an accessible summary.
    expect(screen.getByRole('img', { name: /^Inflation\./ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /^Unemployment\./ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /^Policy rate\./ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /^Output gap\./ })).toBeInTheDocument()
    // Fifteen seconds, not the default five. This renders a whole mandate
    // through React and both halves of it grew: more meetings open the full
    // apparatus now, and the decision screen animates its figures. The
    // assertions are unchanged — a timeout raised because the run got slower
    // is honest, one raised because an assertion got flakier would not be.
  }, 15_000)

  it('shows every panel at a meeting', () => {
    startRunOnSeed('PANELS')

    // The *meeting's* panel. The desk has benches of its own, so there is more
    // than one tabpanel on screen once it is open.
    const panel = (): HTMLElement =>
      screen.getByRole('tabpanel', { name: /Meeting Brief|The Press|Prices|Labor|Markets|Policy Desk|The Area/ })

    // The press opens first: it is what a chair reads before anything else,
    // and it is now the only place the news is.
    expect(
      within(panel()).getByRole('heading', { name: 'The Meridian Ledger' }),
    ).toBeInTheDocument()

    openRoom()

    fireEvent.click(screen.getByRole('tab', { name: 'Meeting Brief' }))
    expect(within(panel()).getByRole('heading', { name: 'Meeting Brief' })).toBeInTheDocument()

    openRoom()

    fireEvent.click(screen.getByRole('tab', { name: 'Prices' }))
    expect(within(panel()).getByRole('heading', { name: 'Prices' })).toBeInTheDocument()
    expect(within(panel()).getByText('Headline inflation')).toBeInTheDocument()

    openRoom()

    fireEvent.click(screen.getByRole('tab', { name: 'Labor' }))
    expect(within(panel()).getByRole('heading', { name: 'Labor' })).toBeInTheDocument()
    expect(within(panel()).getByText('Unemployment rate')).toBeInTheDocument()

    passTheReaction()
    openRoom()
    fireEvent.click(screen.getByRole('tab', { name: 'Policy Desk' }))
    expect(within(panel()).getByRole('heading', { name: 'Policy Desk' })).toBeInTheDocument()
  })

  it('applies a rate cut and carries the new rate into the next meeting', () => {
    startRunOnSeed('CUT')

    const before = policyRateInForce()
    expect(Number.isFinite(before)).toBe(true)

    decideThisMeeting(-25)

    expect(screen.getByRole('heading', { name: 'Meeting 2' })).toBeInTheDocument()
    expect(policyRateInForce()).toBeCloseTo(before - 0.25, 5)
  })

  it('resets the selected move between meetings', () => {
    startRunOnSeed('RESET')

    decideThisMeeting(50)

    passTheReaction()
    openRoom()
    fireEvent.click(screen.getByRole('tab', { name: 'Policy Desk' }))
    expect(rateSlider().value).toBe('0')
  })

  it('moves in the increments the engine accepts, and no others', () => {
    // Central banks move in quarter points, and a continuous dial would offer
    // values the validator rejects. The detent is the contract.
    startRunOnSeed('STEP')
    passTheReaction()
    openRoom()
    fireEvent.click(screen.getByRole('tab', { name: 'Policy Desk' }))
    expect(rateSlider().step).toBe('25')
  })

  it('stops the track where the engine would start rejecting moves', () => {
    // A slider whose handle can reach a value the validator refuses is a
    // control lying about what it does. Asserted on the track's own minimum,
    // which is one value rather than four probes.
    startRunOnSeed('FLOOR')

    const current = policyRateInForce()
    passTheReaction()
    openRoom()
    fireEvent.click(screen.getByRole('tab', { name: 'Policy Desk' }))

    const min = Number(rateSlider().min)
    const instrument = getInstrument('policy_rate')!
    const range = getInstrumentRange(instrument, 'easy')
    const floor = POLICY_RATE_FLOOR.fed

    // Every step on the track is a rate the engine would accept...
    expect(current + min / 100).toBeGreaterThanOrEqual(floor - 1e-9)
    // ...and the track is not trimmed further than the floor requires: either
    // it runs to the instrument's own minimum, or one step lower would breach.
    expect(
      min === range.min || current + (min - range.increment) / 100 < floor - 1e-9,
    ).toBe(true)
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
    expect(screen.getByRole('heading', { name: 'Meeting 1' })).toBeInTheDocument()

    // Nothing navigates on confirmation: the guard notices that the URL still
    // points at meeting one while the run has moved on, and redirects.
    decideThisMeeting()
    expect(screen.getByRole('heading', { name: 'Meeting 2' })).toBeInTheDocument()
  })
})
