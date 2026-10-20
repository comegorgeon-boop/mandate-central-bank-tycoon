/**
 * A chip, a seal and a serial number: the rest of the furniture.
 *
 * All three are drawn rather than styled, for the same reason the guilloché
 * is. A CSS circle with a border is a circle; a chip is a disc with milled
 * edge inserts, a recessed face and a ring of engine-turning, and the
 * difference between the two is the difference between a web page and a game.
 */

/**
 * A casino chip, seen flat on.
 *
 * The edge inserts are the thing that makes it read as a chip rather than a
 * counter: six rectangles around the rim, in the reverse colour. The inner
 * ring and the recessed face are what the moulding actually does.
 */
export function Chip({
  size = 22,
  tone = 'brass',
  className,
}: {
  readonly size?: number
  /** Which of the two accents, or the warm tone for a stake. */
  readonly tone?: 'brass' | 'good' | 'bad'
  readonly className?: string
}) {
  const face =
    tone === 'good'
      ? 'var(--good-on-dark)'
      : tone === 'bad'
        ? 'var(--bad-on-dark)'
        : 'var(--accent-on-dark)'

  // The edge inserts are what makes a disc read as a *chip*. But they are
  // also notches cut out of its silhouette, and below about twenty pixels
  // they eat enough of the rim that the thing reads as a flower rather than
  // as a counter — which is exactly what the first stack of 16 px chips
  // looked like. So they shorten as the chip does, and below 18 px there are
  // none: at that size the disc and its milled ring carry it alone.
  const detail = size >= 18
  const inserts = []
  if (detail) {
    for (let index = 0; index < 6; index += 1) {
      const angle = (index / 6) * 360
      inserts.push(
        <rect
          key={index}
          x="-1.5"
          y="-15.8"
          width="3"
          height={size >= 26 ? 4.6 : 3.4}
          rx="0.4"
          fill="var(--color-vault)"
          transform={`rotate(${angle})`}
        />,
      )
    }
  }

  return (
    <svg
      viewBox="-18 -18 36 36"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <circle r="15.6" fill={face} />
      {inserts}
      {/* The recessed face, the milled ring around it, and the core. */}
      <circle
        r="10.4"
        fill="none"
        stroke="var(--color-vault)"
        strokeWidth="1.3"
        opacity="0.75"
      />
      <circle r="8.4" fill="var(--color-vault)" opacity="0.3" />
      <circle r="3.1" fill="var(--color-vault)" opacity="0.5" />
      <circle
        r="15.2"
        fill="none"
        stroke="var(--color-vault)"
        strokeWidth="0.8"
        opacity="0.45"
      />
    </svg>
  )
}

/**
 * The seal a note carries beside the denomination.
 *
 * A toothed ring — the die's own edge — around a star, with the institution's
 * initials. Nothing here is any real central bank's seal: the shape is the
 * generic one every treasury has used for two centuries.
 */
export function Seal({
  size = 54,
  letters = 'MCB',
  opacity = 1,
  className,
}: {
  readonly size?: number
  /** Up to four characters. Longer will not fit the die. */
  readonly letters?: string
  /**
   * How loud the die is, 0 to 1.
   *
   * A prop rather than an `opacity-*` class on the caller, because the lint
   * rule forbidding opacity on text elements cannot tell this SVG from a
   * paragraph — and because the seal does carry text, so the rule is not even
   * wrong about it: the three letters in the die are decoration and are read
   * by nobody, but nothing in a class name says so.
   */
  readonly opacity?: number
  readonly className?: string
}) {
  const teeth = []
  for (let index = 0; index < 44; index += 1) {
    const angle = (index / 44) * 360
    teeth.push(
      <rect
        key={index}
        x="-0.5"
        y="-25"
        width="1"
        height="3.4"
        fill="currentColor"
        transform={`rotate(${angle})`}
      />,
    )
  }

  // A five-pointed star, by hand, because the one in a font is not this one.
  const star: string[] = []
  for (let index = 0; index < 10; index += 1) {
    const radius = index % 2 === 0 ? 7.4 : 3.1
    const angle = (index / 10) * Math.PI * 2 - Math.PI / 2
    star.push(
      `${(Math.cos(angle) * radius).toFixed(2)},${(Math.sin(angle) * radius).toFixed(2)}`,
    )
  }

  return (
    <svg
      viewBox="-28 -28 56 56"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ opacity }}
    >
      <g color="currentColor">{teeth}</g>
      <circle r="21.5" fill="none" stroke="currentColor" strokeWidth="1.1" />
      <circle r="19" fill="none" stroke="currentColor" strokeWidth="0.4" />
      <polygon points={star.join(' ')} fill="currentColor" opacity="0.9" />
      <text
        y="16.5"
        textAnchor="middle"
        fill="currentColor"
        style={{
          font: '600 7px var(--font-mono)',
          letterSpacing: '0.16em',
        }}
      >
        {letters.slice(0, 4)}
      </text>
    </svg>
  )
}

/**
 * A serial number, in the place and the manner a note carries one.
 *
 * Derived from the run's own seed and meeting, so it is *true* — two plays of
 * the same seed carry the same number, which is the one detail that makes a
 * fake document convincing and is free here because the game already has a
 * deterministic seed.
 */
export function SerialNumber({
  seed,
  meeting,
  className,
}: {
  readonly seed: string
  readonly meeting: number
  readonly className?: string
}) {
  let hash = 0
  for (const character of seed) hash = (hash * 33 + character.charCodeAt(0)) >>> 0
  const letter = String.fromCharCode(65 + (hash % 26))
  const digits = String(((hash >>> 5) % 1_000_000) + meeting).padStart(8, '0')

  return (
    <span
      className={className}
      style={{
        font: '400 10px var(--font-mono)',
        letterSpacing: '0.22em',
      }}
    >
      {letter} {digits}
    </span>
  )
}
