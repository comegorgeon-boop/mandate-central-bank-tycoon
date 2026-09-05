/**
 * The house tortoise.
 *
 * An original character, drawn here as inline SVG paths — no asset, no font,
 * no third-party artwork, nothing under anyone's copyright, and nothing that
 * costs a network request.
 *
 * A tortoise because the joke is the game's actual subject. Monetary policy
 * acts with long and variable lags: the whole design problem this simulation
 * is built around is that you move now and find out in four meetings. A
 * creature that arrives slowly and gets there anyway is the right mascot for a
 * game whose central lesson is patience, and it lets the one piece of
 * whimsy in an otherwise sober boardroom carry a point rather than just
 * sitting there being cute.
 *
 * Drawn entirely in palette tokens, so it re-themes with the room.
 */

export function Mascot({
  size = 96,
  className = '',
}: {
  readonly size?: number
  readonly className?: string
}) {
  return (
    <svg
      width={size}
      height={Math.round(size * 0.68)}
      viewBox="0 0 130 88"
      role="img"
      aria-label="The house tortoise, the mandate's mascot: an old tortoise in small round spectacles."
      className={className}
    >
      {/* Order matters: the neck and legs are drawn first so the shell sits on
          top of them and they read as emerging from under it rather than
          floating beside it. */}

      {/* Legs */}
      <path
        d="M24 56h13v16a3 3 0 0 1-3 3h-7a3 3 0 0 1-3-3z
           M52 56h13v16a3 3 0 0 1-3 3h-7a3 3 0 0 1-3-3z"
        className="fill-[var(--color-viridian-600)] stroke-[var(--color-viridian-800)]"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />

      {/* Neck, running from under the shell out to the head. Its lower edge
          stops above the plastron rather than below it, or it shows as a green
          line running out from under the shell. */}
      <path
        d="M62 40h22v21H62z"
        className="fill-[var(--color-viridian-600)]"
      />

      {/* Head: one oval, wide enough to carry both lenses. */}
      <ellipse
        cx="97"
        cy="49"
        rx="22"
        ry="16"
        className="fill-[var(--color-viridian-600)] stroke-[var(--color-viridian-800)]"
        strokeWidth="1.8"
      />

      {/* Shell, drawn over the neck and legs so everything connects. */}
      <path
        d="M8 62a34 34 0 0 1 68 0z"
        className="fill-[var(--color-walnut-700)] stroke-[var(--color-walnut-500)]"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Scutes: a central column and two flanks, plain and symmetrical. */}
      <path
        d="M42 28v34M27 33l-6 29M57 33l6 29M15 47h54"
        className="stroke-[var(--color-brass-600)]"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
      {/* Plastron: the shell's lower rim, closing it over the legs. */}
      <path
        d="M6 62h72"
        className="stroke-[var(--color-walnut-500)]"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* Spectacles: two small round brass frames and a bridge, both lenses on
          the head. The one piece of ornament, and the reason the character
          reads as an institution rather than an animal. */}
      <circle
        cx="91"
        cy="47"
        r="7"
        className="fill-[var(--color-viridian-800)] stroke-[var(--color-brass-400)]"
        strokeWidth="2"
      />
      <circle
        cx="108"
        cy="47"
        r="6"
        className="fill-[var(--color-viridian-800)] stroke-[var(--color-brass-400)]"
        strokeWidth="2"
      />
      <path
        d="M98 47h4"
        className="stroke-[var(--color-brass-400)]"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Eye, and the unimpressed line of a mouth. */}
      <circle cx="91" cy="47" r="2.4" className="fill-[var(--color-paper-50)]" />
      <path
        d="M104 60h9"
        className="stroke-[var(--color-viridian-800)]"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}
