import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from '../App'
import {
  MEETING_COUNT,
  SIMULATION_VERSION,
  advanceTrueState,
  applyPolicyPackage,
  createInitialState,
  createRunConfig,
  evaluateEndConditions,
  generateObservation,
  resolveEvent,
  type PolicyPackage,
} from '../simulation/index.ts'

/**
 * The interface and the engine play the same game.
 *
 * Every balance measurement in docs/BALANCE.md drives the engine directly —
 * `applyPolicyPackage`, then `resolveEvent`, then `advanceTrueState` — while a
 * player goes through React state, a routed meeting page, a confirmation
 * screen and the run provider. Nothing had ever checked that those two paths
 * produce the same economy, so a sweep saying a mandate is winnable and a
 * player finding it unwinnable could both have been right.
 *
 * This is the test that settles it. The same aggressive sequence is played
 * twice on the same seed, once each way, and the *published* numbers are
 * compared meeting by meeting. Published rather than latent on purpose: an
 * observation is a pure function of the state and the run seed, so if what the
 * screen prints matches what the engine's own observation layer would print
 * from the direct path, the two economies are the same one.
 */

const MEETINGS = MEETING_COUNT.easy
const SEED = 'PARITY'

/** Sustained aggressive tightening: the hardest case for a transmission bug. */
const MOVE_BP = 100

interface Published {
  readonly meeting: number
  readonly policyRate: number
  readonly headline: number | null
  readonly core: number | null
  readonly unemployment: number | null
}

// ---- Path A: the engine, driven directly, exactly as the sweep drives it ----

function playEngineDirectly(): Published[] {
  const config = createRunConfig({
    institution: 'fed',
    difficulty: 'easy',
    seed: SEED,
    simulationVersion: SIMULATION_VERSION,
  })

  let state = createInitialState(config)
  let outcome = evaluateEndConditions(state)
  const published: Published[] = []

  const record = (): void => {
    const observation = generateObservation(state, {
      meetingIndex: state.meetingIndex,
      newswire: [],
      clues: [],
    })
    published.push({
      meeting: state.meetingIndex + 1,
      policyRate: state.stance.targetRate,
      headline: observation.indicators.headline_inflation?.value ?? null,
      core: observation.indicators.core_inflation?.value ?? null,
      unemployment: observation.indicators.unemployment?.value ?? null,
    })
  }

  while (outcome.status === 'active') {
    record()
    const pkg: PolicyPackage = {
      actions: [{ instrument: 'policy_rate', magnitude: MOVE_BP }],
      communication: null,
    }
    const applied = applyPolicyPackage(state, pkg)
    if (!applied.ok) throw new Error('the engine rejected the sequence')
    state = advanceTrueState(resolveEvent(applied.state).state)
    outcome = evaluateEndConditions(state, outcome.breachCounters)
  }

  return published
}

// ---- Path B: the game, driven through the interface ------------------------

/**
 * The published value on one indicator row, read the way a player reads it.
 *
 * Scraped from the row's text rather than by element, because the number and
 * its unit share a span: the printed figure is the first thing after the label.
 */
function readIndicator(label: string): number | null {
  const row = screen.getByText(label).closest('li')
  if (row === null) throw new Error(`no indicator row for ${label}`)
  const text = row.textContent ?? ''
  const match = new RegExp(`${label}\\s*(-?\\d+\\.\\d+|—)`).exec(text)
  if (match === null) throw new Error(`no published value on the ${label} row`)
  return match[1] === '—' ? null : Number(match[1])
}

function policyRateInForce(): number {
  const strip = screen.getByRole('region', { name: 'Policy stance' })
  const match = /Policy rate\s*(-?\d+\.\d+) %/.exec(strip.textContent ?? '')
  if (match === null) throw new Error('the stance strip does not show a policy rate')
  return Number(match[1])
}

