'use client';

import { Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

/**
 * CSAT rating widget shown on resolved platform support tickets.
 *
 * Posts to `POST /api/landlord/support/[ticketId]/csat` with the
 * selected rating + optional free-text comment. The widget folds
 * away (shows a "Thanks!" confirmation) once an existing rating is
 * present so landlords can see what they submitted but not double-
 * rate.
 *
 * Server enforcement lives in:
 *   - the route handler (rejects non-reporters / unresolved tickets)
 *   - the `platform_support_tickets_csat_by_reporter` RLS policy
 */

export function CsatWidget({
  ticketId,
  existingRating,
  existingComment,
}: {
  ticketId: string;
  existingRating: number | null;
  existingComment: string | null;
}) {
  const router = useRouter();
  const [rating, setRating] = useState<number | null>(existingRating);
  const [hover, setHover] = useState<number | null>(null);
  const [comment, setComment] = useState(existingComment ?? '');
  const [submittedRating, setSubmittedRating] = useState<number | null>(existingRating);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    if (!rating) {
      setError('Pick a rating between 1 and 5');
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/landlord/support/${ticketId}/csat`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ rating, comment: comment.trim() || null }),
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          setError(payload?.error?.message ?? 'Could not submit rating');
          return;
        }
        setSubmittedRating(rating);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Network error');
      }
    });
  };

  if (submittedRating !== null) {
    return (
      <div className="rounded-card border border-forest-100 bg-forest-50 p-3.5">
        <p className="text-[12.5px] font-semibold text-forest-700">
          Thanks for the feedback! You rated this {submittedRating}/5.
        </p>
        {comment ? <p className="mt-1 text-[12px] text-ink-mid">“{comment}”</p> : null}
      </div>
    );
  }

  const display = hover ?? rating ?? 0;

  return (
    <div className="rounded-card border border-border-soft bg-white p-3.5">
      <h4 className="text-[13px] font-semibold text-ink">How was the resolution?</h4>
      <p className="mt-0.5 text-[12px] text-ink-light">
        Helps us improve the support team. Optional comment.
      </p>
      <fieldset className="mt-2 flex items-center gap-1.5 border-0 p-0 m-0">
        <legend className="sr-only">Rating</legend>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            aria-pressed={rating === star}
            aria-label={`${star} star${star === 1 ? '' : 's'}`}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(star)}
            onBlur={() => setHover(null)}
            onClick={() => setRating(star)}
            className="rounded-button p-0.5 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-forest-200"
          >
            <Star
              className={cn(
                'h-6 w-6 transition-colors',
                star <= display ? 'fill-amber text-amber' : 'fill-transparent text-ink-light',
              )}
              aria-hidden="true"
            />
          </button>
        ))}
      </fieldset>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder="What worked well — or didn't?"
        className="mt-2.5 w-full resize-none rounded-button border border-border-soft bg-bg-page px-2.5 py-2 text-[12.5px] text-ink placeholder:text-ink-light focus:border-forest-400 focus:outline-none focus:ring-2 focus:ring-forest-200"
      />
      {error ? <p className="mt-1.5 text-[12px] text-alert">{error}</p> : null}
      <div className="mt-2.5 flex justify-end">
        <Button size="sm" type="button" onClick={submit} disabled={isPending || !rating}>
          {isPending ? 'Submitting…' : 'Submit rating'}
        </Button>
      </div>
    </div>
  );
}
