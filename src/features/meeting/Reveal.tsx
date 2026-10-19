import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion, useSettings } from '../settings/settings.ts'
import { play } from '../settings/sound.ts'

/**
 * A card turning over.
 *
 * > "LA RÉSOLUTION EST UN SPECTACLE. Le dénouement d'un pari se retourne
 * > lentement, comme une carte. Une seconde ou deux. C'est là que vit tout le
 * > plaisir."
 *
 * The outcome of a wager arrives face down and turns. Everything about the
 * timing is deliberate: a beat of nothing first, because anticipation is the
 * part being bought; then the turn; then the figure, which lands after the
 * colour so the eye knows the answer before it reads it.
 *
 * ## What it is careful about
 *
 * **Reduced motion.** The setting already governs the between-meetings
 * interval, and it governs this: with it on, the card is simply face up. The
 * information is never in the animation — the animation is in *when* you get
 * information you would have got anyway, which is the only kind of motion
 * this project allows.
 *
 * **Three flashes a second is a seizure risk, not a preference.** Nothing here
 * repeats: it is one transition, once, and then it is a static panel. A thing
 * that keeps moving becomes wallpaper in three meetings anyway.
 *
 * **It does not block.** The turn is 900 ms and the player can act through it;
 * a reveal that locked the screen would be a loading spinner wearing a
 * costume.
 */
export function Reveal({
  won,
  children,
}: {
  /** Which way it went. Decides the accent, and nothing else. */
  readonly won: boolean
  readonly children: React.ReactNode
}) {
  const { settings } = useSettings()
  // Both questions, as everywhere else in this interface: a player who asked
  // their operating system for less motion has asked every application and is
  // not required to find our menu to be heard.
  const instant = !settings.playTheInterval || prefersReducedMotion()
  const [turned, setTurned] = useState(instant)
  const timers = useRef<number[]>([])

  useEffect(() => {
    if (instant) return
    // The beat before the turn is the anticipation, and it is the thing being
    // bought. Short enough not to feel like a wait.
    timers.current.push(
      globalThis.setTimeout(() => {
        setTurned(true)
        play('reveal')
      }, 420) as unknown as number,
    )
    const held = timers.current
    return () => {
      for (const timer of held) globalThis.clearTimeout(timer)
    }
  }, [instant])

  return (
    <div
      data-reveal={won ? 'won' : 'lost'}
      data-turned={turned ? '' : undefined}
      className={[
        'mt-4 rounded-lg border p-4 transition-all duration-700 ease-out',
        turned
          ? won
            ? 'border-good bg-good-surface text-good-strong opacity-100'
            : 'border-bad bg-bad-surface text-bad-strong opacity-100'
          : 'border-edge-room bg-inset text-onwood-faint opacity-60',
      ].join(' ')}
      style={{
        // The turn itself. A rotation about the long axis reads as a card
        // rather than as a panel growing, and it is the only transform here.
        transform: turned ? 'rotateX(0deg)' : 'rotateX(-88deg)',
        transformOrigin: 'top center',
      }}
    >
      {turned ? children : <p className="text-sm">…</p>}
    </div>
  )
}
