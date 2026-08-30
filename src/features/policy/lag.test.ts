import { describe, expect, it } from 'vitest'
import { formatMeetings, transmissionLag } from './lag.ts'

describe('transmissionLag', () => {
  it('reports the easy-mode peak documented in docs/BALANCE.md', () => {
    // The kernel is calibrated so easy peaks at 1.5 meetings, which is what
    // makes easy a reacting rather than an anticipating game.
    expect(transmissionLag('easy').peakMeetings).toBeCloseTo(1.5, 5)
  })

  it('lengthens with difficulty rather than staying a fixed quoted range', () => {
    const easy = transmissionLag('easy')
    const medium = transmissionLag('medium')
    const hard = transmissionLag('hard')

    expect(medium.peakMeetings).toBeGreaterThan(easy.peakMeetings)
    expect(hard.peakMeetings).toBeGreaterThan(medium.peakMeetings)
  })

  it('delivers most of the response after the peak, never before', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const lag = transmissionLag(difficulty)
      expect(lag.spanMeetings).toBeGreaterThan(lag.peakMeetings)
    }
  })
})

describe('formatMeetings', () => {
  it('singularises exactly one meeting', () => {
    expect(formatMeetings(1)).toBe('1 meeting')
    expect(formatMeetings(1.5)).toBe('1.5 meetings')
    expect(formatMeetings(3.25)).toBe('3.3 meetings')
  })
})
