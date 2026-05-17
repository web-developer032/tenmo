'use client';

import { Search, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Client-side listings search filter bar.
 *
 * Maps form state into URL search params so the page is shareable and the
 * results live in the server component below it (no client fetch).
 */
const PROPERTY_TYPES: ReadonlyArray<{ value: string; label: string }> = [
  { value: '', label: 'Any type' },
  { value: 'whole_property', label: 'Whole property' },
  { value: 'hmo_small', label: 'Small HMO' },
  { value: 'hmo_large', label: 'Large HMO' },
  { value: 'flat', label: 'Flat' },
  { value: 'studio', label: 'Studio' },
  { value: 'bedsit', label: 'Bedsit' },
];

export function ListingsFiltersForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [city, setCity] = useState(params.get('city') ?? '');
  const [postcode, setPostcode] = useState(params.get('postcode_prefix') ?? '');
  const [maxRent, setMaxRent] = useState(params.get('max_rent_pence') ?? '');
  const [propertyType, setPropertyType] = useState(params.get('property_type') ?? '');
  const [hasEnsuite, setHasEnsuite] = useState(params.get('has_ensuite') === 'true');

  function apply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const usp = new URLSearchParams();
    if (city.trim()) usp.set('city', city.trim());
    if (postcode.trim()) usp.set('postcode_prefix', postcode.trim().toUpperCase());
    if (maxRent && Number(maxRent) > 0)
      usp.set('max_rent_pence', String(Math.round(Number(maxRent) * 100)));
    if (propertyType) usp.set('property_type', propertyType);
    if (hasEnsuite) usp.set('has_ensuite', 'true');
    router.push(`/listings?${usp.toString()}`);
  }

  function clear() {
    setCity('');
    setPostcode('');
    setMaxRent('');
    setPropertyType('');
    setHasEnsuite(false);
    router.push('/listings');
  }

  return (
    <form
      onSubmit={apply}
      className="grid grid-cols-1 gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 md:grid-cols-3"
    >
      <div className="space-y-1">
        <Label htmlFor="listing-filter-city">City</Label>
        <Input
          id="listing-filter-city"
          name="city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="e.g. London"
          autoComplete="address-level2"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="listing-filter-postcode">Postcode (outward)</Label>
        <Input
          id="listing-filter-postcode"
          name="postcode_prefix"
          value={postcode}
          onChange={(e) => setPostcode(e.target.value)}
          placeholder="e.g. SW1A"
          maxLength={4}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="listing-filter-rent">Max rent (£/mo)</Label>
        <Input
          id="listing-filter-rent"
          type="number"
          inputMode="numeric"
          value={maxRent}
          onChange={(e) => setMaxRent(e.target.value)}
          placeholder="1500"
          min={0}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="listing-filter-type">Property type</Label>
        <select
          id="listing-filter-type"
          value={propertyType}
          onChange={(e) => setPropertyType(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
        >
          {PROPERTY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 self-end pb-2">
        <input
          type="checkbox"
          checked={hasEnsuite}
          onChange={(e) => setHasEnsuite(e.target.checked)}
          className="h-4 w-4 rounded border"
        />
        <span className="text-sm">Ensuite only</span>
      </label>
      <div className="flex items-end gap-2">
        <Button type="submit" className="w-full">
          <Search className="mr-1 h-4 w-4" /> Search
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={clear}
          aria-label="Clear filters"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
