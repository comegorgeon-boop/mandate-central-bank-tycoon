import { useEffect, useState } from 'react'

/**
 * Whether this is a phone-width screen.
 *
 * ## Why a hook and not a CSS `order`
 *
 * Because the thing being reordered is a *tab strip and its panel*, and CSS
 * `order` moves what the eye sees without moving what the keyboard visits.
 * A player tabbing through a meeting would reach the panel they are looking
 * at last, after everything the layout had just moved below it — which is
 * exactly the failure WCAG's focus-order criterion names, and this project has
 * spent too long on the accessibility of this screen to introduce it as a
 * side effect of a layout preference.
 *
 * Reordering in the DOM keeps the two in step. The cost is a re-render when
 * the viewport crosses the breakpoint, which is a thing that happens when
 * somebody rotates a phone, and the groups being reordered are keyed so React
 * moves them rather than rebuilding them — a remount here would close every
 * disclosure the player had opened.
 *
 * ## The breakpoint
 *
 * 640px, which is Tailwind's `sm`, because the rest of this interface already
 * changes at it and a second breakpoint twenty pixels away would be a
 * different layout nobody designed.
 *
 * Returns false where `matchMedia` is missing — a server render, an older
 * environment, a test — because the wide layout is the one the screen was
 * designed in, and the narrow one is the accommodation.
 */
const PHONE = '(max-width: 639px)'

export function useNarrowScreen(): boolean {
  const [narrow, setNarrow] = useState(
    () => globalThis.matchMedia?.(PHONE).matches === true,
  )

  useEffect(() => {
    const query = globalThis.matchMedia?.(PHONE)
    if (query === undefined) return
    const update = () => setNarrow(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return narrow
}
