import { Bath, BedDouble, Home, MapPin } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PublicListing } from '@/core/schemas/listing';
import { formatMoney } from '@/core/utils/money';

/**
 * Single result card on the public listings grid.
 *
 * Self-contained — anonymous-safe (city + outward postcode only) so this
 * component can be rendered for both signed-in and signed-out viewers.
 */
export function ListingCard({ listing }: { listing: PublicListing }) {
  const rent = listing.default_rent_pence
    ? `${formatMoney(listing.default_rent_pence)}${
        listing.default_rent_frequency === 'weekly' ? ' / wk' : ' / mo'
      }`
    : 'Rent on request';

  const propertyTypeLabel = listing.property_type.replace('_', ' ');
  const location = [listing.city, listing.postcode_outward].filter(Boolean).join(' · ');

  return (
    <Link
      href={`/listings/${listing.room_id}`}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Card className="h-full transition-colors hover:border-primary/50">
        <CardHeader className="space-y-2 pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base leading-snug">{listing.room_name}</CardTitle>
            {listing.listing_bills_included || listing.bills_included ? (
              <Badge variant="secondary">Bills inc.</Badge>
            ) : null}
          </div>
          <div className="text-sm text-muted-foreground">{listing.property_name}</div>
          {location ? (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" /> {location}
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="text-lg font-semibold">{rent}</div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 capitalize">
              <Home className="h-3 w-3" /> {propertyTypeLabel}
            </span>
            {listing.has_double_bed ? (
              <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5">
                <BedDouble className="h-3 w-3" /> Double
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
          </div>
          {listing.listing_description ? (
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {listing.listing_description}
            </p>
          ) : null}
          {listing.listing_available_from ? (
            <div className="text-xs text-muted-foreground">
              Available from{' '}
              <span className="font-medium text-foreground">{listing.listing_available_from}</span>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}
