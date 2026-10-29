import { aimLine, type RunConfig } from '../../simulation/index.ts'
import { WhatYouAreFor } from './WhatYouAreFor.tsx'

/**
 * "What am I trying to do?" — answered at one gesture, at every meeting.
 *
 * > "ET ÇA RESTE ACCESSIBLE : un « qu'est-ce que je cherche à faire » à un
 * > geste, n'importe quand. Mon ami n'a pas posé la question une fois, il l'a
 * > posée en boucle."
 *
 * The briefing says all of this before the first meeting, and a briefing read
 * once is not an answer to a question asked repeatedly. So the same five points
 * stay reachable from the meeting itself.
 *
 * ## Why a `<details>` and not a button
 *
 * Three reasons, and the third is the one that settles it. It costs one line
 * when closed, so it can sit on the quick surface — the one this project spent
 * a month clearing — without taking space from the decision. It is a native
 * disclosure, so the keyboard and the browser's own find-in-page reach the
 * text inside, which a tooltip or a modal would not. And the contrast audit
 * opens every `<details>` on every state before measuring, so the content is
 * covered by the check rather than hidden from it — the exact failure recorded
 * in journal 5, where folding prose behind disclosures hid it from the audit.
 *
 * ## Closed, it is the question and nothing else
 *
 * The objective was on the summary line too, which reads better and cost eight
 * words of the quick surface — and that surface is capped at sixty, frozen, on
 * the rule that an addition *replaces*. Measuring it is what found that the cap
 * had never covered this band at all: `tools/words.mjs` scoped the quick count
 * to `[data-tempo="quick"]`, which does not contain the order banner, so the
 * eleven words QUESTIONS #14's own accounting lists first were outside the
 * number. With the band counted the surface measures 63 against the 60.
 *
 * So the objective moved inside the disclosure, where it is the first line.
 * The control keeps the question, which is what was asked for — *"un
 * « qu'est-ce que je cherche à faire » à un geste"* — and the gap it is
 * measured against is already drawn on three gauges a few centimetres away.
 */
export function AimDisclosure({
  config,
  compact = false,
}: {
  readonly config: RunConfig
  /** The quick surface, where every line is contested. */
  readonly compact?: boolean
}) {
  return (
    <details
      data-aim=""
      className="border-b border-edge bg-raised px-3 py-1.5 [&[open]]:pb-3"
    >
      <summary className="cursor-pointer list-none font-mono text-2xs uppercase tracking-[0.16em] text-ink-faint hover:text-ink-soft">
        <span className="underline decoration-dotted underline-offset-2">
          What am I trying to do?
        </span>
      </summary>
      <div className="mt-2.5">
        {/* The objective first, in one line, then the five points. Open rather
            than closed: see the note above on the word budget. */}
        <p
          className={
            compact
              ? 'mb-2.5 font-mono text-xs text-ink-soft'
              : 'mb-3 font-mono text-sm text-ink-soft'
          }
        >
          {aimLine(config)}
        </p>
        <WhatYouAreFor config={config} compact={compact} />
      </div>
    </details>
  )
}
