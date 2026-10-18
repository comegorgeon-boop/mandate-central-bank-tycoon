import {
  SIMULATION_VERSION,
  decodeDecisionLog,
  encodeDecisionLog,
  scoreBucketKey,
  type DecisionLog,
  type Institution,
  type Difficulty,
  type ScenarioId,
} from '../../simulation/index.ts'

/**
 * Everything this game remembers between visits, which is three things.
 *
 * ## Where it lives, and why that is the whole design
 *
 * `localStorage`. There is no server, no account and no online leaderboard —
 * that is the project's first rule, not a limitation it is working around —
 * so a record is a record *on this machine* and the interface says so in
 * those words wherever it shows one. A player who clears their browser data
 * has cleared their records, and telling them that honestly is better than
 * implying a durability nothing here can provide.
 *
 * ## Why a save is a decision log and not a state dump
 *
 * Because the engine is deterministic and already has the format. A run is
 * fully described by its configuration and the ordered packages confirmed in
 * it — `replay/decisionLog.ts` exists precisely to say so, and `replayRun`
 * reconstructs the whole mandate from one. So a save is a few hundred bytes
 * of decisions rather than a serialised latent state, it cannot drift out of
 * sync with the engine that produces it, and a log that does not replay is
 * detected rather than silently loaded into a half-wrong world.
 *
 * It also means a save made on one engine version is *refused* rather than
 * reinterpreted. That is deliberate: the alternative is resuming a mandate
 * into a model that no longer behaves the way the first half of it did.
 *
 * ## Reading is always allowed to fail
 *
 * A private window, a browser set to block site data, a quota that is full:
 * every one of these throws rather than returning null. Every access here is
 * wrapped, and every failure degrades to "there is nothing saved", which is a
 * state the interface already has to handle.
 */

const SAVE_KEY = 'mandate.save.v1'
const RECORDS_KEY = 'mandate.records.v1'
const ACHIEVEMENTS_KEY = 'mandate.achievements.v1'
const GUIDE_KEY = 'mandate.guide-seen.v1'

/** The most finished mandates kept per bucket. */
const PER_BUCKET = 5

/** A mandate in progress, as it sits in storage. */
export interface SavedRun {
  readonly savedAt: string
  readonly meetingsServed: number
  readonly encoded: string
  readonly institution: Institution
  readonly difficulty: Difficulty
  readonly scenario: ScenarioId | null
  readonly seed: string
}

/** One finished mandate, kept for the records table. */
export interface RecordEntry {
  readonly finishedAt: string
  readonly score: number
  readonly outcome: string
  readonly outcomeLabel: string
  readonly meetingsServed: number
  readonly meetingCount: number
  readonly seed: string
  readonly institution: Institution
  readonly difficulty: Difficulty
  readonly scenario: ScenarioId | null
  /** Which bucket this belongs to. Buckets are never compared. */
  readonly bucket: string
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(key)
    if (raw === null || raw === undefined) return fallback
    const parsed: unknown = JSON.parse(raw)
    return (parsed ?? fallback) as T
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value))
  } catch {
    // A full quota or a browser that will not let us write is not worth
    // failing a render over. The run continues; it is simply not remembered.
  }
}

/** Store the mandate in progress, replacing whatever was there. */
export function saveRun(log: DecisionLog): void {
  const encoded = encodeDecisionLog(log)
  const save: SavedRun = {
    savedAt: new Date().toISOString(),
    meetingsServed: log.decisions.length,
    encoded,
    institution: log.institution,
    difficulty: log.difficulty,
    scenario: log.scenario,
    seed: log.seed,
  }
  write(SAVE_KEY, save)
}

/**
 * The mandate in progress, if there is one this engine can still replay.
 *
 * Returns null — and clears the save — when the stored log was written by a
 * different engine version or no longer decodes. A refusal here is the honest
 * outcome: resuming into a model that has changed underneath the first half
 * of a mandate would produce a run whose own history did not happen.
 */
export function loadSave(): { readonly save: SavedRun; readonly log: DecisionLog } | null {
  const save = read<SavedRun | null>(SAVE_KEY, null)
  if (save === null || typeof save.encoded !== 'string') return null

  const decoded = decodeDecisionLog(save.encoded)
  if (!decoded.ok || decoded.log.simulationVersion !== SIMULATION_VERSION) {
    clearSave()
    return null
  }
  return { save, log: decoded.log }
}

