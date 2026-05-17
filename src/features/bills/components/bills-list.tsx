'use client';

import { Plus, Receipt } from 'lucide-react';
import * as React from 'react';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import type { Bill, BillAllocation } from '@/core/schemas/bills';
import { BillCard } from './bill-card';
import { BillForm, type BillFormRoom } from './bill-form';

/**
 * Top-level bills section for the landlord property page.
 *
 * Owns the "Add bill" toggle locally so the form lives next to the
 * list it adds to. The list itself is composed of server-rendered
 * BillCards that fall through to a single client island for delete.
 */
export function BillsList({
  propertyId,
  bills,
  rooms,
}: {
  propertyId: string;
  bills: ReadonlyArray<{ bill: Bill; allocations: BillAllocation[] }>;
  rooms: ReadonlyArray<BillFormRoom>;
}) {
  const [showForm, setShowForm] = React.useState(false);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Receipt className="h-4 w-4 text-muted-foreground" />
          Shared bills
        </h2>
        <Button
          size="sm"
          variant={showForm ? 'ghost' : 'default'}
          onClick={() => setShowForm((s) => !s)}
        >
          {showForm ? (
            'Cancel'
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              Add bill
            </>
          )}
        </Button>
      </div>

      {showForm ? (
        <BillForm propertyId={propertyId} rooms={rooms} onClose={() => setShowForm(false)} />
      ) : null}

      {bills.length === 0 && !showForm ? (
        <EmptyState
          icon={<Receipt className="h-6 w-6" />}
          title="No bills yet"
          description="Add electricity, gas, water and other shared bills to allocate them across rooms automatically."
        />
      ) : (
        <div className="space-y-3">
          {bills.map((entry) => (
            <BillCard
              key={entry.bill.id}
              bill={entry.bill}
              allocations={entry.allocations}
              rooms={rooms}
            />
          ))}
        </div>
      )}
    </section>
  );
}
