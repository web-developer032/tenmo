import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Web-only Tailwind class merger. Lives in `lib/` (not `core/`) because it
 * carries Tailwind class strings — banned in the portable layer.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
