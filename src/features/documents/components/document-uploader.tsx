'use client';

import { Loader2, Upload } from 'lucide-react';
import type * as React from 'react';
import { useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DOCUMENT_CATEGORY_RULES,
  DOCUMENT_MAX_BYTES,
  DOCUMENT_MIME_ALLOWLIST,
  type DocumentCategory,
} from '@/core/constants/documents';
import type { DocumentParent } from '@/core/schemas/document';
import {
  formatBytes,
  suggestedCategories,
  validateUploadCandidate,
} from '@/core/utils/document-rules';
import { cn } from '@/lib/cn';
import { uploadDocument } from '../api/client';

/**
 * Reusable document uploader.
 *
 * Drop zone + file picker, category select, optional title/description,
 * progress bar, and inline validation. Hides the three-step "request URL
 * → PUT bytes → record row" dance — callers just hand it a parent and a
 * suggested category list.
 *
 * Composes well: drop one into a property page, a tenancy page, or a
 * compliance item card by passing the right `parent`.
 */
export type DocumentUploaderProps = {
  parent: DocumentParent;
  /** Defaults to `suggestedCategories(parent.kind, actorRole)`. */
  categories?: DocumentCategory[];
  /** Pre-selected category. Defaults to the first in `categories`. */
  defaultCategory?: DocumentCategory;
  /**
   * Role context — drives which categories are visible to the picker.
   * Named `actorRole` (not `role`) so Biome's `useValidAriaRole` rule
   * doesn't mistake it for an ARIA role attribute.
   */
  actorRole?: 'landlord' | 'tenant';
  /** Called after a successful upload, with the new document id. */
  onUploaded?: (documentId: string) => void;
  className?: string;
};

export function DocumentUploader({
  parent,
  categories,
  defaultCategory,
  actorRole = 'landlord',
  onUploaded,
  className,
}: DocumentUploaderProps) {
  const inputId = useId();
  const titleId = useId();
  const descId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const choices = categories ?? suggestedCategories(parent.kind, actorRole);
  const [category, setCategory] = useState<DocumentCategory>(
    defaultCategory ?? choices[0] ?? 'other',
  );
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPickFile = (file: File) => {
    setError(null);
    const v = validateUploadCandidate({
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    });
    if (!v.ok) {
      const msg =
        v.error === 'mime'
          ? `Unsupported file type. Allowed: ${DOCUMENT_MIME_ALLOWLIST.join(', ')}`
          : v.error === 'size'
            ? `File too large. Max ${formatBytes(DOCUMENT_MAX_BYTES)}.`
            : 'Invalid file';
      setError(msg);
      return;
    }
    void runUpload(file);
  };

  const runUpload = async (file: File) => {
    setBusy(true);
    setProgress(0);
    try {
      const doc = await uploadDocument(
        {
          file,
          parent,
          category,
          title: title.trim() || undefined,
          description: description.trim() || undefined,
        },
        { onProgress: setProgress },
      );
      toast.success(`Uploaded ${doc.filename}`);
      setTitle('');
      setDescription('');
      onUploaded?.(doc.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
      setProgress(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${inputId}-category`}>Category</Label>
          <select
            id={`${inputId}-category`}
            value={category}
            onChange={(e) => setCategory(e.target.value as DocumentCategory)}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            disabled={busy}
          >
            {choices.map((c) => (
              <option key={c} value={c}>
                {DOCUMENT_CATEGORY_RULES[c].label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            {DOCUMENT_CATEGORY_RULES[category].description}
          </p>
        </div>
        <div>
          <Label htmlFor={titleId}>Title (optional)</Label>
          <Input
            id={titleId}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. CP12 issued 04/2026"
            maxLength={200}
            disabled={busy}
            className="mt-1"
          />
        </div>
      </div>
      <div>
        <Label htmlFor={descId}>Notes (optional)</Label>
        <textarea
          id={descId}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          rows={2}
          disabled={busy}
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <DropZone
        busy={busy}
        dragOver={dragOver}
        onClick={() => inputRef.current?.click()}
        onDrag={setDragOver}
        onDrop={onPickFile}
      >
        {busy ? (
          <>
            <Loader2 className="mb-2 h-6 w-6 animate-spin text-primary" aria-hidden />
            <p className="text-sm text-muted-foreground">Uploading… {progress ?? 0}%</p>
          </>
        ) : (
          <>
            <Upload className="mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
            <p className="text-sm">
              <span className="font-medium">Click to choose a file</span> or drag &amp; drop
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              PDF, JPG, PNG, WebP, HEIC · up to {formatBytes(DOCUMENT_MAX_BYTES)}
            </p>
          </>
        )}
      </DropZone>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept={DOCUMENT_MIME_ALLOWLIST.join(',')}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPickFile(f);
        }}
      />

      {progress !== null && (
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <div className="h-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {!busy && progress === null && (
        <div className="flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={() => inputRef.current?.click()}>
            Browse files
          </Button>
        </div>
      )}
    </div>
  );
}

type DropZoneProps = {
  busy: boolean;
  dragOver: boolean;
  onClick: () => void;
  onDrag: (over: boolean) => void;
  onDrop: (file: File) => void;
  children: React.ReactNode;
};

function DropZone({ busy, dragOver, onClick, onDrag, onDrop, children }: DropZoneProps) {
  return (
    <button
      type="button"
      aria-label="Drop a file here or click to browse"
      onClick={onClick}
      onDragOver={(e) => {
        e.preventDefault();
        onDrag(true);
      }}
      onDragLeave={() => onDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        onDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onDrop(f);
      }}
      disabled={busy}
      className={cn(
        'flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-input bg-muted/20 px-6 py-10 text-center transition',
        dragOver && 'border-primary bg-primary/5',
        busy && 'cursor-not-allowed opacity-60',
      )}
    >
      {children}
    </button>
  );
}
