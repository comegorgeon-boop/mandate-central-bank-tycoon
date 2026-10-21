import type { SeriesId } from '../types/observation.ts'

/**
 * What a number *means*, and what it should make you *do*.
 *
 * ## The rule
 *
 * > "UN CHIFFRE N'APPARAÎT JAMAIS SEUL, ET IL PORTE DEUX CHOSES : ce qu'il
 * > VEUT DIRE dans l'économie réelle, et ce qu'il devrait me faire FAIRE. Les
 * > deux, pas l'un ou l'autre."
 *
 * Both, and the second is the one every version of this interface has been
 * missing. The glossary told the player what a credit spread *is*. Nothing
 * ever told them that a widening credit spread means their last two rises are
 * already in the economy and a third would land on top of them.
 *
 * So each entry carries three things:
 *
 *  - **`is`** — what the number is, in one clause.
 *  - **`means`** — what it is doing to a real person. Concrete, with a figure
 *    where a figure helps, because "financial conditions tightened" is a
 *    phrase and "a builder who borrowed at 4 % now borrows at 6.5 %" is a
 *    picture.
 *  - **`do`** — what it should change about the decision in front of you.
 *
 * ## Written from the engine, not around it
 *
 * Each `means` is a reading of a real transmission channel in `dynamics.ts`,
 * and the comments say which. That matters because a sentence that explains a
 * mechanism the model does not have is worse than no sentence at all: the
 * player would learn to act on it and the economy would not respond.
 *
 * > "C'est ça le glossaire, pas une page que personne n'ouvre."
 */

export interface IndicatorMeaning {
  readonly is: string
  readonly means: string
  readonly do: string
}

export const INDICATOR_MEANINGS: Readonly<Partial<Record<SeriesId, IndicatorMeaning>>> = {
  /* The credit spread enters the IS curve through `financialConditions`: it is
     literally the price of borrowing the model charges firms and households,
     on top of whatever the policy rate is. So a spread that widens *is* a
     tightening the player did not vote for. */
  credit_spread: {
    is: 'What a company pays to borrow, above what the government pays.',
    means:
      'Banks are tightening. A builder who was borrowing at 4 % is borrowing ' +
      'at 6.5 % today — when the loan is granted at all.',
    do:
      'Your tightening is already reaching the economy through the banks. ' +
      'Adding to it now hits the same borrower twice.',
  },

  /* The output gap is the Phillips curve's demand term — `slope · gap` — and
     it is the one leg of inflation the policy rate is actually for. */
  output_gap_estimate: {
    is: 'How far output is running above or below what the economy can sustain.',
    means:
      'The factories are full and firms are hiring people they would not ' +
      'normally hire. That ends in prices.',
    do: 'The inflation that is coming is not in the figures yet. Act on this one, not on the print.',
  },

  /* Long-run expectations feed `expectedInflationShort`, which is the base the
     whole Phillips curve sits on. Once it moves, inflation is self-sustaining
     and the rate has to break a belief rather than an economy. */
  inflation_expectations: {
    is: 'What people already assume inflation will be.',
    means:
      'Next year’s pay deals are being negotiated on 4 %. If that sets, ' +
      'inflation makes itself and nobody has to decide anything.',
    do: 'This is the moment when speaking costs less than acting. Later it will not.',
  },

  /* The exchange rate enters headline through `importPassThrough ·
     importPriceInflation`, with the engine's own lag — which is why the
     sentence says "in three months" rather than "now". */
  exchange_rate: {
    is: 'What the currency is worth against the rest of the world.',
    means:
      'The currency has lost 5 %. Everything bought from abroad will cost ' +
      '5 % more in about three months, whatever you do today.',
    do: 'Part of your tightening has already happened without you. Count it before you add to it.',
  },

  /* Fragmentation is the ECB's own problem: one rate, several sovereign
     borrowing costs. It is read by `transmission` per member, so a wide
     spread means the same decision arrives as different policies. */
  fragmentation_spread: {
    is: 'What the weakest member pays to borrow, above the strongest.',
    means:
      'Italy is borrowing 200 basis points dearer than Germany. The same ' +
      'rate is a different policy in each of them.',
    do: 'Your decision is not arriving the same way in all twenty countries. Watch where it lands, not the average.',
  },

  /* Banking stress gates `purchaseEffectiveness` and the credit channel: a
     stressed banking system does not pass a rate cut on. */
  bank_stress_proxy: {
    is: 'How close the banking system is to not functioning.',
    means:
      'Banks that are frightened stop lending to each other first and to ' +
      'everyone else second. A cut does not reach a borrower through a bank ' +
      'that is not lending.',
    do: 'Above the impaired line, the rate stops being your instrument and the facilities start.',
  },

  /* Unemployment against the sustainable rate: the other half of the Fed's
     mandate, and the quantity Okun's law converts the output gap into. */
  unemployment: {
    is: 'The share of people who want work and cannot find it.',
    means:
      'Above the sustainable rate, this is people who would be working in a ' +
      'normal economy. Every meeting it stays there is a cohort that does ' +
      'not get hired back.',
    do: 'If this is the gap and inflation is at target, you are tightening for nothing.',
  },

  /* Headline is what the public feels and what political pressure responds
     to; core is what the engine's own Phillips curve actually tracks. */
  headline_inflation: {
    is: 'Prices as households meet them, energy and food included.',
    means:
      'This is the number on the news and the one that decides whether ' +
      'people believe you. It moves with things you do not control.',
    do: 'Judge yourself on core. Expect to be judged on this one.',
  },

  core_inflation: {
    is: 'Prices with energy and food taken out.',
    means:
      'What is left after the shocks: the part of inflation the economy is ' +
      'generating for itself rather than importing.',
    do: 'This is the leg the rate reaches. If core is at target, a high headline is a shock to look through.',
  },

  /* Market expectations: the engine prices 35 % of the published path into
     financial conditions ahead of the decision, which is the whole mechanic
     behind the surprise wager. */
  market_expected_rate: {
    is: 'Where markets think your rate is going.',
    means:
      'A third of the path they expect is already in borrowing costs today. ' +
      'Doing what they expect changes almost nothing.',
    do: 'Moving away from this is how you buy extra reach — and what it costs you is trust.',
  },
}

/** The explanation for a series, if one has been written. */
export function meaningOf(seriesId: SeriesId): IndicatorMeaning | null {
  return INDICATOR_MEANINGS[seriesId] ?? null
}
