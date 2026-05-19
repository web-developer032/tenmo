'use client';

import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type SearchHit = {
  id: string;
  full_name: string | null;
  preferred_name: string | null;
  contact_email: string | null;
};

/**
 * Topbar-adjacent "search every profile" popover.
 *
 * Preserves the capability of the legacy `/admin/users` page (which
 * used to list every profile on the platform) after that route was
 * repurposed for User Management. Calls the admin-only
 * `/api/admin/profiles/search` endpoint which returns the matching
 * profile IDs and navigates to `/admin/users/[id]` on click.
 */
export function AllProfilesSearchPopover() {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const search = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = term.trim();
    if (q.length < 2) {
      toast.error('Enter at least 2 characters');
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/profiles/search?q=${encodeURIComponent(q)}`);
        const j = (await res.json().catch(() => null)) as {
          data?: SearchHit[];
          error?: { message?: string };
        } | null;
        if (!res.ok) {
          toast.error(j?.error?.message ?? 'Search failed');
          return;
        }
        setHits(j?.data ?? []);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Search failed');
      }
    });
  };

  const navigate = (id: string) => {
    setOpen(false);
    setTerm('');
    setHits(null);
    router.push(`/admin/users/${id}`);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setHits(null);
          setTerm('');
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Search className="mr-1.5 h-3.5 w-3.5" />
          Search profiles
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Find any profile</DialogTitle>
          <DialogDescription>
            Look up a landlord, tenant or admin by email or name. Click a result to open their
            detail page.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={search} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="apsp-q">Email or name</Label>
            <Input
              id="apsp-q"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="tenant@example.com or 'Sarah'"
              autoFocus
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Searching…' : 'Search'}
            </Button>
          </div>
        </form>
        {hits !== null ? (
          <div className="mt-1 max-h-64 overflow-y-auto rounded-button border border-border-soft">
            {hits.length === 0 ? (
              <p className="p-3 text-[12px] text-ink-light">No profiles matched “{term}”.</p>
            ) : (
              hits.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => navigate(h.id)}
                  className="flex w-full items-center justify-between gap-3 border-b border-border-soft px-3 py-2.5 text-left last:border-b-0 hover:bg-foam"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-ink">
                      {h.full_name ?? h.preferred_name ?? h.contact_email ?? 'Profile'}
                    </div>
                    {h.contact_email ? (
                      <div className="truncate text-[11.5px] text-ink-light">{h.contact_email}</div>
                    ) : null}
                  </div>
                  <span className="text-[11px] font-semibold text-forest-700">Open →</span>
                </button>
              ))
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
