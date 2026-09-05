import { createContext, useContext } from 'react'

/**
 * Player settings.
 *
 * Small, and deliberately not part of the run: nothing here can change what
 * the engine computes. A setting that altered the simulation would make two
 * players' scores incomparable and would have to be bucketed like a difficulty,
 * which is a much larger idea than a preferences menu. Everything here changes
 * only how the same computed run is *presented*.
 *
 * Stored in `localStorage`, which is client-side and therefore inside the
 * mandate's no-network rule. Reads are wrapped because a private window, or a
 * browser set to block site data, throws rather than returning null.
 */

export type VisualDirection = 'papers-on-the-table' | 'after-hours'

export interface Settings {
  /** Which of the two visual directions the room is dressed in. */
  readonly direction: VisualDirection
  /**
   * Whether the interval between meetings plays out, or arrives already over.
   *
   * Off is a real choice rather than an accessibility fallback — a player on
   * their fortieth mandate does not need to watch three seconds of quarter
   * pass. `prefers-reduced-motion` is honoured separately and unconditionally.
   */
  readonly playTheInterval: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  direction: 'papers-on-the-table',
  playTheInterval: true,
}

const STORAGE_KEY = 'mandate.settings.v1'

export function loadSettings(): Settings {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (raw === null || raw === undefined) return DEFAULT_SETTINGS
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_SETTINGS
    const candidate = parsed as Partial<Settings>
    return {
      direction:
        candidate.direction === 'after-hours' ? 'after-hours' : 'papers-on-the-table',
      playTheInterval: candidate.playTheInterval !== false,
    }
  } catch {
    // A browser that will not let us read is a browser that gets the defaults.
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: Settings): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Nothing here is worth failing a render over.
  }
}

export interface SettingsContextValue {
  readonly settings: Settings
  readonly update: (patch: Partial<Settings>) => void
}

export const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  update: () => {},
})

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext)
}

/**
 * Whether the reader has asked for less motion.
 *
 * Read at call time rather than cached: a player can change it mid-mandate,
 * and an interface that only checked at mount would keep animating at them.
 */
export function prefersReducedMotion(): boolean {
  try {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  } catch {
    return false
  }
}

/**
 * Whether the interval should actually play, for this player, right now.
 *
 * The setting and the media query are separate questions and both must say
 * yes. A player who has asked their operating system for less motion has asked
 * every application, and is not required to find our menu to be heard.
 */
export function shouldPlayInterval(settings: Settings): boolean {
  return settings.playTheInterval && !prefersReducedMotion()
}
