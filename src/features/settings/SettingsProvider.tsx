import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  DEFAULT_SETTINGS,
  SettingsContext,
  loadSettings,
  saveSettings,
  type Settings,
} from './settings.ts'

/**
 * Holds the player's settings and puts the visual direction on the document.
 *
 * The direction is applied as `data-direction` on `<html>` rather than being
 * threaded through components, because the token layer is published with
 * `@theme inline`: every utility already resolves its variable at use time, so
 * one attribute on an ancestor re-themes everything beneath it. No component
 * knows the setting exists.
 */
export function SettingsProvider({ children }: { readonly children: ReactNode }) {
  // Lazily, so the read happens once and never during a render pass.
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      return loadSettings()
    } catch {
      return DEFAULT_SETTINGS
    }
  })

  useEffect(() => {
    const root = globalThis.document?.documentElement
    if (root === undefined) return
    // The default direction is the absence of the attribute, so the stylesheet
    // has one code path for it rather than two.
    if (settings.direction === 'after-hours') {
      root.removeAttribute('data-direction')
    } else {
      root.setAttribute('data-direction', settings.direction)
    }
  }, [settings.direction])

  const value = useMemo(
    () => ({
      settings,
      update: (patch: Partial<Settings>) =>
        setSettings((current) => {
          const next = { ...current, ...patch }
          saveSettings(next)
          return next
        }),
    }),
    [settings],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}
