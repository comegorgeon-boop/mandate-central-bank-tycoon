import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { Guilloche, GuillocheBand } from '../components/engraving/Guilloche.tsx'
import { Chip, Seal, SerialNumber } from '../components/engraving/Chip.tsx'
import { Flip, RollingNumber, Tally } from '../components/engraving/motion.tsx'
import {
  Arrow,
  Figure,
  Notched,
  Panel,
  PanelGrid,
  Row,
} from '../components/terminal/Terminal.tsx'

/**
 * The bench: every animation in the game, replayed on demand, dials exposed.
 *
 * > "Fais une page de développement où chaque animation se rejoue à la
 * > demande, avec des curseurs pour la durée, le ressort et le délai. On ne
 * > règle pas ça à l'intérieur d'une partie."
 *
 * The same argument as every other measurement tool in this project. Tuning a
 * spring by starting a mandate, playing to the meeting where the thing
 * happens, watching it once and then changing a number is not tuning, it is
 * guessing with extra steps. Here each piece replays on a button, side by
 * side, at whatever the sliders say, and the values are printed back as the
 * literal constants to paste into `components/engraving/motion.tsx`.
 *
 * Routed at `/lab`, linked from nowhere, in the bundle because it is two
 * kilobytes next to four hundred of simulation — and because a tool that has
 * to be specially built before it runs is a tool nobody runs.
 */

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  readonly label: string
  readonly value: number
  readonly min: number
  readonly max: number
  readonly step: number
  readonly onChange: (value: number) => void
}) {
  return (
    <label className="flex items-center gap-2 border-b border-edge px-2 py-1 font-mono text-2xs text-ink-soft last:border-b-0">
      <span className="w-[11ch] shrink-0 uppercase tracking-[0.12em]">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="min-w-0 flex-1 accent-[var(--accent)]"
      />
      <span className="w-[6ch] shrink-0 text-right tabular-nums text-ink">
        {value}
      </span>
    </label>
  )
}

