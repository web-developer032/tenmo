'use client';

import type { FieldPath, FieldValues, UseFormReturn } from 'react-hook-form';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { isSlug, slugify } from '@/core/utils/slug';

/**
 * Slug input with a prefix slot and a "did you mean ..." auto-correct chip.
 *
 * Used by the org-create form (Workspace URL) and any future slug surfaces
 * (e.g. property slugs). Encapsulates three pieces of behaviour that used
 * to live inline and looked broken together:
 *
 *  1. The grey hint and the red zod error rendered word-for-word the same
 *     line, so violators saw the rule twice. We now hide the hint when
 *     there's an error.
 *  2. The zod error didn't tell the user what to fix — only what was
 *     allowed. We now run `slugify` on the current value and surface the
 *     fixed slug as a one-click "Use `morgan-lettings` instead" chip.
 *  3. The field had no way to apply that suggestion without typing it by
 *     hand. The chip is a real button that calls `form.setValue` and
 *     re-validates.
 */
export interface SlugFieldProps<TFieldValues extends FieldValues> {
  form: UseFormReturn<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  /** Static prefix shown in the muted slot before the input (e.g.
   * `tenantly.co.uk/landlord/`). */
  prefix: string;
  placeholder?: string;
  /** Helper line shown under the input when there's no error. */
  description?: string;
}

export function SlugField<TFieldValues extends FieldValues>({
  form,
  name,
  label,
  prefix,
  placeholder,
  description,
}: SlugFieldProps<TFieldValues>) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field, fieldState }) => {
        const raw = (field.value as string | undefined) ?? '';
        const fixed = slugify(raw);
        const hasError = Boolean(fieldState.error);
        const suggestionIsBetter = fixed.length >= 3 && fixed !== raw && isSlug(fixed);

        const applySuggestion = () => {
          form.setValue(name, fixed as TFieldValues[typeof name], {
            shouldDirty: true,
            shouldValidate: true,
            shouldTouch: true,
          });
        };

        return (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <FormControl>
              <div className="flex items-stretch overflow-hidden rounded-button border border-border-soft bg-white focus-within:border-forest-600 focus-within:ring-2 focus-within:ring-forest-500/30">
                <span className="flex items-center bg-sand px-3 text-[12.5px] text-ink-light">
                  {prefix}
                </span>
                <Input
                  className="border-0 bg-transparent focus-visible:border-transparent focus-visible:ring-0"
                  placeholder={placeholder}
                  {...field}
                  value={raw}
                />
              </div>
            </FormControl>
            {hasError ? null : description ? (
              <FormDescription>{description}</FormDescription>
            ) : null}
            <FormMessage />
            {hasError && suggestionIsBetter ? (
              <button
                type="button"
                onClick={applySuggestion}
                className="inline-flex items-center gap-1.5 self-start rounded-button border border-forest-200 bg-foam px-2.5 py-1 text-[12px] font-semibold text-forest-700 transition-colors hover:bg-foam/70"
              >
                Use{' '}
                <code className="rounded-sm bg-white px-1.5 py-0.5 font-mono text-[11.5px] text-forest-700">
                  {fixed}
                </code>{' '}
                instead
              </button>
            ) : null}
          </FormItem>
        );
      }}
    />
  );
}
