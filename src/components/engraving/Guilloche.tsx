import { useMemo } from 'react'

/**
 * A guilloché rosette, drawn the way the machine that invented them drew.
 *
 * ## Why this, of everything
 *
 * A guilloché is the visual language of money itself — the engine-turned
 * lacework on a banknote, a share certificate, a bond coupon. It is free to
 * use, instantly legible as *currency*, grave rather than comic, and there is
 * nothing on earth that looks less like a generated interface than one,
 * because no generated interface would ever bother.
 *
 * A central bank manufactures banknotes. The game should look like it.
 *
 * ## How it is made
 *
 * The real machine is a rose engine: a fixed circle, a smaller one rolling
 * inside it, a pen offset from the roller's centre. That is a
 * **hypotrochoid**, and it is three lines of trigonometry:
 *
 *     k = (R − r) / r
 *     x = (R − r)·cos θ + d·cos(k·θ)
 *     y = (R − r)·sin θ − d·sin(k·θ)
 *
 * ## The thing the first draft got wrong
 *
 * `k` **must be a whole number**, or the curve never returns to where it
 * started and simply wanders the disc forever. The first version set the
 * roller to an arbitrary 0.31 of the fixed circle, which gives k = 2.226, and
 * then ran it for seven turns: what came out was a tangle of open arcs that
 * read, correctly, as a scribble. Engine-turning is the opposite of a
 * scribble. It is the most rigidly periodic mark a machine can make.
 *
 * So the roller is now `R / petals`, which makes k = `petals − 1` exactly, and
 * the figure closes in a single revolution with `petals` lobes. The lace comes
 * from somewhere truer to the machine: the operator advances the index a
 * fraction of a tooth and cuts the same figure again, `copies` times. That is
 * literally how a rose engine makes a rosette, and it is why the result is
 * dense and periodic rather than busy.
 */

export interface GuillocheProps {
  /** Side of the square viewBox. The figure is centred and fills it. */
  readonly size?: number
  /** Lobes on the rosette. The gear ratio: k = petals − 1. */
  readonly petals?: number
  /** Pen offset, as a multiple of the roller's radius. Over 1 makes loops. */
  readonly pen?: number
  /** Cuts of the same figure, each advanced a fraction of one lobe. */
  readonly copies?: number
  /** Concentric repeats at reducing radius, which make the moiré. */
  readonly bands?: number
  readonly stroke?: string
  readonly strokeWidth?: number
  readonly opacity?: number
  readonly className?: string
}

/**
 * One cut of the lathe, as a closed SVG path.
 *
 * `outer` is the radius the figure must fit inside; the fixed circle is
 * solved backwards from it so that the widest excursion lands exactly there.
 */
function rosette(outer: number, petals: number, pen: number, steps: number): string {
  // outer = (R − r) + d, with r = R/petals and d = pen·r
  //       = R·(petals − 1 + pen)/petals
  const fixed = (outer * petals) / (petals - 1 + pen)
  const roller = fixed / petals
  const d = pen * roller
  const k = petals - 1

  const points: string[] = []
  for (let index = 0; index <= steps; index += 1) {
    const theta = (index / steps) * Math.PI * 2
    const x = (fixed - roller) * Math.cos(theta) + d * Math.cos(k * theta)
    const y = (fixed - roller) * Math.sin(theta) - d * Math.sin(k * theta)
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`)
  }
  return `M${points.join('L')}Z`
}

export function Guilloche({
  size = 240,
  petals = 9,
  pen = 1.35,
  copies = 7,
  bands = 3,
  stroke = 'currentColor',
  strokeWidth = 0.4,
  opacity = 1,
  className,
}: GuillocheProps) {
  const figures = useMemo(() => {
    const radius = size / 2 - strokeWidth
    const out: { d: string; rotate: number }[] = []
    for (let band = 0; band < bands; band += 1) {
      // Each band is the same figure smaller, with the pen drawn in a little,
      // so the bands do not simply nest — they interfere. That interference
      // is the moiré, which is the whole reason the technique exists.
      const bandRadius = radius * (1 - band * 0.145)
      const bandPen = pen * (1 - band * 0.06)
      // Half a lobe of offset between bands, so a band's lobes sit in the
      // previous band's valleys rather than on top of them.
      const bandTwist = band * (180 / petals)
      for (let copy = 0; copy < copies; copy += 1) {
        out.push({
          d: rosette(bandRadius, petals, bandPen, 900),
          rotate: bandTwist + (copy / copies) * (360 / petals),
        })
      }
    }
    return out
  }, [size, petals, pen, copies, bands, strokeWidth])

  return (
    <svg
      viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ opacity }}
    >
      {figures.map((figure, index) => (
        <path
          key={index}
          d={figure.d}
          transform={`rotate(${figure.rotate.toFixed(3)})`}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  )
}

/**
 * A guilloché band, for running along an edge the way a note's border does.
 *
 * Interlaced waves: one family of sines at evenly spaced phases, and its
 * mirror. Where the two families cross they weave, which is the braid on the
 * top edge of every note and every share certificate ever printed.
 *
 * The first version modulated each line by a second, slower wave at a phase
 * offset of its own, which made the amplitude wander along the band — so the
 * lines stopped being parallel and the braid dissolved. The envelope here is
 * shared by every line, so they swell and pinch *together* and stay woven.
 */
export function GuillocheBand({
  width = 600,
  height = 26,
  lines = 5,
  frequency = 14,
  /** How much the braid narrows at its pinch points. 0 is a plain lattice. */
  waist = 0.3,
  stroke = 'currentColor',
  strokeWidth = 0.4,
  opacity = 1,
  className,
}: {
  readonly width?: number
  readonly height?: number
  readonly lines?: number
  readonly frequency?: number
  readonly waist?: number
  readonly stroke?: string
  readonly strokeWidth?: number
  readonly opacity?: number
  readonly className?: string
}) {
  const paths = useMemo(() => {
    const out: string[] = []
    const steps = 720
    const amplitude = height / 2 - strokeWidth
    for (let line = 0; line < lines; line += 1) {
      for (const direction of [1, -1]) {
        // The two families share phases; the sign is what crosses them.
        const phase = (line / lines) * Math.PI
        const points: string[] = []
        for (let index = 0; index <= steps; index += 1) {
          const t = index / steps
          const carrier = Math.sin((t * frequency + phase / Math.PI) * Math.PI * 2)
          // One envelope for the whole band, so the lines stay parallel.
          const envelope =
            1 - waist * (0.5 + 0.5 * Math.cos(t * Math.PI * 2 * (frequency / 7)))
          const y = height / 2 + direction * carrier * envelope * amplitude
          points.push(`${(t * width).toFixed(2)},${y.toFixed(2)}`)
        }
        out.push(`M${points.join('L')}`)
      }
    }
    return out
  }, [width, height, lines, frequency, waist, strokeWidth])

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ opacity, display: 'block', width: '100%', height }}
    >
      {paths.map((path, index) => (
        <path
          key={index}
          d={path}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  )
}
