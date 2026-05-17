'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DocumentList } from './document-list';
import { DocumentUploader } from './document-uploader';

/**
 * Tenancy-scope documents tab: AST, prescribed information, inventory,
 * Right-to-Rent ID copies. Categories visible to tenants are filtered
 * server-side via RLS (`category <> 'identity'`).
 *
 * `actorRole` (not `role`) is used to avoid Biome's `useValidAriaRole`
 * lint, which treats any prop literally named `role` as if it were an
 * ARIA role attribute.
 */
export function TenancyDocumentsCard({
  tenancyId,
  actorRole = 'landlord',
}: {
  tenancyId: string;
  actorRole?: 'landlord' | 'tenant';
}) {
  const [revision, setRevision] = useState(0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Documents</CardTitle>
        <CardDescription>
          Tenancy-level files — signed AST, prescribed information, inventory.
          {actorRole === 'landlord' &&
            ' RTR ID copies are stored privately and never shown to the tenant.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {actorRole === 'landlord' && (
          <DocumentUploader
            parent={{ kind: 'tenancy', tenancy_id: tenancyId }}
            defaultCategory="ast"
            actorRole="landlord"
            onUploaded={() => setRevision((r) => r + 1)}
          />
        )}
        <div>
          <h3 className="mb-2 text-sm font-medium">Uploaded files</h3>
          <DocumentList
            filter={{ kind: 'tenancy', tenancy_id: tenancyId, limit: 30 }}
            revision={revision}
            canDelete={actorRole === 'landlord'}
            emptyMessage="No tenancy documents yet."
          />
        </div>
      </CardContent>
    </Card>
  );
}
