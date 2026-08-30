/**
 * Seed handling for the setup screen.
 *
 * The seed is the only free-text input in this build. It is hashed by the
 * engine and echoed back on screen, so it is normalised to a conservative
 * charset before it ever reaches either.
 */

const SEED_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Maximum seed length kept after sanitising. */
export const MAX_SEED_LENGTH = 24

/**
 * Strips anything that is not a plain identifier character and caps the
 * length. Lower case is folded up so `abc` and `ABC` are the same economy.
 */
export function sanitizeSeed(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, MAX_SEED_LENGTH)
}

/**
 * A fresh readable seed, e.g. `K7M2-QX9P`.
 *
 * Only the *choice* of seed is random. Once chosen, the run it produces is
 * fully deterministic and replaying the seed replays the same economy.
 */
export function randomSeed(): string {
  const pick = (): string =>
    SEED_ALPHABET[Math.floor(Math.random() * SEED_ALPHABET.length)]
  const block = (): string => Array.from({ length: 4 }, pick).join('')
  return `${block()}-${block()}`
}

/** A unique identifier for one played run, used only in the result URL. */
export function makeRunId(seed: string): string {
  const stamp = Date.now().toString(36).toUpperCase()
  return `${sanitizeSeed(seed) || 'RUN'}-${stamp}`
}
