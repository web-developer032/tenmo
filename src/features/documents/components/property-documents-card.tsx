'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DocumentList } from './document-list';
import { DocumentUploader } from './document-uploader';

/**
 * Property-scope documents tab: photos, insurance, manuals, receipts.
 */
export function PropertyDocumentsCard({ propertyId }: { propertyId: string }) {
  const [revision, setRevision] = useState(0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Documents</CardTitle>
        <CardDescription>
          Property-level files — photos, insurance certificates, appliance manuals, contractor
          receipts. Tenants on this property only see the categories relevant to them; sensitive
          items (insurance, receipts) stay private.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <DocumentUploader
          parent={{ kind: 'property', property_id: propertyId }}
          defaultCategory="photo"
          onUploaded={() => setRevision((r) => r + 1)}
        />
        <div>
          <h3 className="mb-2 text-sm font-medium">Uploaded files</h3>
          <DocumentList
            filter={{ kind: 'property', property_id: propertyId, limit: 30 }}
            revision={revision}
            emptyMessage="No property documents yet."
          />
        </div>
      </CardContent>
    </Card>
  );
}
