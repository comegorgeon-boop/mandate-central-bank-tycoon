import type { StaffRecommendation } from '../../simulation/index.ts'

/**
 * The staff recommendation, put to the committee before it decides.
 *
 * Real institutions separate the two: the staff analyse and recommend, the
 * committee decides and is accountable. Reproducing that split gives the
 * player a reasoned starting point without taking the decision away from them,
 * and gives the game somewhere to put a *fallible* adviser at higher
 * difficulties — a divided committee, or a recommendation built on the same
 * noisy data the player is misreading — rather than an oracle that would have
 * to be removed outright.
 *
 * The reasoning is shown with the number, never the number alone. A
 * recommendation without its grounds teaches obedience, which is the failure
 * mode the learning mandate exists to avoid.
 */
export function StaffAdvicePanel({
  recommendation,
  selectedMove,
}: {
  readonly recommendation: StaffRecommendation
  /** What the player currently has selected, for an honest comparison. */
  readonly selectedMove: number
}) {
  const { basisPoints } = recommendation
  const agrees = selectedMove === basisPoints
  const moveText =
    basisPoints === 0
      ? 'hold the rate'
      : `${basisPoints > 0 ? 'raise' : 'cut'} the rate by ${Math.abs(basisPoints)} bp`

  return (
    <section
      aria-labelledby="staff-heading"
      className="mt-5 rounded border border-neutral-800 bg-neutral-900 p-4"
    >
      <p className="text-xs uppercase tracking-wide text-neutral-500">
        Advice of the staff
      </p>
      <h3 id="staff-heading" className="mt-1 text-base font-semibold text-neutral-100">
        The services recommend you {moveText}.
      </h3>
      <p className="mt-2 text-sm text-neutral-300">{recommendation.reasoning}</p>

      {!agrees && (
        <p className="mt-2 text-sm text-neutral-400">
          You currently have{' '}
          <span className="text-neutral-200">
            {selectedMove === 0
              ? 'a hold'
              : `${selectedMove > 0 ? '+' : '−'}${Math.abs(selectedMove)} bp`}
          </span>{' '}
          selected. Departing from the advice is entirely legitimate — the committee
          decides, and the staff see only what you see.
        </p>
      )}

      <p className="mt-3 text-xs text-neutral-500">
        The rule behind this reacts to <em>core</em> inflation, not headline, because
        chasing headline means tightening into energy prices policy cannot influence.
        It weighs nothing else: not financial stability, not transmission, not your
        credibility. It is a starting point for the discussion, not the answer.
      </p>
    </section>
  )
}
