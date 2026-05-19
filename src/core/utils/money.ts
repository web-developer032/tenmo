/**
 * Money helpers — work in **pence** internally, format for display.
 *
 * Tenantly stores all money as integer pence; floats are banned in the schema.
 */

export type Money = {
  amountPence: number;
  currency: 'GBP';
};

const GBP_FORMATTER = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function pence(value: number): Money {
  if (!Number.isInteger(value)) {
    throw new TypeError('Money values must be integer pence.');
  }
  if (value < 0) {
    throw new RangeError('Money values must be non-negative.');
  }
  return { amountPence: value, currency: 'GBP' };
}

export function pounds(value: number): Money {
  return pence(Math.round(value * 100));
}

export function formatMoney(money: Money | number): string {
  const amountPence = typeof money === 'number' ? money : money.amountPence;
  return GBP_FORMATTER.format(amountPence / 100);
}

const GBP_WHOLE = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Compact GBP display (no decimals). Useful for KPI tiles where the
 * extra precision adds visual noise (e.g. "£28,416" not "£28,416.00").
 */
export function formatMoneyWhole(money: Money | number): string {
  const amountPence = typeof money === 'number' ? money : money.amountPence;
  return GBP_WHOLE.format(Math.round(amountPence / 100));
}

/**
 * Short-form GBP (k/M) for dashboard summaries. Always returns at
 * most 4 characters of digits.
 *   850       → £850
 *   28_416 → £28k
 *   341_000 → £341k
 *   1_240_000 → £1.2M
 */
export function formatMoneyShort(money: Money | number): string {
  const amountPence = typeof money === 'number' ? money : money.amountPence;
  const pounds = Math.round(amountPence / 100);
  if (pounds < 1000) return `£${pounds}`;
  if (pounds < 100_000) return `£${Math.round(pounds / 1000)}k`;
  if (pounds < 1_000_000) return `£${Math.round(pounds / 1000)}k`;
  return `£${(pounds / 1_000_000).toFixed(1)}M`;
}

export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot add ${a.currency} and ${b.currency}`);
  }
  return { amountPence: a.amountPence + b.amountPence, currency: a.currency };
}

export function subMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot subtract ${a.currency} and ${b.currency}`);
  }
  return pence(Math.max(0, a.amountPence - b.amountPence));
}

/** Multiply a money value by a unitless factor (e.g. for proration). */
export function mulMoney(a: Money, factor: number): Money {
  return pence(Math.round(a.amountPence * factor));
}
