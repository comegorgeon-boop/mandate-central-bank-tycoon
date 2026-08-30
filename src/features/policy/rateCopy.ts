/**
 * Deterministic copy for the Policy Desk.
 *
 * Every string here is produced by a fixed template from the chosen magnitude
 * and the published market data. Nothing is generated, sampled or fetched.
 */

/** Direction-of-effect explanation, shown at difficulties that allow hints. */
export function rateEffectHint(basisPoints: number): string {
  if (basisPoints === 0) {
    return (
      'Holding leaves the current stance in force. The effects of earlier ' +
      'decisions keep arriving in the meantime, so a hold is not a neutral act ' +
      'when a previous move is still working through.'
    )
  }

  if (basisPoints > 0) {
    return (
      `Raising the rate by ${basisPoints} bp tightens financial conditions. ` +
      'Borrowing costs rise first, demand cools over the following meetings, ' +
      'and inflation only responds after the output gap has moved. The currency ' +
      'tends to firm, which pulls import prices down as a second channel.'
    )
  }

  return (
    `Cutting the rate by ${Math.abs(basisPoints)} bp loosens financial conditions. ` +
    'Borrowing costs fall first, demand recovers over the following meetings, ' +
    'and inflation follows the output gap with a further delay. The currency ' +
    'tends to soften, which pushes import prices up as a second channel.'
  )
}

/**
 * How the decision sits against the path markets have already priced.
 *
 * `pricedGap` is the one-year implied rate minus the current rate, in basis
 * points — a path, not a forecast of this single meeting — so the copy
 * compares direction and size rather than claiming an exact expectation.
 */
export function pricedInSummary(basisPoints: number, pricedGap: number): string {
  if (Math.abs(pricedGap) < 15) {
    return basisPoints === 0
      ? 'Markets price no material change over the coming year. A hold is what is expected.'
      : `Markets price no material change over the coming year, so a ${Math.abs(basisPoints)} bp ` +
          `${basisPoints > 0 ? 'increase' : 'cut'} is a surprise on the day.`
  }

  const pricedDirection = pricedGap > 0 ? 'tightening' : 'easing'
  const pricedText = `Markets price ${Math.abs(pricedGap)} bp of ${pricedDirection} over the coming year.`

  if (basisPoints === 0) {
    return `${pricedText} Holding today does not contradict that path, but it defers it.`
  }

  if (Math.sign(basisPoints) !== Math.sign(pricedGap)) {
    return `${pricedText} This decision moves the other way, so expect a market reaction on the day.`
  }

  if (Math.abs(basisPoints) > Math.abs(pricedGap)) {
    return `${pricedText} This decision delivers more than the whole priced path at a single meeting.`
  }

  return `${pricedText} This decision moves along that path and is broadly priced in.`
}
