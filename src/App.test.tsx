import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the game title', () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )
    expect(
      screen.getByRole('heading', { name: 'Mandate: Central Bank Tycoon' }),
    ).toBeInTheDocument()
  })
})
