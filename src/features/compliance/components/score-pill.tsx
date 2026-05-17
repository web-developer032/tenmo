import { cn } from '@/lib/cn';
import { scoreTone } from '../status-display';

/**
 * Big numeric badge for compliance health (0..100). Used on the org-level
 * dashboard hero card and per-property cards.
 */
export function ScorePill({
  score,
  className,
  size = 'md',
}: {
  score: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizing =
    size === 'lg' ? 'text-4xl md:text-5xl' : size === 'sm' ? 'text-lg' : 'text-2xl md:text-3xl';
  return (
    <span className={cn('font-semibold tabular-nums', sizing, scoreTone(score), className)}>
      {Math.max(0, Math.min(100, score))}
      <span className="ml-0.5 text-base text-muted-foreground">%</span>
    </span>
  );
}
