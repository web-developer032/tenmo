import { describe, expect, it } from 'vitest';
import { LISTING_SEARCH_MAX_PAGE_SIZE, LISTING_SEARCH_PAGE_SIZE } from '../../constants/listings';
import {
  buildListingSearchFilters,
  clampPage,
  clampPerPage,
  listingTotalPages,
} from '../listing-search';

describe('clampPage', () => {
  it('clamps zero / negative / fractional page numbers to 1+', () => {
    expect(clampPage(undefined)).toBe(1);
    expect(clampPage(null)).toBe(1);
    expect(clampPage(0)).toBe(1);
    expect(clampPage(-3)).toBe(1);
    expect(clampPage(2.7)).toBe(2);
  });
});

describe('clampPerPage', () => {
  it('uses the default page size when missing', () => {
    expect(clampPerPage(undefined)).toBe(LISTING_SEARCH_PAGE_SIZE);
  });

  it('caps perPage at the documented maximum', () => {
    expect(clampPerPage(LISTING_SEARCH_MAX_PAGE_SIZE + 100)).toBe(LISTING_SEARCH_MAX_PAGE_SIZE);
  });

  it('clamps zero / negative to 1', () => {
    expect(clampPerPage(0)).toBe(1);
    expect(clampPerPage(-7)).toBe(1);
  });
});

describe('buildListingSearchFilters', () => {
  it('passes through trimmed strings + uppercases postcode prefix', () => {
    const args = buildListingSearchFilters({
      city: '  London  ',
      postcode_prefix: 'sw1a',
    });
    expect(args.p_city).toBe('London');
    expect(args.p_postcode_prefix).toBe('SW1A');
  });

  it('drops empty strings', () => {
    const args = buildListingSearchFilters({ city: '   ' });
    expect(args.p_city).toBeNull();
  });

  it('swaps min/max rent if the user inverts them (defensive UX)', () => {
    const args = buildListingSearchFilters({
      min_rent_pence: 200_000,
      max_rent_pence: 100_000,
    });
    expect(args.p_min_rent_pence).toBe(100_000);
    expect(args.p_max_rent_pence).toBe(200_000);
  });

  it('translates page+perPage into limit/offset for the RPC', () => {
    const args = buildListingSearchFilters({ page: 3, per_page: 10 });
    expect(args.p_limit).toBe(10);
    expect(args.p_offset).toBe(20);
  });

  it('coerces booleans for has_ensuite passthrough', () => {
    expect(buildListingSearchFilters({ has_ensuite: true }).p_has_ensuite).toBe(true);
    expect(buildListingSearchFilters({ has_ensuite: false }).p_has_ensuite).toBe(false);
    expect(buildListingSearchFilters({}).p_has_ensuite).toBeNull();
  });
});

describe('listingTotalPages', () => {
  it('returns 1 even for zero rows so the UI shows "page 1 of 1"', () => {
    expect(listingTotalPages(0, 24)).toBe(1);
  });

  it('rounds up partial pages', () => {
    expect(listingTotalPages(25, 24)).toBe(2);
    expect(listingTotalPages(48, 24)).toBe(2);
    expect(listingTotalPages(49, 24)).toBe(3);
  });
});
