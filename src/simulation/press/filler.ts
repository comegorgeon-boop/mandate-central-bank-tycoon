import type { PressDesk } from './pressPage.ts'

/**
 * The chaff.
 *
 * A newspaper is mostly things that do not bear on your decision, and a page
 * where everything matters teaches nobody to rank. These items are plausible,
 * dated, on-world, and inert: nothing here touches a single state variable,
 * and each is marked `material: false` so the page prints it small and out of
 * the way. Learning to skip past them *is* the skill the page exists to
 * exercise.
 *
 * Rules they are written to, and the reasons:
 *
 *   - **Nothing that implies a number the engine does not have.** "Retail
 *     sales rose 4 %" would be an indicator invented in prose, unmoored from
 *     the model and impossible to act on. These describe activity, not
 *     measurements.
 *   - **No real people, companies, places or events.** Same rule as the event
 *     catalog. Firms are described by what they do.
 *   - **Nothing that reads as a hint.** A filler item that hinted at a coming
 *     shock would be a clue wearing a disguise, and clues have their own
 *     channel with its own honesty rules.
 *   - **No dates, seasons or weather.** The run has no calendar, and a page
 *     that mentioned autumn in year three would be lying about a world the
 *     engine does not model.
 */

export interface FillerItem {
  readonly desk: PressDesk
  readonly headline: string
}

export const FILLER: readonly FillerItem[] = [
  {
    desk: 'business',
    headline: 'Regional airline confirms an order for short-haul aircraft',
  },
  {
    desk: 'business',
    headline: 'Two mid-sized grocery chains abandon merger talks',
  },
  {
    desk: 'business',
    headline: 'Container port completes its automated berth extension',
  },
  {
    desk: 'business',
    headline: 'Cement producer names a new chief executive from within',
  },
  {
    desk: 'business',
    headline: 'Dispute over rail freight scheduling goes to arbitration',
  },
  {
    desk: 'business',
    headline: 'Textile group reopens a mothballed plant on a trial basis',
  },
  {
    desk: 'markets',
    headline: 'Exchange consults on shortening the settlement cycle',
  },
  {
    desk: 'markets',
    headline: 'Index provider revises its sector classification rules',
  },
  {
    desk: 'markets',
    headline: 'Custodian bank moves its clearing operations to a new venue',
  },
  {
    desk: 'markets',
    headline: 'Trading volumes thin ahead of a long settlement weekend',
  },
  {
    desk: 'economy',
    headline: 'Statistical agency publishes its revised seasonal factors',
  },
  {
    desk: 'economy',
    headline: 'Universities report another rise in applications to engineering',
  },
  {
    desk: 'economy',
    headline: 'Rail operators and unions agree a scheduling framework',
  },
  {
    desk: 'economy',
    headline: 'Municipal water authority issues bonds for a treatment plant',
  },
  {
    desk: 'world',
    headline: 'Trade delegation returns without a communiqué',
  },
  {
    desk: 'world',
    headline: 'Border customs post reopens after an infrastructure upgrade',
  },
  {
    desk: 'world',
    headline: 'Shipping registry tightens its inspection regime',
  },
  {
    desk: 'institution',
    headline: 'Bank publishes the minutes of a meeting held two quarters ago',
  },
  {
    desk: 'institution',
    headline: 'Research department releases a working paper on measurement error',
  },
  {
    desk: 'institution',
    headline: 'Note redesign enters its consultation phase',
  },
  {
    desk: 'institution',
    headline: "Bank's regional office relocates to a refurbished building",
  },
]
