/**
 * The product mark.
 *
 * A letter in a coloured box is a placeholder, not an identity — it says
 * nothing about what the system is for and looks like every other one. This
 * is the tawaf: a still centre with a path running round it. Abstract enough
 * to work at sixteen pixels in a browser tab, specific enough that it could
 * not belong to an accounting tool.
 *
 * It is drawn in `currentColor` throughout, so a parent decides the colour and
 * the same file serves the dark rail, the light login card and a disabled
 * state without a second copy.
 */
export function LogoMark({
  className,
  size,
  title,
}: {
  className?: string;
  size?: number;
  /** Supply only where the mark stands alone; beside the name it is decorative. */
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {/*
        One open circuit, not a ring with something drawn over it.

        A closed circle reads as a target or a loading spinner; the gap is what
        makes it a path being walked. Earlier versions layered a faint full
        ring under a brighter arc, which looked considered at 72px and turned
        to mush at 16 — the two strokes merged and the gap disappeared. A
        single stroke survives the browser tab.
      */}
      <path
        d="M22.5 27.2A12.6 12.6 0 1 1 28.6 16"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* The centre it all turns around. */}
      <rect x="11.25" y="11.25" width="9.5" height="9.5" rx="2.25" fill="currentColor" />
    </svg>
  );
}

/**
 * The mark with the name beside it, for the rail and the sign-in card.
 *
 * `tone` exists because the rail is dark in both themes while the login card
 * follows the page, so the two need different text colours against the same
 * mark.
 */
export function Logo({
  subtitle,
  tone = 'default',
  size = 'md',
}: {
  subtitle?: string;
  tone?: 'default' | 'rail';
  size?: 'md' | 'lg';
}) {
  const large = size === 'lg';

  return (
    <span className="flex items-center gap-3">
      <span
        className={
          large
            ? 'flex size-14 shrink-0 items-center justify-center rounded-[1.1rem] bg-primary text-primary-foreground shadow-raised'
            : 'flex size-10 shrink-0 items-center justify-center rounded-[0.8rem] bg-primary text-primary-foreground'
        }
      >
        <LogoMark className={large ? 'size-8' : 'size-6'} />
      </span>

      <span className="min-w-0">
        <span
          className={[
            'block truncate font-bold tracking-tight',
            large ? 'text-xl' : 'text-[0.95rem]',
            tone === 'rail' ? 'text-rail-foreground' : 'text-foreground',
          ].join(' ')}
        >
          حجامرة
        </span>

        {subtitle && (
          <span
            className={[
              'block truncate',
              large ? 'text-sm' : 'text-[0.7rem]',
              tone === 'rail' ? 'text-rail-muted' : 'text-muted',
            ].join(' ')}
          >
            {subtitle}
          </span>
        )}
      </span>
    </span>
  );
}
