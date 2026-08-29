import type { Difficulty, GameMode, Institution, RunConfig } from '../types/core.ts'
import type {
  CommunicationChannel,
  CommunicationChoice,
  CommunicationCommitment,
  CommunicationEmphasis,
  CommunicationTone,
  InstrumentId,
  PolicyAction,
  PolicyPackage,
} from '../types/policy.ts'
import { MEETING_COUNT } from '../config/time.ts'
import { getInstrument } from '../config/instruments.ts'

/**
 * Compact, validated serialisation of a run's decisions.
 *
 * A run is fully reproducible from its simulation version, seed, institution,
 * difficulty and the ordered list of decisions, so that is exactly what this
 * encodes — and nothing else. No state, no results, no personal data.
 *
 * Everything that comes back in is validated before use. A log is untrusted
 * input: it may have been hand-edited, truncated, or produced by a different
 * engine version.
 */

export interface DecisionLogEntry {
  readonly meetingIndex: number
  readonly package: PolicyPackage
}

export interface DecisionLog {
  readonly simulationVersion: string
  readonly institution: Institution
  readonly difficulty: Difficulty
  readonly mode: GameMode
  readonly seed: string
  readonly decisions: readonly DecisionLogEntry[]
}

export type DecodeResult =
  | { readonly ok: true; readonly log: DecisionLog }
  | { readonly ok: false; readonly error: string }

const FORMAT_TAG = 'MCBT1'
const FIELD_SEPARATOR = '~'
const MEETING_SEPARATOR = '|'
const ACTION_SEPARATOR = ';'
const COMMUNICATION_PREFIX = '!'
const COMMUNICATION_SEPARATOR = '.'

/** Short codes keep challenge strings and saved logs small. */
const INSTRUMENT_CODES: Readonly<Record<InstrumentId, string>> = {
  policy_rate: 'pr',
  asset_purchases: 'ap',
  balance_sheet_runoff: 'ro',
  forward_guidance: 'fg',
  iorb_spread: 'io',
  discount_window: 'dw',
  reverse_repo: 'rr',
  swap_lines: 'sl',
  deposit_facility_spread: 'df',
  minimum_reserves: 'mr',
  targeted_refinancing: 'tr',
  transmission_protection: 'tp',
}

const CODE_TO_INSTRUMENT = new Map<string, InstrumentId>(
  (Object.entries(INSTRUMENT_CODES) as [InstrumentId, string][]).map(
    ([id, code]) => [code, id],
  ),
)

const TONES: readonly CommunicationTone[] = [
  'hawkish',
  'neutral',
  'dovish',
  'reassuring',
  'alarmed',
]
const EMPHASES: readonly CommunicationEmphasis[] = [
  'inflation',
  'employment',
  'growth',
  'financial_stability',
  'uncertainty',
  'data_dependence',
]
const COMMITMENTS: readonly CommunicationCommitment[] = [
  'none',
  'weak_bias',
  'conditional_path',
  'strong_commitment',
]
const CHANNELS: readonly CommunicationChannel[] = [
  'statement',
  'press_conference',
  'speech',
  'social_post',
]

const INSTITUTIONS: readonly Institution[] = ['fed', 'ecb']
const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard']
const MODES: readonly GameMode[] = ['fictional', 'historical', 'alternate_history']

function encodeCommunication(communication: CommunicationChoice): string {
  return [
    TONES.indexOf(communication.tone),
    EMPHASES.indexOf(communication.emphasis),
    COMMITMENTS.indexOf(communication.commitment),
    CHANNELS.indexOf(communication.channel),
  ].join(COMMUNICATION_SEPARATOR)
}

function encodePackage(pkg: PolicyPackage): string {
  const actions = pkg.actions
    .map((action) => `${INSTRUMENT_CODES[action.instrument] ?? action.instrument}=${action.magnitude}`)
    .join(ACTION_SEPARATOR)
  const communication = pkg.communication
    ? COMMUNICATION_PREFIX + encodeCommunication(pkg.communication)
    : ''
  return actions + communication
}

export function encodeDecisionLog(log: DecisionLog): string {
  // Decisions are stored densely by meeting index, so a skipped meeting
  // survives the round trip as an empty slot rather than shifting the rest.
  const meetingCount = log.decisions.reduce(
    (highest, entry) => Math.max(highest, entry.meetingIndex + 1),
    0,
  )
  const slots = new Array<string>(meetingCount).fill('')
  for (const entry of log.decisions) {
    slots[entry.meetingIndex] = encodePackage(entry.package)
  }

  return [
    FORMAT_TAG,
    log.simulationVersion,
    log.institution,
    log.difficulty,
    log.mode,
    encodeURIComponent(log.seed),
    slots.join(MEETING_SEPARATOR),
  ].join(FIELD_SEPARATOR)
}

function decodeCommunication(raw: string): CommunicationChoice | null {
  const parts = raw.split(COMMUNICATION_SEPARATOR)
  if (parts.length !== 4) return null

  const [tone, emphasis, commitment, channel] = parts.map((part) => Number(part))
  if (![tone, emphasis, commitment, channel].every(Number.isInteger)) return null

  const choice = {
    tone: TONES[tone],
    emphasis: EMPHASES[emphasis],
    commitment: COMMITMENTS[commitment],
    channel: CHANNELS[channel],
  }
  if (
    choice.tone === undefined ||
    choice.emphasis === undefined ||
    choice.commitment === undefined ||
    choice.channel === undefined
  ) {
    return null
  }
  return choice
}

