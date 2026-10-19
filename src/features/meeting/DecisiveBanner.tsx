import { decisiveMeetingOf, type RunSession } from '../../simulation/index.ts'

/**
 * The meeting the mandate is remembered by, announced before it arrives.
 *
 * > "UNE RÉUNION PAR MANDAT DOIT ÊTRE *LA* RÉUNION : annoncée comme décisive,
 * > tout l'appareil dehors, une issue qui bifurque visiblement."
 *
 * The tempo already made it full — the whole apparatus comes out. What was
 * missing is the two halves that make it *the* meeting rather than another
 * busy one: **it is announced a meeting ahead**, so it can be dreaded, and
 * **the fork is shown afterwards**, so the choice is visibly a choice.
 *
 * ## Why announcing it is not a cheat
 *
 * Because it is not a prophecy about the economy. It says the committee has a
 * decision in front of it, which is a thing a committee knows: a scenario's
 * decisive meeting is the one before its own documented crisis, and a
 * fictional mandate's is drawn from the seed and fixed from the first
 * meeting. Nothing about *what* will happen is disclosed. The game is not
 * telling the player the answer, it is telling them there is a question.
 */
export function DecisiveBanner({ session }: { readonly session: RunSession }) {
  const decisive = decisiveMeetingOf(session)
  const index = session.state.meetingIndex

  // Only two meetings in a mandate show this: the one before, and the one.
  if (index !== decisive && index !== decisive - 1) return null
  const isTheMeeting = index === decisive

  return (
    <section
      aria-label={isTheMeeting ? 'This is the decisive meeting' : 'The next meeting is decisive'}
      data-decisive={isTheMeeting ? 'now' : 'next'}
      className={`mt-3 rounded-lg border-l-4 p-3 ${
        isTheMeeting
          ? 'border-edge-accent bg-accent-surface text-on-accent-surface'
          : 'border-edge-accent bg-inset text-onwood'
      }`}
    >
      <p className="text-2xs font-semibold uppercase tracking-[0.14em] opacity-80">
        {isTheMeeting ? 'The meeting' : 'Ahead'}
      </p>
      <p className="mt-1 text-sm font-semibold">
        {isTheMeeting
          ? 'This is the one this mandate will be remembered by.'
          : 'The next meeting is the one this mandate will be remembered by.'}
      </p>
      <p className="mt-1 text-xs opacity-90">
        {isTheMeeting
          ? 'Everything is on the table and the room is open. Whatever you do ' +
            'here, you will be shown afterwards what the other way would have ' +
            'produced.'
          : 'Nothing is being predicted about the economy. The committee ' +
            'simply has a decision in front of it, and it has known for some ' +
            'time which one.'}
      </p>
    </section>
  )
}
