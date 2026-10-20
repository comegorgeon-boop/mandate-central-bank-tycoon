import { useEffect, useRef, useState } from 'react'
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type Transition,
} from 'motion/react'

/**
 * The movement vocabulary, in one file so it can be tuned in one place.
 *
 * Every timing here is a named constant rather than a number at a call site,
 * because the whole point of `pages/MotionLab.tsx` is that these are set by
 * watching them replay side by side rather than by guessing inside a mandate.
 *
 * Reduced motion is honoured by every export: the value arrives, the flash
 * does not happen, the chip is simply where it lands. Nothing here carries
 * information that is not also in the final state.
 */

/** A spring with weight, for anything that physically moves. */
export const SPRING: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 26,
  mass: 0.9,
}

/** Looser, for a chip thrown onto a table. It should overshoot and settle. */
export const THROW: Transition = {
  type: 'spring',
  stiffness: 260,
  damping: 14,
  mass: 1.1,
}

/** How long a figure takes to count to its new value. */
export const ROLL_MS = 420

/** How long a changed figure stays lit. */
export const FLASH_MS = 500

/** The beat before a result, because the wait is the pleasure. */
export const SUSPENSE_MS = 360

/**
 * A figure that rolls to its value instead of appearing at it.
 *
 * A number that cuts is a number that was computed. A number that runs up to
 * its value is a number that was *counted*, which is what a bet slip does and
 * what a ticker does, and it costs four hundred milliseconds.
 */
export function RollingNumber({
  value,
  decimals = 2,
  className,
  prefix = '',
  suffix = '',
}: {
  readonly value: number
  readonly decimals?: number
  readonly className?: string
  readonly prefix?: string
  readonly suffix?: string
}) {
  const reduced = useReducedMotion()
  const motionValue = useMotionValue(value)
  const text = useTransform(motionValue, (latest) => {
    const shown = latest.toFixed(decimals)
    return `${prefix}${shown}${suffix}`
  })

  useEffect(() => {
    if (reduced) {
      motionValue.set(value)
      return
    }
    const controls = animate(motionValue, value, {
      duration: ROLL_MS / 1000,
      ease: [0.16, 1, 0.3, 1],
    })
    return () => controls.stop()
  }, [value, motionValue, reduced])

  return <motion.span className={className}>{text}</motion.span>
}

/**
 * Lights a figure for half a second when it changes, green up, claret down.
 *
 * The rule the whole interface is held to: **light marks the change, never
 * the state.** A panel that is permanently coloured is wallpaper in three
 * meetings; a figure that flares for five hundred milliseconds and goes back
 * to ink is a thing the eye catches and then stops seeing.
 */
export function useChangeFlash(value: number): 'up' | 'down' | null {
  const previous = useRef(value)
  const [flash, setFlash] = useState<'up' | 'down' | null>(null)

  useEffect(() => {
    const was = previous.current
    previous.current = value
    if (value === was) return
    setFlash(value > was ? 'up' : 'down')
    const timer = globalThis.setTimeout(() => setFlash(null), FLASH_MS)
    return () => globalThis.clearTimeout(timer)
  }, [value])

  return flash
}

/**
 * A chip thrown onto the table.
 *
 * It arrives from above and to the side, overshoots, and settles — which is
 * what a thrown disc does, and is three lines of spring rather than a
 * keyframe sequence anyone has to maintain.
 */