function playThroughTheInterface(): {
  readonly published: Published[]
  readonly confirmedRates: number[]
} {
  render(
    <MemoryRouter initialEntries={['/play/setup']}>
      <App />
    </MemoryRouter>,
  )

  fireEvent.change(screen.getByLabelText('Scenario seed', { selector: 'input' }), {
    target: { value: SEED },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Start the mandate' }))
  fireEvent.click(screen.getByRole('button', { name: 'Enter the first meeting' }))

  const published: Published[] = []
  // What the confirmation screen promised the rate would become, meeting by
  // meeting. Compared below against the rate actually in force next time.
  const confirmedRates: number[] = []

  for (let meeting = 1; meeting <= MEETINGS; meeting += 1) {
    const reaction = screen.queryByRole('button', {
      name: 'Continue to the next meeting',
    })
    if (reaction !== null) fireEvent.click(reaction)

    expect(
      screen.getByRole('heading', { name: `Meeting ${meeting} of ${MEETINGS}` }),
    ).toBeInTheDocument()

    const rate = policyRateInForce()

    fireEvent.click(screen.getByRole('tab', { name: 'Prices' }))
    const headline = readIndicator('Headline inflation')
    const core = readIndicator('Core inflation')

    fireEvent.click(screen.getByRole('tab', { name: 'Labor' }))
    const unemployment = readIndicator('Unemployment rate')

    published.push({ meeting, policyRate: rate, headline, core, unemployment })

    fireEvent.click(screen.getByRole('tab', { name: 'Policy Desk' }))
    fireEvent.click(screen.getByRole('button', { name: `+${MOVE_BP} bp` }))
    fireEvent.click(screen.getByRole('button', { name: 'Review policy package' }))

    // "Rate after the decision: X % → Y %" — capture the Y the screen promises.
    const promised = /(-?\d+\.\d+) % → (-?\d+\.\d+) %/.exec(document.body.textContent ?? '')
    if (promised === null) throw new Error('the confirmation screen shows no resulting rate')
    expect(Number(promised[1])).toBeCloseTo(rate, 5)
    confirmedRates.push(Number(promised[2]))

    fireEvent.click(screen.getByRole('button', { name: 'Confirm and advance' }))
  }

  return { published, confirmedRates }
}

describe('the interface and the engine play the same game', () => {
  const direct = playEngineDirectly()
  const { published: viaInterface, confirmedRates } = playThroughTheInterface()

  it('plays the same number of meetings', () => {
    expect(direct).toHaveLength(MEETINGS)
    expect(viaInterface).toHaveLength(MEETINGS)
  })

  it('holds the same policy rate at every meeting', () => {
    // A one-meeting offset between what the player decides and what the engine
    // applies would show up here first, and nowhere else.
    for (let index = 0; index < MEETINGS; index += 1) {
      expect(viaInterface[index].policyRate).toBeCloseTo(direct[index].policyRate, 5)
    }
  })

  it('applies exactly the decision the confirmation screen displayed', () => {
    // The rate the screen promised at meeting N must be the rate in force at
    // meeting N+1 — no rounding drift, no dropped move, no double application.
    for (let index = 0; index < MEETINGS - 1; index += 1) {
      expect(viaInterface[index + 1].policyRate).toBeCloseTo(confirmedRates[index], 5)
    }
  })

  it('publishes the same inflation at every meeting', () => {
    for (let index = 0; index < MEETINGS; index += 1) {
      expect(
        viaInterface[index].headline,
        `headline inflation differs at meeting ${index + 1}: ` +
          `interface ${viaInterface[index].headline}, engine ${direct[index].headline}`,
      ).toBe(direct[index].headline)
      expect(viaInterface[index].core).toBe(direct[index].core)
    }
  })

  it('publishes the same unemployment at every meeting', () => {
    for (let index = 0; index < MEETINGS; index += 1) {
      expect(viaInterface[index].unemployment).toBe(direct[index].unemployment)
    }
  })

  it('actually tightened, so the comparison had something to disagree about', () => {
    const first = direct[0].policyRate
    const last = direct[MEETINGS - 1].policyRate
    expect(last - first).toBeCloseTo(((MEETINGS - 1) * MOVE_BP) / 100, 5)
  })
})
