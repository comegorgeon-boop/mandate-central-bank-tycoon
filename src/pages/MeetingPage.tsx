import { Navigate, useParams } from 'react-router-dom'
import { useRun } from '../features/game/runContext.ts'
import { MeetingScreen } from '../features/meeting/MeetingScreen.tsx'

/**
 * Route guard around one meeting.
 *
 * The engine, not the URL, decides which meeting is current: a `:turn` that
 * does not match the run is redirected rather than trusted. Confirming a
 * decision advances the session, and the redirect below carries the player to
 * the next meeting or to the result screen.
 */
export default function MeetingPage() {
  const { turn } = useParams()
  const { active, finished, submit } = useRun()

  if (finished !== null) return <Navigate to={`/play/result/${finished.runId}`} replace />
  if (active === null) return <Navigate to="/play/setup" replace />

  const expected = active.session.state.meetingIndex + 1
  const requested = Number(turn)
  if (!Number.isInteger(requested) || requested !== expected) {
    return <Navigate to={`/play/meeting/${expected}`} replace />
  }

  // Keying on the meeting index resets the panel and the desk selection at
  // every meeting, so a decision can never be carried over unintentionally.
  return <MeetingScreen key={expected} session={active.session} onConfirm={submit} />
}
