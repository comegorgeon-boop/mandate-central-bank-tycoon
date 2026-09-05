import { Link } from 'react-router-dom'
import { MEETING_COUNT } from '../simulation/index.ts'

function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-4 py-12 text-onwood">
      <h1 className="text-3xl font-bold text-onwood">Mandate: Central Bank Tycoon</h1>
      <p className="mt-3 text-sm text-onwood-soft">
        Chair the Federal Reserve for {MEETING_COUNT.easy} policy meetings. Set the
        rate, live with the lag, and answer for the whole path of the economy at the
        end of the mandate.
      </p>

      <Link
        to="/play/setup"
        className="mt-8 self-start rounded-md border border-edge-accent bg-accent px-4 py-2 text-sm font-semibold text-on-accent shadow-panel transition-colors hover:bg-accent-onwood"
      >
        Play now
      </Link>

      <p className="mt-10 text-xs text-onwood-faint">
        An educational, fictional simulation. Not investment advice, and not
        affiliated with the Federal Reserve or any other central bank.
      </p>
    </main>
  )
}

export default HomePage
