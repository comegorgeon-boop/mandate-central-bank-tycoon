import {
  readStance,
  stanceAfterMove,
  type ObservationSet,
  type StanceLabel,
} from '../../simulation/index.ts'

/**
 * What the selected move would do to the stance.
 *
 * The desk's most important number, and the one the last playthrough was
 * missing: a player choosing "+25 bp" is choosing a nominal move, but what
 * they are actually deciding is where the real rate sits against neutral. When
 * a quarter point is not enough to cross back into restrictive territory, this
 * says so before the decision is taken rather than three meetings after.
 *
 * Expectations are held fixed here, and the copy says so. They will move — the
 * gap between this projection and next meeting's reading is the lesson the
 * stance strip teaches afterwards.
 */

const LABEL_TEXT: Readonly<Record<StanceLabel, string>> = {
  restrictive: 'restrictive',
  neutral: 'around neutral',
  accommodative: 'accommodative',
}

const LABEL_STYLE: Readonly<Record<StanceLabel, string>> = {
  restrictive: 'text-sky-300',
  neutral: 'text-neutral-200',
  accommodative: 'text-amber-300',
}

export function StancePreview({
  observation,
  move,
}: {
  readonly observation: ObservationSet
  readonly move: number
}) {
  const current = readStance(observation)
  const next = stanceAfterMove(observation, move)

  if (next.realRate === null || next.label === null || current.label === null) {
    return null
  }

  const crosses = next.label !== current.label

  return (
    <div className="mt-4 rounded border border-neutral-800 bg-neutral-900 p-3">
      <h3 className="text-sm font-medium text-neutral-200">
        Where this leaves the stance
      </h3>

      <dl className="mt-2 space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-neutral-400">Real rate</dt>
          <dd className="tabular-nums text-neutral-100">
            {current.realRate === null ? '—' : `${current.realRate.toFixed(2)} %`}
            <span aria-hidden="true" className="mx-2 text-neutral-600">
              →
            </span>
            <span className="text-neutral-50">{next.realRate.toFixed(2)} %</span>
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-neutral-400">Stance</dt>
          <dd className="text-right">
            <span className={LABEL_STYLE[current.label]}>{LABEL_TEXT[current.label]}</span>
            <span aria-hidden="true" className="mx-2 text-neutral-600">
              →
            </span>
            <span className={`font-medium ${LABEL_STYLE[next.label]}`}>
              {LABEL_TEXT[next.label]}
            </span>
          </dd>
        </div>
      </dl>

      <p className="mt-2 text-sm text-neutral-400">
        {crosses
          ? `This move changes the stance: policy would go from ${LABEL_TEXT[current.label]} to ${LABEL_TEXT[next.label]}.`
          : move === 0
            ? `Holding leaves policy ${LABEL_TEXT[current.label]}.`
            : `This move is not enough to change the stance: policy stays ${LABEL_TEXT[next.label]}.`}
      </p>

      <p className="mt-2 text-xs text-neutral-500">
        Calculated with expected inflation held at{' '}
        {next.expectedInflation === null
          ? 'its current reading'
          : `${next.expectedInflation.toFixed(2)} %`}
        . It will not hold there. If expectations move further than your rate does, the
        stance goes the other way — which is why the decomposition at the top of the
        next meeting is worth reading.
      </p>
    </div>
  )
}
