import type { ShockDiagnosis } from '../../../simulation/index.ts'

/**
 * The shock in progress: what it is called, where the difficulty says so, and
 * always how you could have told.
 *
 * The evidence is laid out below the name and given more room than it, on
 * purpose, and it outlives the name by a rung of the difficulty ladder. A
 * player who learns "supply shock means do not tighten" has learned a rule they
 * cannot apply anywhere else, and will be helpless the moment the name is
 * withheld. A player who learns that headline running far ahead of core, with
 * the output gap opening rather than closing, *is* a supply shock can still
 * read the economy when nobody labels it.
 *
 * So the name is presented as a conclusion drawn from the evidence, not as a
 * fact handed down separately from it — and where the name is withheld, the
 * evidence is presented as an unfinished argument for the player to close.
 */
export function DiagnosisPanel({ diagnosis }: { readonly diagnosis: ShockDiagnosis }) {
  const named = diagnosis.label !== null

  return (
    <section
      aria-labelledby="diagnosis-heading"
      className="rounded border border-sky-900 bg-sky-950/30 p-4"
    >
      <p className="text-xs uppercase tracking-wide text-sky-400">
        {named ? 'Learning mandate — analysis' : 'What the data are showing'}
      </p>
      <h3 id="diagnosis-heading" className="mt-1 text-lg font-semibold text-sky-100">
        {named ? diagnosis.label : 'Read the tells yourself'}
      </h3>
      {diagnosis.summary !== null && (
        <p className="mt-1 text-sm text-neutral-300">{diagnosis.summary}</p>
      )}

      <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-neutral-400">
        {named
          ? 'How you could tell, from the published data'
          : 'What stands out in the published data'}
      </h4>
      <ul className="mt-2 space-y-2">
        {diagnosis.evidence.map((item) => (
          <li key={item} className="flex gap-2 text-sm text-neutral-300">
            <span aria-hidden="true" className="text-sky-500">
              ·
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs text-neutral-500">
        {named
          ? 'The name comes free at this difficulty. The evidence above is what stays ' +
            'on the table when it stops coming free — learn to read that, not the label.'
          : 'Nobody will tell you what this is. These are the same tells the learning ' +
            'mandate reads its conclusion off; the conclusion is now yours to draw.'}
      </p>
    </section>
  )
}
