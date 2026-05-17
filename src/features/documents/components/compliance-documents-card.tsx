'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DocumentList } from './document-list';
import { DocumentUploader } from './document-uploader';

/**
 * Card section embedded in the compliance item detail page.
 *
 * Shows previously-uploaded certificates for this compliance item and an
 * uploader. Uploading bumps a `revision` counter that the embedded list
 * watches so the row appears immediately after a successful upload.
 */
export function ComplianceDocumentsCard({ complianceItemId }: { complianceItemId: string }) {
  const [revision, setRevision] = useState(0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Documents</CardTitle>
        <CardDescription>
          Upload the actual certificate (PDF or photo) for this compliance item. The most recent
          upload becomes the headline document on this card; older versions stay available below for
          the audit trail.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <DocumentUploader
          parent={{ kind: 'compliance', compliance_item_id: complianceItemId }}
          defaultCategory="certificate"
          onUploaded={() => setRevision((r) => r + 1)}
        />
        <div>
          <h3 className="mb-2 text-sm font-medium">Previously uploaded</h3>
          <DocumentList
            filter={{
              kind: 'compliance',
              compliance_item_id: complianceItemId,
              limit: 20,
            }}
            revision={revision}
            emptyMessage="No certificates uploaded yet."
          />
        </div>
      </CardContent>
    </Card>
  );
}
