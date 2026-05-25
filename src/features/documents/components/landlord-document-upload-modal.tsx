'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { DocumentUploader } from './document-uploader';

/**
 * Wraps the shared `DocumentUploader` in a modal trigger so the
 * landlord vault page can host its own upload affordance without
 * splitting the underlying upload helper into a separate flow.
 *
 * Uploads default to the `general` kind because the vault is a
 * portfolio-wide view — power users can re-categorise the file
 * later from the row actions on each parent.
 */
export function LandlordDocumentUploadModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> Upload document
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload document</DialogTitle>
          <DialogDescription>
            Add a file to your portfolio vault. You can attach it to a property, tenancy or
            compliance item from that record after upload.
          </DialogDescription>
        </DialogHeader>
        <DocumentUploader
          parent={{ kind: 'general' }}
          onUploaded={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
