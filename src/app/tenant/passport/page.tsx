import { ArrowLeft, BookUser } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ExportHistoryList } from '@/features/passport/components/export-history-list';
import { ExportPassportButton } from '@/features/passport/components/export-passport-button';
import { PassportPreview } from '@/features/passport/components/passport-preview';
import { loadPassportExportsForCaller, loadPassportForCaller } from '@/features/passport/loaders';

export const dynamic = 'force-dynamic';

/**
 * Tenant Rental Passport page.
 *
 * Top — exportable preview of the passport contents (single source
 * of truth: same shape as the PDF). Bottom — past exports with
 * fresh signed download links.
 *
 * Free for every tenant, regardless of subscription.
 */
export default async function TenantPassportPage() {
  const passport = await loadPassportForCaller();
  if (!passport) redirect('/login?redirect=/tenant/passport');
  const exports = await loadPassportExportsForCaller();

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <Button asChild variant="ghost" size="sm">
        <Link href="/tenant">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to your home
        </Link>
      </Button>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BookUser className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Rental Passport</h1>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            A portable record of who you are as a renter — your verified ID, payment history and
            tenancy record. Yours to take with you. Free, forever.
          </p>
        </div>
        <ExportPassportButton />
      </header>

      <PassportPreview passport={passport} />

      <ExportHistoryList exports={exports} />
    </div>
  );
}
