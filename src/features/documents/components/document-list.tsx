'use client';

import { Download, FileText, FileType2, Image as ImageIcon, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DOCUMENT_CATEGORY_RULES } from '@/core/constants/documents';
import type { Document, DocumentListFilter } from '@/core/schemas/document';
import { relativeTimeShort } from '@/core/utils/dates';
import { formatBytes, parentTypeLabel } from '@/core/utils/document-rules';
import { cn } from '@/lib/cn';
import { deleteDocumentApi, getDocumentSignedUrl, listDocumentsApi } from '../api/client';

/**
 * Renders a list of documents the caller can see, scoped by the
 * provided filter. Owns its own fetch + refresh; parents pass an
 * optional `revision` integer they bump after a successful upload.
 */
export type DocumentListProps = {
  filter: Partial<DocumentListFilter>;
  /** Bump to force a re-fetch (e.g. after an upload). */
  revision?: number;
  /** Show the "delete" action on each row. Defaults to true. */
  canDelete?: boolean;
  /** Optional initial server-rendered list to avoid the first fetch. */
  initial?: Document[];
  className?: string;
  emptyMessage?: string;
};

export function DocumentList({
  filter,
  revision = 0,
  canDelete = true,
  initial,
  className,
  emptyMessage = 'No documents yet.',
}: DocumentListProps) {
  const [documents, setDocuments] = useState<Document[]>(initial ?? []);
  const [loading, setLoading] = useState(initial === undefined);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Stringify the filter so we can re-fetch only when its meaningful
  // contents change, without React's compiler complaining about
  // "captures more than its dependencies" on individual fields.
  const filterKey = JSON.stringify(filter);

  useEffect(() => {
    let cancelled = false;
    // Touch `revision` so the rule of hooks sees it as a real dependency;
    // its identity-only role (force re-fetch) is intentional.
    void revision;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const parsed = JSON.parse(filterKey) as Partial<DocumentListFilter>;
        const res = await listDocumentsApi(parsed);
        if (!cancelled) setDocuments(res.documents);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load documents');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [filterKey, revision]);

  const onOpen = async (doc: Document) => {
    setBusyId(doc.id);
    try {
      const { url } = await getDocumentSignedUrl(doc.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not open document');
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (doc: Document) => {
    if (!confirm(`Delete "${doc.filename}"? This cannot be undone.`)) return;
    setBusyId(doc.id);
    try {
      await deleteDocumentApi(doc.id);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      toast.success('Document deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete document');
    } finally {
      setBusyId(null);
    }
  };

  if (loading && documents.length === 0) {
    return <p className={cn('text-sm text-muted-foreground', className)}>Loading documents…</p>;
  }
  if (error) {
    return (
      <p className={cn('text-sm text-destructive', className)} role="alert">
        {error}
      </p>
    );
  }
  if (documents.length === 0) {
    return <p className={cn('text-sm text-muted-foreground', className)}>{emptyMessage}</p>;
  }

  return (
    <ul className={cn('divide-y divide-border rounded-md border border-border', className)}>
      {documents.map((doc) => (
        <li
          key={doc.id}
          className="flex items-center gap-3 px-3 py-2.5 text-sm"
          aria-busy={busyId === doc.id}
        >
          <DocIcon mime={doc.mime_type} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">{doc.title || doc.filename}</span>
              <Badge variant="secondary" className="text-[10px]">
                {DOCUMENT_CATEGORY_RULES[doc.category].label}
              </Badge>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {parentTypeLabel(doc.kind)} · {formatBytes(doc.size_bytes)} ·{' '}
              {relativeTimeShort(doc.created_at)}
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpen(doc)}
              disabled={busyId === doc.id}
              aria-label={`Open ${doc.filename}`}
            >
              <Download className="h-4 w-4" aria-hidden />
            </Button>
            {canDelete && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onDelete(doc)}
                disabled={busyId === doc.id}
                aria-label={`Delete ${doc.filename}`}
              >
                <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function DocIcon({ mime }: { mime: string }) {
  if (mime.startsWith('image/')) {
    return <ImageIcon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />;
  }
  if (mime === 'application/pdf') {
    return <FileType2 className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />;
  }
  return <FileText className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />;
}
