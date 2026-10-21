import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Every screen opens at the top.
 *
 * > "Quand j'entre dans une réunion la page s'ouvre au milieu et je dois
 * > scroller VERS LE HAUT pour lire l'ordre. On ne doit JAMAIS avoir à
 * > remonter : chaque écran s'ouvre en haut, et la ligne d'ordre est la
 * > première chose visible."
 *
 * The browser restores the previous scroll position when a route changes
 * inside a single-page app, which is correct for a document you are
 * returning to and wrong for a screen you are arriving at. On a phone it put
 * the player in the middle of a meeting with the one line that says what to
 * do somewhere above them — and a player who has to scroll *up* to find the
 * instruction has been given no instruction.
 *
 * `scrollRestoration = 'manual'` stops the browser doing it on a back
 * navigation as well, which is the same problem wearing a different hat.
 */
export function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    if ('scrollRestoration' in globalThis.history) {
      globalThis.history.scrollRestoration = 'manual'
    }
  }, [])

  useEffect(() => {
    // `instant`, not smooth: a screen that scrolls itself into place in front
    // of the player is an animation nobody asked for, and on a long meeting
    // page it is a second of motion before anything can be read.
    globalThis.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname])

  return null
}