export default function MotionLab() {
  const reduced = useReducedMotion()
  const [stiffness, setStiffness] = useState(420)
  const [damping, setDamping] = useState(26)
  const [mass, setMass] = useState(0.9)
  const [rollMs, setRollMs] = useState(420)
  const [delayMs, setDelayMs] = useState(360)
  const [tallyMs, setTallyMs] = useState(900)

  const [chipNonce, setChipNonce] = useState(0)
  const [shakeNonce, setShakeNonce] = useState(0)
  const [flipNonce, setFlipNonce] = useState(0)
  const [figure, setFigure] = useState(3.5)
  const [won, setWon] = useState(true)

  const spring = { type: 'spring' as const, stiffness, damping, mass }

  return (
    <main className="min-h-screen w-full bg-page pb-10 text-ink">
      <div className="border-b border-edge-strong bg-raised px-2 py-1.5">
        <h1 className="font-mono text-2xs font-semibold uppercase tracking-[0.22em] text-accent-strong">
          Motion bench · development
        </h1>
      </div>

      {reduced && (
        <p className="border-b border-bad bg-bad-surface px-2 py-1.5 font-mono text-xs text-bad">
          Reduced motion is on in this browser or operating system. Everything
          below will arrive without moving, which is correct — and means the
          bench cannot show you anything until you turn it off.
        </p>
      )}

      <PanelGrid>
        <Panel title="The spring" right="paste me">
          <Slider label="stiffness" value={stiffness} min={60} max={1200} step={10} onChange={setStiffness} />
          <Slider label="damping" value={damping} min={4} max={60} step={1} onChange={setDamping} />
          <Slider label="mass" value={mass} min={0.2} max={3} step={0.1} onChange={setMass} />
          <Slider label="roll ms" value={rollMs} min={80} max={1600} step={20} onChange={setRollMs} />
          <Slider label="delay ms" value={delayMs} min={0} max={1200} step={20} onChange={setDelayMs} />
          <Slider label="tally ms" value={tallyMs} min={100} max={3000} step={50} onChange={setTallyMs} />
          <p className="px-2 py-1 font-mono text-2xs leading-relaxed text-ink-faint">
            {`SPRING = { stiffness: ${stiffness}, damping: ${damping}, mass: ${mass} }`}
            <br />
            {`ROLL_MS = ${rollMs}   SUSPENSE_MS = ${delayMs}`}
          </p>
        </Panel>

        <Panel title="The figure rolls" span={2}>
          <div className="flex items-center gap-4 px-2 py-3">
            <Figure key={rollMs} value={figure} size="hero" invert />
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setFigure((c) => Math.round((c + 0.75) * 100) / 100)}
                className="border border-edge-accent px-2 py-1 font-mono text-2xs uppercase tracking-[0.14em] text-accent-strong"
              >
                Raise
              </button>
              <button
                type="button"
                onClick={() => setFigure((c) => Math.round((c - 0.5) * 100) / 100)}
                className="border border-edge px-2 py-1 font-mono text-2xs uppercase tracking-[0.14em] text-ink-soft"
              >
                Cut
              </button>
            </div>
            <p className="min-w-0 flex-1 font-mono text-2xs leading-relaxed text-ink-faint">
              A number that cuts was computed; a number that runs up to its
              value was counted. Green when it falls, red when it rises —
              inverted, because this one is inflation.
            </p>
          </div>
        </Panel>

        <Panel title="The chips land" span={2}>
          <div className="flex items-center gap-4 px-2 py-3">
            <span key={chipNonce} className="flex items-center gap-1">
              {Array.from({ length: 6 }, (_, index) => (
                <motion.span
                  key={index}
                  style={{ display: 'inline-block' }}
                  initial={reduced ? false : { x: 30, y: -40, rotate: -45, opacity: 0 }}
                  animate={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
                  transition={{ ...spring, delay: index * 0.065 }}
                >
                  <Chip size={22} tone={index % 3 === 0 ? 'bad' : 'brass'} />
                </motion.span>
              ))}
            </span>
            <button
              type="button"
              onClick={() => setChipNonce((n) => n + 1)}
              className="border border-edge-accent px-2 py-1 font-mono text-2xs uppercase tracking-[0.14em] text-accent-strong"
            >
              Throw
            </button>
          </div>
        </Panel>

        <Panel title="The notch">
          <div className="flex items-center gap-3 px-2 py-3">
            <Notched pulse={Math.round(figure * 4)}>
              <span className="font-mono text-2xl tabular-nums text-ink">
                <RollingNumber value={figure} />
              </span>
            </Notched>
            <p className="min-w-0 flex-1 font-mono text-2xs leading-relaxed text-ink-faint">
              One pulse per detent. No sound, ever — the click is the scale
              impulse.
            </p>
          </div>
        </Panel>

        <Panel title="The reveal" span={3} right={`${delayMs} ms of nothing first`}>
          <div className="flex flex-wrap items-start gap-4 px-2 py-3">
            <div className="min-h-[86px] w-[20rem] max-w-full">
              <Flip key={flipNonce} delayMs={delayMs} spring={spring}>
                <div
                  className={`border px-2 py-1.5 font-mono text-xs ${
                    won
                      ? 'border-good bg-good-surface text-good-strong'
                      : 'border-bad bg-bad-surface text-bad-strong'
                  }`}
                >
                  <p className="uppercase tracking-[0.16em]">
                    {won ? 'Your call was good' : 'Your call missed'}
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    <Tally
                      key={`${flipNonce}-${tallyMs}`}
                      value={won ? 1240 : -310}
                      durationMs={tallyMs}
                      delayMs={delayMs + 240}
                      prefix={won ? '+' : ''}
                    />
                  </p>
                </div>
              </Flip>
            </div>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => {
                  setWon(true)
                  setFlipNonce((n) => n + 1)
                }}
                className="border border-edge px-2 py-1 font-mono text-2xs uppercase tracking-[0.14em] text-good"
              >
                Won
              </button>
              <button
                type="button"
                onClick={() => {
                  setWon(false)
                  setFlipNonce((n) => n + 1)
                }}
                className="border border-edge px-2 py-1 font-mono text-2xs uppercase tracking-[0.14em] text-bad"
              >
                Lost
              </button>
            </div>
            <p className="min-w-0 flex-1 font-mono text-2xs leading-relaxed text-ink-faint">
              The card turns, then the total counts up one at a time. The
              tally is deliberately not the rolling figure: a live reading
              eases to its value, a settlement ticks like a meter, and the
              counting is the reward.
            </p>
          </div>
        </Panel>

        <Panel title="The shock" span={2}>
          <div className="flex items-center gap-3 px-2 py-3">
            <motion.div
              key={shakeNonce}
              initial={reduced ? false : { x: 0 }}
              animate={reduced ? undefined : { x: [0, 8, -6, 4, -2, 0] }}
              transition={{ duration: 0.21, times: [0, 0.2, 0.4, 0.6, 0.8, 1] }}
              className="border border-bad bg-raised px-2 py-1.5 font-mono text-xs text-ink"
            >
              A large bank closes its doors
            </motion.div>
            <button
              type="button"
              onClick={() => setShakeNonce((n) => n + 1)}
              className="border border-edge-accent px-2 py-1 font-mono text-2xs uppercase tracking-[0.14em] text-accent-strong"
            >
              Strike
            </button>
          </div>
        </Panel>

        <Panel title="Rows hold position">
          <Row label="Priced">
            <RollingNumber value={15} decimals={0} suffix=" bp" />
          </Row>
          <Row label="Surprise">
            <Figure value={60} decimals={0} suffix=" bp" />
          </Row>
          <Row label="Returns">
            <span className="text-good">+0.13 reach</span>
          </Row>
          <Row label="Stake">
            <span className="text-bad">3.0 trust</span>
          </Row>
          <Row label="Unemployment">
            <span className="flex items-center justify-end gap-1">
              <Arrow direction="down" invert />
              <RollingNumber value={4.1} suffix=" %" />
            </span>
          </Row>
        </Panel>

        <Panel title="Drawn furniture" span={3}>
          <div className="flex flex-wrap items-center gap-8 px-2 py-4">
            <div className="text-accent-strong">
              <Guilloche size={120} petals={11} copies={9} bands={3} strokeWidth={0.4} />
            </div>
            <div className="flex flex-col items-center gap-2 text-accent-strong">
              <Seal size={56} letters="FRS" />
              <SerialNumber seed="LAB" meeting={7} className="text-ink-faint" />
            </div>
            <div className="min-w-[14rem] flex-1 text-accent-strong">
              <GuillocheBand height={20} lines={3} frequency={17} waist={0.42} />
            </div>
          </div>
        </Panel>
      </PanelGrid>

      <p className="px-2 py-3 font-mono text-2xs">
        <Link to="/" className="text-ink-soft underline hover:text-ink">
          Back
        </Link>
      </p>
    </main>
  )
}
