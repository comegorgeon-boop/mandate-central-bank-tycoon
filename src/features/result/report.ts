import {
  getInstitution,
  isMajorEvent,
  type EndConditionResult,
  type Institution,
  type ResolvedEventRecord,
  type ScoreBreakdown,
  type ScoreComponent,
  type SimulationState,
} from '../../simulation/index.ts'

/**
 * The written mandate postmortem.
 *
 * What happened, what the player did well, what they got wrong, and why they
 * have the score they have — numbers in support, never as the headline. Every
 * sentence here is assembled deterministically from data the finished session
 * already carries: `eventLog` for the story, `score.components` (whose
 * `explanation` fields are already written as prose) for the verdict,
 * `guidance` for the promise ledger, `outcome` for how the mandate ended. No
 * randomness, no model — the same finished session always produces the same
 * report, exactly like `features/meeting/brief.ts`.
 */

export interface MandateReport {
  readonly whatHappened: readonly string[]
  readonly whatWentWell: readonly string[]
  readonly whatWentWrong: readonly string[]
  readonly whyThisScore: readonly string[]
}

/** Components a mandate is judged well on: comfortably above the median. */
const WELL_THRESHOLD = 0.62
/** Components a mandate is judged poorly on. */
const WRONG_THRESHOLD = 0.55
const MAX_HIGHLIGHTED = 2

function meetingLabel(meetingIndex: number): string {
  return `meeting ${meetingIndex + 1}`
}

function majorEventsIn(eventLog: readonly ResolvedEventRecord[]): ResolvedEventRecord[] {
  return eventLog.filter((record) => isMajorEvent(record.eventId)).slice()
}

function describeWhatHappened(
  state: SimulationState,
  outcome: EndConditionResult,
  institution: Institution,
): readonly string[] {
  const paragraphs: string[] = []
  const name = getInstitution(institution).name
  const majors = majorEventsIn(state.eventLog)
  const minorCount = state.eventLog.length - majors.length
  const meetingsServed = state.meetingIndex

  if (majors.length === 0) {
    paragraphs.push(
      `${name} served ${meetingsServed} of ${state.config.meetingCount} scheduled meetings` +
        (outcome.status === 'completed'
          ? ' without a single major crisis to answer.'
          : ', before the mandate ended early.') +
        (minorCount > 0
          ? ` ${minorCount} smaller development${minorCount === 1 ? '' : 's'} shaped the path ` +
            'along the way, none of them mandate-defining.'
          : ' The path was unusually quiet throughout.'),
    )
  } else {
    const [first, ...rest] = majors
    paragraphs.push(
      first.meetingIndex === 0
        ? `The mandate opened already in motion: at the first meeting, ${first.title}. ${first.newswire}`
        : `At ${meetingLabel(first.meetingIndex)}, ${first.title}. ${first.newswire}`,
    )
    if (rest.length > 0) {
      paragraphs.push(
        rest
          .map((record) => `At ${meetingLabel(record.meetingIndex)}, ${record.title.toLowerCase()} followed.`)
          .join(' '),
      )
    }
  }

  if (outcome.status === 'failed' && outcome.summary !== null) {
    const leadingFactor = outcome.causalChain[0]
    paragraphs.push(
      `${outcome.summary}` +
        (leadingFactor !== undefined ? ` ${leadingFactor.detail}` : ''),
    )
  } else if (outcome.status === 'completed') {
    paragraphs.push('The full mandate was served to its scheduled end.')
  }

  return paragraphs
}

/** Ranks components by performance, filtered to a threshold, best/worst first. */
function rankedComponents(
  components: readonly ScoreComponent[],
  threshold: number,
  direction: 'best' | 'worst',
): readonly ScoreComponent[] {
  const filtered = components.filter((component) =>
    direction === 'best' ? component.raw >= threshold : component.raw <= threshold,
  )
  const sorted = [...filtered].sort((a, b) =>
    direction === 'best' ? b.raw - a.raw : a.raw - b.raw,
  )
  return sorted.slice(0, MAX_HIGHLIGHTED)
}