function decodePackage(raw: string, meetingIndex: number): PolicyPackage | string {
  const communicationAt = raw.indexOf(COMMUNICATION_PREFIX)
  const actionsPart = communicationAt >= 0 ? raw.slice(0, communicationAt) : raw
  const communicationPart =
    communicationAt >= 0 ? raw.slice(communicationAt + 1) : null

  const actions: PolicyAction[] = []
  if (actionsPart.length > 0) {
    for (const chunk of actionsPart.split(ACTION_SEPARATOR)) {
      if (chunk.length === 0) continue
      const equals = chunk.indexOf('=')
      if (equals <= 0) return `Meeting ${meetingIndex}: malformed action "${chunk}".`

      const code = chunk.slice(0, equals)
      const instrument = CODE_TO_INSTRUMENT.get(code)
      if (!instrument || !getInstrument(instrument)) {
        return `Meeting ${meetingIndex}: unknown instrument code "${code}".`
      }

      const magnitude = Number(chunk.slice(equals + 1))
      if (!Number.isFinite(magnitude)) {
        return `Meeting ${meetingIndex}: non-finite magnitude for "${code}".`
      }

      actions.push({ instrument, magnitude })
    }
  }

  let communication: CommunicationChoice | null = null
  if (communicationPart !== null) {
    communication = decodeCommunication(communicationPart)
    if (communication === null) {
      return `Meeting ${meetingIndex}: malformed communication block.`
    }
  }

  return { actions, communication }
}

/**
 * Parses an encoded log.
 *
 * Rejects rather than throws, and never returns a partially trusted object:
 * either every field validated, or the caller gets an error string it can
 * show the player.
 */
export function decodeDecisionLog(encoded: unknown): DecodeResult {
  if (typeof encoded !== 'string') {
    return { ok: false, error: 'A decision log must be a string.' }
  }
  if (encoded.length > 20000) {
    return { ok: false, error: 'Decision log is implausibly large.' }
  }

  const fields = encoded.split(FIELD_SEPARATOR)
  if (fields.length !== 7) {
    return { ok: false, error: 'Decision log does not have the expected structure.' }
  }

  const [tag, simulationVersion, institution, difficulty, mode, seed, meetings] = fields

  if (tag !== FORMAT_TAG) {
    return { ok: false, error: `Unrecognised decision log format "${tag}".` }
  }
  if (simulationVersion.length === 0 || simulationVersion.length > 32) {
    return { ok: false, error: 'Missing or implausible simulation version.' }
  }
  if (!INSTITUTIONS.includes(institution as Institution)) {
    return { ok: false, error: `Unknown institution "${institution}".` }
  }
  if (!DIFFICULTIES.includes(difficulty as Difficulty)) {
    return { ok: false, error: `Unknown difficulty "${difficulty}".` }
  }
  if (!MODES.includes(mode as GameMode)) {
    return { ok: false, error: `Unknown game mode "${mode}".` }
  }

  let decodedSeed: string
  try {
    decodedSeed = decodeURIComponent(seed)
  } catch {
    return { ok: false, error: 'Seed is not valid percent-encoded text.' }
  }
  if (decodedSeed.length === 0 || decodedSeed.length > 128) {
    return { ok: false, error: 'Seed is missing or implausibly long.' }
  }

  const slots = meetings.length === 0 ? [] : meetings.split(MEETING_SEPARATOR)
  const limit = MEETING_COUNT[difficulty as Difficulty]
  if (slots.length > limit) {
    return {
      ok: false,
      error: `Decision log holds ${slots.length} meetings, more than the ${limit} of a ${difficulty} mandate.`,
    }
  }

  const decisions: DecisionLogEntry[] = []
  for (let index = 0; index < slots.length; index += 1) {
    if (slots[index].length === 0) continue
    const decoded = decodePackage(slots[index], index)
    if (typeof decoded === 'string') return { ok: false, error: decoded }
    decisions.push({ meetingIndex: index, package: decoded })
  }

  return {
    ok: true,
    log: {
      simulationVersion,
      institution: institution as Institution,
      difficulty: difficulty as Difficulty,
      mode: mode as GameMode,
      seed: decodedSeed,
      decisions,
    },
  }
}

/** The RunConfig a decoded log describes. */
export function configFromLog(log: DecisionLog): RunConfig {
  return {
    simulationVersion: log.simulationVersion,
    institution: log.institution,
    difficulty: log.difficulty,
    seed: log.seed,
    mode: log.mode,
    meetingCount: MEETING_COUNT[log.difficulty],
  }
}

/**
 * A challenge code: the run setup with no decisions attached.
 *
 * Contains institution, difficulty, simulation version and seed, and nothing
 * else — no nickname, no score, no personal data.
 */
export function encodeChallenge(config: RunConfig): string {
  return encodeDecisionLog({
    simulationVersion: config.simulationVersion,
    institution: config.institution,
    difficulty: config.difficulty,
    mode: config.mode,
    seed: config.seed,
    decisions: [],
  })
}
