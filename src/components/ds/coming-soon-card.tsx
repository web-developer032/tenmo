import { Clock } from 'lucide-react';
import Link from 'next/link';
import type * as React from 'react';
import { cn } from '@/lib/cn';

/*
 * Placeholder card for the 5 stub feature screens (Financials & MTD,
 * Deposits register, Right-to-Rent register, Inspections, Contractors).
 *
 * Renders inside the standard shell so the IA matches the design while the
 * underlying feature ships in a later phase. Keeps the user rule about
 * "no duplication": every stub page imports this one component and passes
 * its own title + teaser + back link.
 */

export type ComingSoonCardProps = {
  title: string;
  description: React.ReactNode;
  bullets?: string[];
  shipTarget?: string;
  backHref?: string;
  backLabel?: string;
  icon?: React.ReactNode;
  className?: string;
};

export function ComingSoonCard({
  title,
  description,
  bullets,
  shipTarget,
  backHref,
  backLabel = 'Back to dashboard',
  icon,
  className,
}: ComingSoonCardProps) {
  return (
    <div
      className={cn(
        'mx-auto max-w-2xl rounded-card border border-border-soft bg-white p-6 text-center lg:p-10',
        className,
      )}
    >
      <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-foam text-forest-600">
        {icon ?? <Clock className="h-6 w-6" />}
      </div>
      <h2 className="mt-5 font-sans text-[22px] font-extrabold tracking-tight text-ink">{title}</h2>
      <p className="mt-2 text-[13.5px] leading-relaxed text-ink-mid">{description}</p>
      {bullets && bullets.length > 0 ? (
        <ul className="mx-auto mt-5 max-w-md space-y-2 text-left text-[13px] text-ink-mid">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2 rounded-button bg-foam px-3 py-2">
              <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-forest-600" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-6 flex flex-col items-center gap-2 text-[12.5px] text-ink-light">
        {shipTarget ? (
          <span>
            Target: <span className="font-semibold text-ink-mid">{shipTarget}</span>
          </span>
        ) : null}
        {backHref ? (
          <Link
            href={backHref}
            className="font-semibold text-forest-600 underline-offset-4 hover:underline"
          >
            {backLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