export function ThrownChip({
  children,
  index = 0,
}: {
  readonly children: React.ReactNode
  /** Position in the stack. Each lands a beat after the one before. */
  readonly index?: number
}) {
  const reduced = useReducedMotion()
  if (reduced) return <span>{children}</span>

  return (
    <motion.span
      style={{ display: 'inline-block' }}
      initial={{ x: 26, y: -34, rotate: -40, opacity: 0 }}
      animate={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
      transition={{ ...THROW, delay: index * 0.065 }}
    >
      {children}
    </motion.span>
  )
}

/**
 * A short, dry shake. For the meeting a crisis lands in, and nothing else.
 *
 * Two hundred milliseconds and four decreasing excursions — any longer reads
 * as an effect rather than an impact. It never repeats: the brief this comes
 * from is explicit that nothing flashes more than three times a second, which
 * is a safety rule for photosensitive players rather than a preference, and
 * the safest version of that rule is to shake once and stop.
 */
export function useShake(trigger: unknown): { readonly x: number } | false {
  const reduced = useReducedMotion()
  const x = useSpring(0, { stiffness: 1400, damping: 14 })
  const first = useRef(true)

  useEffect(() => {
    if (reduced) return
    if (first.current) {
      first.current = false
      return
    }
    let cancelled = false
    const steps = [7, -5, 3, -1.5, 0]
    steps.forEach((value, index) => {
      globalThis.setTimeout(() => {
        if (!cancelled) x.set(value)
      }, index * 42)
    })
    return () => {
      cancelled = true
    }
  }, [trigger, x, reduced])

  return reduced ? false : ({ x } as unknown as { readonly x: number })
}

/**
 * A result that turns over like a card, after a beat of nothing.
 *
 * The dead time is the thing being bought. Without it there is no moment
 * where you are hoping — the outcome is simply the next thing on the screen,
 * which is how a settled wager came to read as a readout. Three hundred and
 * sixty milliseconds of nothing, then the card turns.
 *
 * `delay` and `stiffness` are props rather than constants so `/lab` can
 * replay this at any setting; the defaults are the tuned ones.
 */
export function Flip({
  children,
  delayMs = SUSPENSE_MS,
  spring = SPRING,
}: {
  readonly children: React.ReactNode
  readonly delayMs?: number
  readonly spring?: Transition
}) {
  const reduced = useReducedMotion()
  if (reduced) return <>{children}</>
  return (
    <motion.div
      initial={{ rotateX: -88, opacity: 0.35 }}
      animate={{ rotateX: 0, opacity: 1 }}
      transition={{ ...spring, delay: delayMs / 1000 }}
      style={{ transformOrigin: 'top center' }}
    >
      {children}
    </motion.div>
  )
}

/**
 * A total that counts up digit by digit after the card has turned.
 *
 * Deliberately *not* `RollingNumber`: that eases to its value and settles,
 * which is right for a live reading under your thumb and wrong for a
 * settlement. A score being banked should tick — a discrete, even,
 * mechanical count, like a meter — because what it is saying is *this many,
 * one at a time*, and the counting is the reward.
 */
export function Tally({
  value,
  decimals = 0,
  durationMs = 900,
  delayMs = SUSPENSE_MS,
  className,
  prefix = '',
  suffix = '',
}: {
  readonly value: number
  readonly decimals?: number
  readonly durationMs?: number
  readonly delayMs?: number
  readonly className?: string
  readonly prefix?: string
  readonly suffix?: string
}) {
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(reduced ? value : 0)

  useEffect(() => {
    if (reduced) {
      setShown(value)
      return
    }
    let frame = 0
    let start = 0
    let timer = 0
    const step = (now: number) => {
      if (start === 0) start = now
      const t = Math.min(1, (now - start) / durationMs)
      // Even, not eased. A meter does not decelerate.
      setShown(value * t)
      if (t < 1) frame = requestAnimationFrame(step)
    }
    timer = globalThis.setTimeout(() => {
      frame = requestAnimationFrame(step)
    }, delayMs)
    return () => {
      globalThis.clearTimeout(timer)
      if (frame !== 0) cancelAnimationFrame(frame)
    }
  }, [value, durationMs, delayMs, reduced])

  return (
    <span className={className}>
      {prefix}
      {shown.toFixed(decimals)}
      {suffix}
    </span>
  )
}

export { motion, useReducedMotion }
