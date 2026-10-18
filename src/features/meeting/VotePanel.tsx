import type { CommitteeVote } from '../../simulation/index.ts'

/**
 * How the committee voted, and what the record says.
 *
 * Shown on the reaction screen — the same-day panel that opens the meeting
 * after a decision — because that is when a vote is published in the world
 * this is modelling: with the decision, not before it and not at the end of
 * the term.
 *
 * ## What it is careful not to do
 *
 * It does not mark the dissenters as wrong, and it does not mark them as
 * right. A member who wanted fifty basis points more dissents from a hold
 * whether or not holding turns out to have been correct; the thing that judges
 * positions after the fact is the doctrine scoreboard, which is deliberately a
 * different panel in a different place. Mixing them would turn a published
 * vote into a scorecard, and a player would start reading dissents as
 * instructions.
 *
 * A unanimous vote still gets a line. "Nothing to report" is itself the
 * report, and a panel that only appeared when something went wrong would teach
 * the player to dread it.
 */
export function VotePanel({ vote }: { readonly vote: CommitteeVote }) {
  if (vote.ballots.length === 0 || vote.headline === null) return null

  const dissenting = vote.ballots.filter((ballot) => ballot.dissents)

  return (
    <section
      aria-labelledby="vote-heading"
      className="mt-4 rounded-lg border border-edge bg-panel p-4 text-ink shadow-panel"
    >
      <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
        The vote
      </p>
      <h3 id="vote-heading" className="mt-1 text-sm font-semibold text-ink">
        {vote.headline}
      </h3>

      {dissenting.length > 0 && (
        <ul className="mt-3 space-y-2">
          {dissenting.map((ballot) => (
            <li key={ballot.voice} className="border-l-2 border-edge-accent pl-3">
              <p className="text-sm font-medium text-ink">{ballot.voice}</p>
              <p className="mt-0.5 text-xs text-ink-soft">{ballot.statement}</p>
            </li>
          ))}
        </ul>
      )}

      {vote.credibilityCost > 0 && (
        <p className="mt-3 text-xs text-ink-faint">
          Published with the decision. A committee that cannot hold a majority
          behind its own policy is read as one that may not keep it —{' '}
          {vote.credibilityCost.toFixed(1)} points of credibility.
        </p>
      )}
    </section>
  )
}