function describeWhatWentWell(state: SimulationState, score: ScoreBreakdown): readonly string[] {
  const paragraphs: string[] = []
  const best = rankedComponents(score.components, WELL_THRESHOLD, 'best')

  if (best.length > 0) {
    paragraphs.push(best.map((component) => component.explanation).join(' '))
  } else {
    paragraphs.push(
      'Nothing on the record stood out as a genuine strength — this was a mandate ' +
        'that survived rather than one that was steered well.',
    )
  }

  if (state.guidance.brokenPromises === 0 && state.guidance.keptPromises > 0) {
    paragraphs.push(
      `Every guidance commitment made was delivered: ${state.guidance.keptPromises} kept ` +
        'promise(s) and none broken. Markets learned this institution meant what it said.',
    )
  }

  return paragraphs
}

function describeWhatWentWrong(state: SimulationState, score: ScoreBreakdown): readonly string[] {
  const paragraphs: string[] = []
  const worst = rankedComponents(score.components, WRONG_THRESHOLD, 'worst')

  if (worst.length > 0) {
    paragraphs.push(worst.map((component) => component.explanation).join(' '))
  } else {
    // Nothing crossed the "genuinely weak" bar — but something is always the
    // relative weakest, and "why this score" below names it as the largest
    // gap regardless. Naming it here too, with softer language, keeps the
    // two sections from reading as contradictory.
    const weakest = [...score.components].sort((a, b) => a.raw - b.raw)[0]
    paragraphs.push(
      `Nothing here was genuinely weak, but if anything held the mandate back ` +
        `it was ${weakest.label.toLowerCase()}: ${weakest.explanation}`,
    )
  }

  if (state.guidance.brokenPromises > 0) {
    paragraphs.push(
      `${state.guidance.brokenPromises} guidance commitment(s) were broken — moved against, ` +
        'walked back with words, or left undelivered at maturity. Every future statement from ' +
        'this institution is discounted for it.',
    )
  }

  return paragraphs
}

/** Below this, the conduct gate is treated as the dominant story, not a footnote. */
const CONDUCT_GATE_DOMINANT = 0.5

function describeWhyThisScore(
  state: SimulationState,
  score: ScoreBreakdown,
  institution: Institution,
): readonly string[] {
  const inst = getInstitution(institution)
  const paragraphs: string[] = []

  // A conduct gate this severe explains the score on its own — component
  // percentages that still look reasonable would otherwise read as
  // contradicting a score this low, when the two are actually independent.
  if (score.conductGate < CONDUCT_GATE_DOMINANT) {
    const reasons: string[] = []
    if (state.reversalCount > 0) {
      reasons.push(`the rate reversed direction ${state.reversalCount} time(s)`)
    }
    if (state.contradictionCost > 0) {
      reasons.push('the statement repeatedly contradicted the decision')
    }
    if (state.guidance.brokenPromises > 0) {
      reasons.push(`${state.guidance.brokenPromises} guidance promise(s) were broken`)
    }
    paragraphs.push(
      `The mandate scored ${score.score.toLocaleString('en-US')}, most of it lost to conduct ` +
        `rather than the economy: ${reasons.join(', ')}. Erratic, self-contradictory policy is ` +
        `judged independently of how the economy happened to absorb it — the whole score was ` +
        `scaled by a further ×${score.conductGate.toFixed(2)} for it, on top of everything below.`,
    )
  }

  const biggestGap = [...score.components].sort(
    (a, b) => b.weight * (1 - b.raw) - a.weight * (1 - a.raw),
  )[0]

  paragraphs.push(
    `${score.conductGate < CONDUCT_GATE_DOMINANT ? 'Among the components, the' : 'The'} largest ` +
      `single gap between this mandate and a perfect one was ${biggestGap.label.toLowerCase()}: ` +
      biggestGap.explanation,
  )

  paragraphs.push(inst.mandateSummary)

  if (score.priceStabilityGate < 1) {
    paragraphs.push(
      `Price stability fell far enough short to trigger the mandate's own safeguard: the whole ` +
        `score was scaled by a further ×${score.priceStabilityGate.toFixed(2)} because a ` +
        'persistent miss on the primary objective cannot be bought back with strength elsewhere.',
    )
  }

  return paragraphs
}

export function buildMandateReport(
  state: SimulationState,
  outcome: EndConditionResult,
  score: ScoreBreakdown,
): MandateReport {
  const institution = state.config.institution
  return {
    whatHappened: describeWhatHappened(state, outcome, institution),
    whatWentWell: describeWhatWentWell(state, score),
    whatWentWrong: describeWhatWentWrong(state, score),
    whyThisScore: describeWhyThisScore(state, score, institution),
  }
}
