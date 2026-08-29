/**
 * Developer-only demonstration run. Not part of the game bundle.
 *
 * Simulates eight meetings of an easy Federal Reserve mandate from a fixed
 * seed and prints how inflation, unemployment and the output gap evolve.
 *
 * Both columns are shown side by side on purpose: the latent state the engine
 * actually runs on, and the observed state a player would see after
 * publication lags, measurement noise and revisions. The gap between them is
 * the information problem the game is built around.
 *
 * The latent column is printed here because this file is developer tooling.
 * It is never imported by application code and latent values never reach the
 * player-facing interface.
 *
 * Run with: npm run sim:demo
 */

import type { PolicyAction, PolicyPackage } from '../types/policy.ts'
import type { RunSession } from '../replay/replayRun.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { createRunConfig } from '../engine/initialState.ts'
import { getInstitution } from '../config/institutions.ts'
import { MEETINGS_PER_YEAR } from '../config/time.ts'
import { calculateScore } from '../scoring/calculateScore.ts'
import { startRun, submitMeeting } from '../replay/replayRun.ts'
import { encodeDecisionLog } from '../replay/decisionLog.ts'

const SEED = 'demo-seed-01'
const INSTITUTION = 'fed'
const DIFFICULTY = 'easy'

/**
 * A deliberately simple reaction function for the demo.
 *
 * It reads only *observed* data, exactly as a player must, and moves in
 * quarter points. It is not meant to be a good policy rule — it exists to
 * produce a legible path, and it is not the answer the game is looking for.
 */
function chooseRate(session: RunSession): number {
  const indicators = session.observation.indicators
  const inflation = indicators.headline_inflation?.value ?? 2
  const unemployment = indicators.unemployment?.value ?? 4.2
  const target = getInstitution(INSTITUTION).inflationTarget

  const pressure = 1.5 * (inflation - target) - 0.8 * (unemployment - 4.2)
  const steps = Math.max(-2, Math.min(2, Math.round(pressure)))
  return steps * 25
}

function pad(value: string, width: number): string {
  return value.padStart(width, ' ')
}

function num(value: number | null | undefined, decimals = 2): string {
  return value === null || value === undefined ? '—' : value.toFixed(decimals)
}

function printRow(session: RunSession): void {
  const latent = session.state.latent
  const indicators = session.observation.indicators

  const columns = [
    pad(String(session.state.meetingIndex), 3),
    pad(num(latent.policyRate), 7),
    pad(num(latent.inflationHeadline), 8),
    pad(num(indicators.headline_inflation?.value), 8),
    pad(num(latent.unemployment), 9),
    pad(num(indicators.unemployment?.value), 8),
    pad(num(latent.outputGap), 9),
    pad(num(indicators.output_gap_estimate?.value), 8),
  ]
  console.log(columns.join(' '))
}

function main(): void {
  const config = createRunConfig({
    institution: INSTITUTION,
    difficulty: DIFFICULTY,
    seed: SEED,
    simulationVersion: SIMULATION_VERSION,
  })

  const institution = getInstitution(INSTITUTION)
  const years = config.meetingCount / MEETINGS_PER_YEAR

  console.log('')
  console.log('Mandate: Central Bank Tycoon — simulation demo')
  console.log('='.repeat(78))
  console.log(
    `${institution.name}   difficulty: ${DIFFICULTY}   seed: ${SEED}   engine: ${SIMULATION_VERSION}`,
  )
  console.log(
    `Mandate: ${config.meetingCount} meetings (${years.toFixed(0)} year), target ${institution.inflationTarget.toFixed(1)} %`,
  )
  console.log('')
  console.log(
    'true = latent state the engine runs on. obs = what the player is shown,',
  )
  console.log(
    'after publication lags, measurement noise and revisions. Developer view only.',
  )
  console.log('')
  console.log(
    [
      pad('#', 3),
      pad('rate', 7),
      pad('infl', 8),
      pad('obs', 8),
      pad('unemp', 9),
      pad('obs', 8),
      pad('gap', 9),
      pad('obs', 8),
    ].join(' '),
  )
  console.log('-'.repeat(78))

  let session = startRun(config)
  printRow(session)

  while (session.outcome.status === 'active') {
    const actions: PolicyAction[] = []
    const move = chooseRate(session)
    if (move !== 0) actions.push({ instrument: 'policy_rate', magnitude: move })

    const pkg: PolicyPackage = {
      actions,
      communication: {
        tone: 'neutral',
        emphasis: 'data_dependence',
        commitment: 'weak_bias',
        channel: 'statement',
      },
    }

    const result = submitMeeting(session, pkg)
    if (!result.ok) {
      console.log(
        `  package rejected: ${result.validation.rejections.map((r) => r.message).join(' ')}`,
      )
      break
    }

    session = result.session
    printRow(session)

    for (const headline of session.newswire) {
      console.log(`      news: ${headline}`)
    }
    for (const clue of session.clues) {
      console.log(`      watch: ${clue}`)
    }
    for (const warning of session.outcome.warnings) {
      console.log(
        `      warning [${warning.severity}] ${warning.label}: ${warning.message} ` +
          `(${warning.meetingsHeld}/${warning.meetingsToTrigger} meetings)`,
      )
    }
  }

  console.log('-'.repeat(78))
  console.log('')

  const score = calculateScore(session.state, session.outcome)
  console.log(`Outcome: ${session.outcome.label ?? 'still active'}`)
  if (session.outcome.summary) console.log(`  ${session.outcome.summary}`)
  console.log('')
  console.log(`Score: ${score.score} / 10000   bucket: ${score.bucketKey}`)
  for (const component of score.components) {
    console.log(
      `  ${component.label.padEnd(28, ' ')} ${pad((component.raw * 100).toFixed(0), 3)}%` +
        ` × ${component.weight.toFixed(2)} = ${(component.contribution * 100).toFixed(1)} pts`,
    )
  }

  if (session.outcome.causalChain.length > 0) {
    console.log('')
    console.log('Causal chain:')
    for (const factor of session.outcome.causalChain) {
      console.log(
        `  ${(factor.contribution * 100).toFixed(0).padStart(3, ' ')}%  ${factor.label} — ${factor.detail}`,
      )
    }
  }

  const diagnostics = session.state.diagnostics
  console.log('')
  console.log(
    diagnostics.length === 0
      ? 'Diagnostics: no variable hit a safety bound.'
      : `Diagnostics: ${diagnostics.length} clamp event(s), first on "${diagnostics[0].variable}".`,
  )

  console.log('')
  console.log('Replay log:')
  console.log(
    `  ${encodeDecisionLog({
      simulationVersion: config.simulationVersion,
      institution: config.institution,
      difficulty: config.difficulty,
      mode: config.mode,
      seed: config.seed,
      decisions: session.decisions,
    })}`,
  )
  console.log('')
}

main()
