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
