import { Link } from 'react-router-dom'
import {
  DOCTRINES,
  INSTRUMENTS,
  SERIES,
  getInstitution,
} from '../simulation/index.ts'

/**
 * Every term the game uses, in the game's own words.
 *
 * **Nothing on this page is written here.** Every definition is read off the
 * object that produces it — `SERIES` for the indicators, `INSTRUMENTS` for the
 * toolkit, `DOCTRINES` for the schools — so the glossary cannot drift from the
 * panels. That is the same discipline the scenario document is held to by its
 * test and the indicator descriptions by theirs: a second copy of a sentence
 * is a sentence that will be edited once.
 *
 * It also means the glossary grows by itself. An instrument added to the
 * toolkit appears here without anybody remembering to write it down, which is
 * the only way a reference page in a project this size stays true.
 *
 * Institution-specific labels are shown for both, side by side, because a
 * reader looking a term up does not yet know which institution's name for it
 * they met.
 */

function Section({
  id,
  title,
  lede,
  children,
}: {
  readonly id: string
  readonly title: string
  readonly lede: string
  readonly children: React.ReactNode
}) {
  return (
    <section aria-labelledby={id} className="mt-10">
      <h2 id={id} className="font-display text-xl font-semibold text-onwood">
        {title}
      </h2>
      <p className="mt-1 text-sm text-onwood-soft">{lede}</p>
      <dl className="mt-4 space-y-4">{children}</dl>
    </section>
  )
}

function Entry({
  term,
  note,
  children,
}: {
  readonly term: string
  readonly note?: string
  readonly children: React.ReactNode
}) {
  return (
    <div className="border-t border-edge-room pt-3">
      <dt className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-medium text-onwood">{term}</span>
        {note !== undefined && (
          <span className="text-2xs uppercase tracking-wide text-onwood-faint">
            {note}
          </span>
        )}
      </dt>
      <dd className="mt-1 space-y-1 text-sm text-onwood-soft">{children}</dd>
    </div>
  )
}

const CATEGORY: Readonly<Record<string, string>> = {
  market_data: 'market price',
  official_statistic: 'official statistic',
  survey: 'survey',
  internal_estimate: 'staff estimate',
}

export default function GlossaryPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-10 text-onwood">
      <h1 className="font-display text-2xl font-semibold text-onwood">Glossary</h1>
      <p className="mt-2 text-sm text-onwood-soft">
        Every number, instrument and school the game puts in front of you, in
        the same words the panels use — this page reads them off the same
        definitions rather than keeping a second copy that could drift.
      </p>

      <Section
        id="indicators"
        title="What you are shown"
        lede="A price is observed exactly and at once. A statistic arrives late, carries measurement error and is revised afterwards. Which of the two a number is decides how much weight it can bear."
      >
        {SERIES.map((series) => (
          <Entry
            key={series.id}
            term={series.label}
            note={`${CATEGORY[series.category] ?? series.category}${
              series.publicationLagMeetings > 0
                ? `, ${series.publicationLagMeetings} meeting${series.publicationLagMeetings === 1 ? '' : 's'} late`
                : ''
            }`}
          >
            <p>{series.definition}</p>
            <p className="text-onwood-faint">{series.meaning}</p>
          </Entry>
        ))}
      </Section>

      <Section
        id="instruments"
        title="What you hold"
        lede="Not every instrument is available in every mandate: a difficulty opens them in order, and a historical scenario withholds whatever had not been invented yet."
      >
        {INSTRUMENTS.map((instrument) => (
          <Entry
            key={instrument.id}
            term={
              instrument.label.fed === instrument.label.ecb
                ? instrument.label.fed
                : `${instrument.label.fed} · ${instrument.label.ecb}`
            }
            note={
              instrument.availableTo.length === 1
                ? getInstitution(instrument.availableTo[0]).shortName
                : `from ${instrument.availableFrom}`
            }
          >
            <p>{instrument.purpose}</p>
            <p className="text-onwood-faint">{instrument.rangeNote}</p>
          </Entry>
        ))}
      </Section>

      <Section
        id="doctrines"
        title="Who is arguing"
        lede="Ten schools of monetary thought sit at the table. They are real positions, they disagree with each other on purpose, and the scoreboard keeps a record of which of them was right when it differed from you."
      >
        {DOCTRINES.map((doctrine) => (
          <Entry key={doctrine.id} term={doctrine.name} note={doctrine.school}>
            <p>{doctrine.creed}</p>
            {doctrine.authorities.length > 0 && (
              <p className="text-onwood-faint">{doctrine.authorities.join(' · ')}</p>
            )}
          </Entry>
        ))}
      </Section>

      <p className="mt-10 text-sm">
        <Link to="/" className="text-onwood-soft underline hover:text-onwood">
          Back
        </Link>
      </p>
    </main>
  )
}
