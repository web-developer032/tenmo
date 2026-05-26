'use client';

import { Download, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { getDocumentSignedUrl } from '../api/client';

/**
 * Single row for the tenant Documents page (`/tenant/documents`).
 *
 * Renders the design's `.doc-row`: an accent-tinted icon tile, the doc
 * title + meta line, and View/Download actions. Compliance rows include
 * a `Valid` badge in the right-hand stack.
 *
 * Both actions hit `/api/documents/[id]/url` — the same signed-URL flow
 * the rest of the docs UI uses. Compliance synthetic rows (no
 * `documentId`) render the actions disabled, since there's no file yet.
 */

type IconTone = 'blue' | 'forest' | 'amber';

const TILE_TINT: Record<IconTone, string> = {
  blue: 'bg-blue-bg text-blue',
  forest: 'bg-foam text-forest-700',
  amber: 'bg-amber-bg text-amber',
};

const VALID_BADGE = 'bg-forest-100 text-forest-700';
const EXPIRING_BADGE = 'bg-amber-bg text-amber';
const EXPIRED_BADGE = 'bg-alert-bg text-alert';

export type TenantDocRowProps = {
  documentId: string | null;
  iconTone: IconTone;
  title: string;
  meta: string;
  /** Optional compliance status badge (right-stack). */
  badge?: { label: string; tone: 'valid' | 'expiring' | 'expired' };
  /** Render a "Download" affordance even when no documentId (disabled). */
  showDownload?: boolean;
};

export function TenantDocRow({
  documentId,
  iconTone,
  title,
  meta,
  badge,
  showDownload = true,
}: TenantDocRowProps) {
  const [busy, setBusy] = useState(false);

  const onOpen = async () => {
    if (!documentId) {
      toast.info('Document not yet uploaded by your landlord.');
      return;
    }
    setBusy(true);
    try {
      const { url } = await getDocumentSignedUrl(documentId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not open document');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="flex items-center gap-3 border-b border-border-soft py-3 last:border-b-0 last:pb-0 first:pt-0"
      aria-busy={busy}
    >
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-button',
          TILE_TINT[iconTone],
        )}
        aria-hidden="true"
      >
        <DocIcon />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-ink">{title}</div>
        <div className="mt-0.5 truncate text-[11.5px] text-ink-light">{meta}</div>
      </div>
      {badge ? (
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider',
              badge.tone === 'valid'
                ? VALID_BADGE
                : badge.tone === 'expiring'
                  ? EXPIRING_BADGE
                  : EXPIRED_BADGE,
            )}
          >
            {badge.label}
          </span>
          {documentId ? (
            <button
              type="button"
              onClick={onOpen}
              disabled={busy}
              className="text-[11.5px] font-semibold text-forest-700 hover:underline"
            >
              View
            </button>
          ) : null}
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy || !documentId}
            onClick={onOpen}
            aria-label="View"
          >
            <ExternalLink className="h-4 w-4" /> View
          </Button>
          {showDownload ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy || !documentId}
              onClick={onOpen}
              aria-label="Download"
            >
              <Download className="h-4 w-4" /> Download
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function DocIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" role="img" aria-label="Document">
      <title>Document</title>
      <path
        d="M3 1h7l4 4v9a1 1 0 01-1 1H3a1 1 0 01-1-1V2a1 1 0 011-1Z"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
      />
      <path d="M9 1v4h4" stroke="currentColor" strokeWidth="1.3" fill="none" />
    </svg>
  );
}