export function clearSave(): void {
  try {
    globalThis.localStorage?.removeItem(SAVE_KEY)
  } catch {
    // Nothing to do, and nothing worth failing over.
  }
}

/** Every finished mandate this browser remembers, newest first. */
export function readRecords(): readonly RecordEntry[] {
  const stored = read<RecordEntry[]>(RECORDS_KEY, [])
  if (!Array.isArray(stored)) return []
  return stored.filter(
    (entry): entry is RecordEntry =>
      entry !== null &&
      typeof entry === 'object' &&
      typeof entry.score === 'number' &&
      typeof entry.bucket === 'string',
  )
}

/**
 * Remember a finished mandate.
 *
 * Kept per bucket and capped, because the point of a record is comparison and
 * a bucket is the only thing comparable: an easy Fed mandate and a 1929
 * mandate are not two attempts at the same problem, and the project has said
 * so since the scoring was written. A list of every run ever played, sorted
 * by score, would put them on one ladder and teach the opposite.
 */
export function recordResult(entry: Omit<RecordEntry, 'bucket' | 'finishedAt'>): void {
  const bucket =
    entry.scenario ??
    scoreBucketKey(entry.institution, entry.difficulty, SIMULATION_VERSION)
  const full: RecordEntry = {
    ...entry,
    bucket,
    finishedAt: new Date().toISOString(),
  }

  const existing = readRecords()
  const sameBucket = [...existing.filter((row) => row.bucket === bucket), full]
    .sort((a, b) => b.score - a.score)
    .slice(0, PER_BUCKET)
  const others = existing.filter((row) => row.bucket !== bucket)
  write(RECORDS_KEY, [...sameBucket, ...others])
}

export function clearRecords(): void {
  try {
    globalThis.localStorage?.removeItem(RECORDS_KEY)
  } catch {
    // As above.
  }
}

/**
 * Achievements earned on this device, with the date each was first earned.
 *
 * Earned-ness is monotone: a later mandate that does not repeat a feat does
 * not take it away. That is the one piece of state here that is *not* derived
 * from a single run — the runs are, and this is the union of them — so it is
 * stored rather than recomputed.
 */
export function readAchievements(): Readonly<Record<string, string>> {
  const stored = read<Record<string, string>>(ACHIEVEMENTS_KEY, {})
  return stored !== null && typeof stored === 'object' ? stored : {}
}

/** Record newly earned achievements. Returns the ones that are new. */
export function recordAchievements(ids: readonly string[]): readonly string[] {
  const existing = readAchievements()
  const fresh = ids.filter((id) => existing[id] === undefined)
  if (fresh.length === 0) return []
  const now = new Date().toISOString()
  write(ACHIEVEMENTS_KEY, {
    ...existing,
    ...Object.fromEntries(fresh.map((id) => [id, now])),
  })
  return fresh
}

/**
 * Whether this browser has been shown what a meeting is.
 *
 * One flag, set the moment the explanation opens rather than when it is
 * dismissed: a player who reloads halfway through it has already seen it, and
 * an explanation that comes back after a refresh is a bug the player cannot
 * report in any way that sounds like one.
 */
export function hasSeenGuide(): boolean {
  return read<boolean>(GUIDE_KEY, false) === true
}

export function markGuideSeen(): void {
  write(GUIDE_KEY, true)
}

export function clearGuideSeen(): void {
  try {
    globalThis.localStorage?.removeItem(GUIDE_KEY)
  } catch {
    // As above.
  }
}

export function clearAchievements(): void {
  try {
    globalThis.localStorage?.removeItem(ACHIEVEMENTS_KEY)
  } catch {
    // As above.
  }
}

/** Which historical scenarios have been served to term on this device. */
export function scenariosCompleted(): ReadonlySet<string> {
  const done = new Set<string>()
  for (const entry of readRecords()) {
    if (entry.scenario !== null && entry.outcome === 'mandate_completed') {
      done.add(entry.scenario)
    }
  }
  return done
}

/** The best score in each bucket, keyed by bucket. */
export function bestByBucket(): ReadonlyMap<string, RecordEntry> {
  const best = new Map<string, RecordEntry>()
  for (const entry of readRecords()) {
    const current = best.get(entry.bucket)
    if (current === undefined || entry.score > current.score) best.set(entry.bucket, entry)
  }
  return best
}
