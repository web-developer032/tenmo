import { ArrowLeft, Bath, BedDouble, MapPin } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMoney } from '@/core/utils/money';
import { ApplyForm } from '@/features/listings/components/apply-form';
import { getPublicListingWithClient } from '@/features/listings/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Params = { roomId: string };

/**
 * Public detail page for a single room listing.
 *
 * - Anonymous viewers see the listing + a "Sign up to apply" CTA. The full
 *   street address is hidden (only city + outward postcode).
 * - Signed-in viewers see the full address + the in-page apply form.
 */
export default async function PublicListingDetailPage({ params }: { params: Promise<Params> }) {
  const { roomId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const listing = await getPublicListingWithClient(supabase, roomId);
  if (!listing) notFound();

  const rent = listing.default_rent_pence
    ? `${formatMoney(listing.default_rent_pence)}${listing.default_rent_frequency === 'weekly' ? ' / week' : ' / month'}`
    : 'Rent on request';

  const fullAddress = listing.full_address;
  const location = fullAddress
    ? [fullAddress.line1, fullAddress.line2, fullAddress.city, fullAddress.postcode]
        .filter(Boolean)
        .join(', ')
    : [listing.city, listing.postcode_outward].filter(Boolean).join(' · ');

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 md:px-8 md:py-10">
      <Button asChild variant="ghost" size="sm">
        <Link href="/listings">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to listings
        </Link>
      </Button>

      <header className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              {listing.room_name}
            </h1>
            <p className="text-sm text-muted-foreground">{listing.property_name}</p>
          </div>
          {listing.listing_bills_included || listing.bills_included ? (
            <Badge variant="secondary">Bills included</Badge>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          {location}
          {!fullAddress ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
              Sign in to see full address
            </span>
          ) : null}
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">About this room</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 capitalize">
                {listing.property_type.replace('_', ' ')}
              </span>
              {listing.has_double_bed ? (
                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5">
                  <BedDouble className="h-3 w-3" /> Double bed
                </span>
              ) : null}
              {listing.has_ensuite ? (
                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5">
                  <Bath className="h-3 w-3" /> Ensuite
                </span>
              ) : null}
              {listing.size_sqm ? (
                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5">
                  {listing.size_sqm} m²
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 capitalize">
                {listing.furnishing.replace('_', ' ')}
              </span>
            </div>
            {listing.listing_description ? (
              <p className="whitespace-pre-line text-foreground">{listing.listing_description}</p>
            ) : (
              <p className="text-muted-foreground">No additional description.</p>
            )}
            {listing.listing_min_term_months ? (
              <p className="text-xs text-muted-foreground">
                Minimum term: {listing.listing_min_term_months} months
              </p>
            ) : null}
            {listing.listing_available_from ? (
              <p className="text-xs text-muted-foreground">
                Available from{' '}
                <span className="font-medium text-foreground">
                  {listing.listing_available_from}
                </span>
              </p>
            ) : null}
          </CardContent>
        </Card>

        <aside className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Rent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{rent}</div>
              <p className="text-xs text-muted-foreground">
                Plus deposit + scheme — confirmed on offer.
              </p>
            </CardContent>
          </Card>

          {user ? (
            <ApplyForm roomId={listing.room_id} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Apply for this room</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  Sign up free as a tenant to apply, message the landlord, and track your
                  application.
                </p>
                <Button asChild className="w-full">
                  <Link
                    href={`/sign-up?redirect=${encodeURIComponent(`/listings/${listing.room_id}`)}`}
                  >
                    Sign up to apply
                  </Link>
                </Button>
                <Button asChild variant="ghost" className="w-full">
                  <Link
                    href={`/login?redirect=${encodeURIComponent(`/listings/${listing.room_id}`)}`}
                  >
                    Already have an account? Sign in
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </aside>
      </section>
    </div>
  );
}
