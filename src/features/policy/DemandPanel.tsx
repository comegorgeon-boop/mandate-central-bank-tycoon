import type { DemandResponse, PoliticalDemand } from '../../simulation/index.ts'
import { demandConsequences } from '../../simulation/index.ts'

/**
 * A question from outside the room.
 *
 * The dilemma this game was missing. Pressure used to accumulate and be
 * watched; nothing was ever *asked*. Now, when the pressure is high enough
 * that a government would actually say something, it says it — and the
 * committee answers.
 *
 * ## Both sides are legible, deliberately
 *
 * Each answer prints what it would cost before it is chosen. That is not
 * generosity: a dilemma whose two sides are not both legible is a trap, and a
 * trap teaches nothing except to reload. The player should be able to look at
 * "this buys me twenty points of pressure and costs me fourteen of
 * credibility" and still find it hard, because it *is* hard — the thing you
 * are spending is the thing the job is for, and the thing you are buying is
 * staying in the job long enough to do it.
 *
 * ## Who is speaking
 *
 * An office, never a person. The administration, the Treasury, a committee of
 * the legislature. Same rule as the historical scenarios, same reason.
 */

const SIDE: readonly {
  readonly response: DemandResponse
  readonly tone: string
}[] = [
  { response: 'resist', tone: 'border-edge-accent' },
  { response: 'yield', tone: 'border-edge' },
]

function signed(value: number, digits = 0): string {
  const rounded = Number(value.toFixed(digits))
  if (rounded === 0) return '—'
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toFixed(digits)}`
}

export function DemandPanel({
  demand,
  chosen,
  onChoose,
}: {
  readonly demand: PoliticalDemand
  readonly chosen: DemandResponse | null
  readonly onChoose: (response: DemandResponse | null) => void
}) {
  return (
    <section
      aria-labelledby="demand-heading"
      className="mt-4 rounded border-l-4 border-bad bg-inset p-3"
    >
      <p className="text-2xs uppercase tracking-[0.14em] text-onwood-faint">
        {demand.from}
      </p>
      <h3 id="demand-heading" className="mt-0.5 text-sm font-semibold text-onwood">
        {demand.title}
      </h3>
      <p className="mt-1 text-sm text-onwood-soft">{demand.body}</p>

      <div className="mt-3 flex flex-col gap-2">
        {SIDE.map(({ response, tone }) => {
          const effect = demandConsequences(demand, response)
          const selected = chosen === response
          const label =
            response === 'yield' ? demand.yieldLabel : demand.resistLabel
          return (
            <button
              key={response}
              type="button"
              aria-pressed={selected}
              onClick={() => onChoose(selected ? null : response)}
              className={`rounded border p-2.5 text-left ${
                selected ? `${tone} bg-page` : 'border-edge-room hover:bg-page'
              }`}
            >
              <span className="text-sm font-medium text-onwood">{label}</span>
              {/* The price, in the three quantities it is actually paid in.
                  Printed rather than hinted: see the note above. */}
              <span className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-onwood-soft">
                <span className="tabular-nums">
                  pressure {signed(effect.politicalPressure)}
                </span>
                <span className="tabular-nums">
                  credibility {signed(effect.credibility)}
                </span>
                <span className="tabular-nums">
                  anchor {signed(effect.anchoring, 2)}
                </span>
                <span className="tabular-nums">
                  public trust {signed(effect.publicTrust)}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {chosen === null && (
        <p className="mt-2 text-xs text-onwood-faint">
          Say nothing and the request goes unanswered, which is a refusal — the
          pressure rises exactly as much, and holding in silence earns back
          rather less of the standing than holding out loud.
        </p>
      )}
    </section>
  )
}
