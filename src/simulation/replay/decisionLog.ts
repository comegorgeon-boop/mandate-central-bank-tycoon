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
import type { OperatingProcedure, ScenarioId } from '../types/scenario.ts'
import { tenureHorizon } from '../config/tenure.ts'
import { getInstrument } from '../config/instruments.ts'
import { SCENARIOS } from '../scenarios/scenarios.ts'
import { createRunConfig } from '../engine/initialState.ts'

/** On the wire, "this run is not a scenario". */
const NO_SCENARIO = '-'

const SCENARIO_IDS: readonly string[] = SCENARIOS.map((scenario) => scenario.id)

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
  /**
   * The historical scenario, if the run is one.
   *
   * Carried because a scenario run is not reproducible without it: the
   * opening state is the scenario's sourced table rather than a seeded draw,
   * so a log that recorded only the seed would replay a different economy.
   * `-` on the wire when there is none.
   */
  readonly scenario: ScenarioId | null
  readonly seed: string
  readonly decisions: readonly DecisionLogEntry[]
}

export type DecodeResult =
  | { readonly ok: true; readonly log: DecisionLog }
  | { readonly ok: false; readonly error: string }

// Bumped from MCBT1 when the scenario field was added. An MCBT1 log cannot
// be read as an MCBT2 one — it is a field short — and rejecting it is correct:
// this build stores nothing, so there are no old logs to migrate.
const FORMAT_TAG = 'MCBT2'
const FIELD_SEPARATOR = '~'
const MEETING_SEPARATOR = '|'
const ACTION_SEPARATOR = ';'
const COMMUNICATION_PREFIX = '!'
/** Marks the one-off operating-procedure decision inside a meeting slot. */
const PROCEDURE_PREFIX = '@'
const COMMUNICATION_SEPARATOR = '.'

/**
 * Marks a meeting at which the committee deliberately decided nothing.
 *
 * An explicit hold is a decision and must survive the round trip. Without a
 * marker it would encode to an empty slot, decode as "no decision recorded",
 * and shift every later decision onto the wrong meeting during replay.
 */
const EMPTY_PACKAGE = '-'

/**
 * Percent-encodes a seed, including the characters `encodeURIComponent`
 * leaves alone. `~` in particular is a field separator here, so a seed
 * containing one would otherwise split the record apart.
 */
function encodeSeed(seed: string): string {
  return encodeURIComponent(seed).replace(
    /[~!.*'()]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}

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
  // Last, so the two optional blocks can be split off in a fixed order.
  const procedure =
    pkg.procedure == null ? '' : PROCEDURE_PREFIX + (pkg.procedure === 'reserve_target' ? 'r' : 't')
  const encoded = actions + communication + procedure
  return encoded.length === 0 ? EMPTY_PACKAGE : encoded
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
    log.scenario ?? NO_SCENARIO,
    encodeSeed(log.seed),
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
  if (raw === EMPTY_PACKAGE) return { actions: [], communication: null }

  const procedureAt = raw.indexOf(PROCEDURE_PREFIX)
  let procedure: OperatingProcedure | null = null
  if (procedureAt >= 0) {
    const code = raw.slice(procedureAt + 1)
    if (code !== 'r' && code !== 't') {
      return `Meeting ${meetingIndex}: malformed operating procedure "${code}".`
    }
    procedure = code === 'r' ? 'reserve_target' : 'rate_target'
    raw = raw.slice(0, procedureAt)
  }

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

  return procedure === null
    ? { actions, communication }
    : { actions, communication, procedure }
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
  if (fields.length !== 8) {
    return { ok: false, error: 'Decision log does not have the expected structure.' }
  }

  const [tag, simulationVersion, institution, difficulty, mode, scenario, seed, meetings] =
    fields

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
  if (scenario !== NO_SCENARIO && !SCENARIO_IDS.includes(scenario as ScenarioId)) {
    return { ok: false, error: `Unknown scenario "${scenario}".` }
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
  /*
   * The cap is the institution's tenure horizon, not the difficulty's length.
   *
   * Length stopped being a property of the difficulty when the structure
   * became survival — a Fed Chair term is four years whether the economy is
   * kind or not — and this check was the last place still asking the
   * difficulty how long a mandate is. The symptom was precise and extremely
   * misleading: a perfectly good ECB log of 40 meetings was rejected because
   * `MEETING_COUNT.medium` is 16, and the determinism round-trip test
   * reported that the engine could not reproduce its own run.
   */
  const limit = tenureHorizon(institution as Institution)
  if (slots.length > limit) {
    return {
      ok: false,
      error: `Decision log holds ${slots.length} meetings, more than the ${limit} a ${institution} tenure can run to.`,
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
      scenario: scenario === NO_SCENARIO ? null : (scenario as ScenarioId),
      seed: decodedSeed,
      decisions,
    },
  }
}

/** The RunConfig a decoded log describes. */
export function configFromLog(log: DecisionLog): RunConfig {
  if (log.scenario !== null) {
    // A scenario owns its institution, its rules and its length, so the log's
    // own fields are not consulted for any of them: rebuilding through
    // `createRunConfig` is the only way the two can never drift apart.
    return createRunConfig({
      institution: log.institution,
      difficulty: log.difficulty,
      seed: log.seed,
      simulationVersion: log.simulationVersion,
      scenario: log.scenario,
    })
  }
  return {
    simulationVersion: log.simulationVersion,
    institution: log.institution,
    difficulty: log.difficulty,
    seed: log.seed,
    mode: log.mode,
    // The horizon, matching `createRunConfig`. A log that rebuilt a different
    // horizon from the one the run was played under would replay a different
    // game — which is the one thing this module exists to make impossible.
    meetingCount: tenureHorizon(log.institution),
    scenario: null,
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
    scenario: config.scenario,
    seed: config.seed,
    decisions: [],
  })
}
