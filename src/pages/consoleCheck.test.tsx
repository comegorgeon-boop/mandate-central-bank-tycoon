import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { MEETING_COUNT } from '../simulation/index.ts'

describe('console hygiene', () => {
  it('plays a whole mandate without logging a warning or an error', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('link', { name: 'Play now' }))
    fireEvent.change(screen.getByLabelText('Scenario seed', { selector: 'input' }), {
      target: { value: 'CONSOLE' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Start the mandate' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enter the first meeting' }))

    for (let meeting = 1; meeting <= MEETING_COUNT.easy; meeting += 1) {
      for (const tab of ['Meeting Brief', 'Prices', 'Labor', 'Policy Desk']) {
        fireEvent.click(screen.getByRole('tab', { name: tab }))
      }
      fireEvent.click(screen.getByRole('button', { name: 'Review policy package' }))
      fireEvent.click(screen.getByRole('button', { name: 'Confirm and advance' }))
    }

    fireEvent.click(screen.getByRole('button', { name: 'Replay the same seed' }))

    expect(error.mock.calls).toEqual([])
    expect(warn.mock.calls).toEqual([])

    error.mockRestore()
    warn.mockRestore()
  })
})
