'use client';

import { Loader2, Paperclip, X } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  TICKET_ATTACHMENT_MAX_BYTES,
  TICKET_ATTACHMENT_MIME_ALLOWLIST,
} from '@/core/constants/tickets';

export type AttachmentPickerHandle = {
  /** Storage paths the user has uploaded for the next message. */
  attachmentPaths: string[];
  resetAttachments: () => void;
};

/**
 * Attachment picker for ticket messages.
 *
 * Behaviour:
 *  - On file pick, requests a signed upload URL from the server and PUTs the
 *    file directly to Supabase Storage. The form only carries the resulting
 *    `path` (not the bytes).
 *  - Validates size + MIME on the client before requesting the URL so we don't
 *    waste a round-trip on impossible uploads.
 *  - Disabled state surfaced through `onPendingChange` so the parent form
 *    blocks submission while uploads are in flight.
 *
 * `ticketId` may be null when used on the tenant "new ticket" form (the
 * ticket doesn't exist yet). In that case we ask for a *temporary* path under
 * a per-property + draft pseudo-id by passing `pendingTicketId`. For now we
 * only allow attachments after creation; "create-with-attachments" will be
 * a follow-up.
 */
export function AttachmentPicker({
  ticketId,
  onChange,
  onPendingChange,
  disabled,
}: {
  ticketId: string;
  onChange: (paths: string[]) => void;
  onPendingChange?: (pending: boolean) => void;
  disabled?: boolean;
}) {
  const [paths, setPaths] = React.useState<string[]>([]);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => onChange(paths), [paths, onChange]);
  React.useEffect(() => onPendingChange?.(pending), [pending, onPendingChange]);

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setPending(true);
    try {
      const next: string[] = [...paths];
      for (const file of Array.from(files)) {
        if (file.size > TICKET_ATTACHMENT_MAX_BYTES) {
          throw new Error(`${file.name} is over the 25MB limit.`);
        }
        if (!(TICKET_ATTACHMENT_MIME_ALLOWLIST as readonly string[]).includes(file.type)) {
          throw new Error(`${file.name}: file type not allowed.`);
        }
        const res = await fetch(`/api/tickets/${ticketId}/attachments/upload-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            mime_type: file.type,
            size_bytes: file.size,
          }),
        });
        const json = (await res.json().catch(() => null)) as {
          data?: { path: string; signedUrl: string };
          error?: { message?: string };
        } | null;
        if (!res.ok || !json?.data) {
          throw new Error(json?.error?.message ?? 'Could not get an upload URL');
        }
        const upload = await fetch(json.data.signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        });
        if (!upload.ok) {
          throw new Error(`Upload failed for ${file.name}`);
        }
        next.push(json.data.path);
      }
      setPaths(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removePath = (p: string) => setPaths((prev) => prev.filter((x) => x !== p));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || pending}
          onClick={() => inputRef.current?.click()}
        >
          {pending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Paperclip className="mr-2 h-4 w-4" />
          )}
          {pending ? 'Uploading…' : 'Add photos / files'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={TICKET_ATTACHMENT_MIME_ALLOWLIST.join(',')}
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
        <span className="text-xs text-muted-foreground">
          Up to 25MB each — JPG, PNG, HEIC, PDF, MP4.
        </span>
      </div>
      {paths.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {paths.map((p) => (
            <li
              key={p}
              className="flex items-center gap-1.5 rounded-md border bg-muted/50 px-2 py-1 text-xs"
            >
              <Paperclip className="h-3 w-3" />
              <span className="max-w-[14rem] truncate font-medium">{filenameFromPath(p)}</span>
              <button
                type="button"
                aria-label="Remove attachment"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => removePath(p)}
                disabled={disabled || pending}
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="text-xs text-alert">{error}</p> : null}
    </div>
  );
}

function filenameFromPath(path: string): string {
  const last = path.split('/').pop() ?? path;
  const dash = last.indexOf('-');
  return dash > 0 ? last.slice(dash + 1) : last;
}
