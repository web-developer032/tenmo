'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Invite landlord — posts to /api/admin/orgs/invite which generates
 * a magic-link sign-in email and pre-stages the org name + slug for
 * the new user.
 *
 * Lives next to /admin/orgs because it's the only place we surface
 * the action.
 */
export function InviteLandlordDialog() {
  const [open, setOpen] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [email, setEmail] = useState('');
  const [tier, setTier] = useState<'starter' | 'pro' | 'portfolio'>('pro');
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/orgs/invite', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ org_name: orgName, email, tier }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
          toast.error(j?.error?.message ?? 'Could not send invite');
          return;
        }
        toast.success(`Invite sent to ${email}`);
        setOpen(false);
        setOrgName('');
        setEmail('');
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not send invite');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Invite landlord
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a new landlord</DialogTitle>
          <DialogDescription>
            We'll email them a magic link to claim the workspace and pre-create their org.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ild-org-name">Business name</Label>
            <Input
              id="ild-org-name"
              required
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Acme Lets Ltd"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ild-email">Owner email</Label>
            <Input
              id="ild-email"
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ild-tier">Plan</Label>
            <select
              id="ild-tier"
              value={tier}
              onChange={(e) => setTier(e.target.value as typeof tier)}
              className="flex h-9 w-full rounded-button border border-border-soft bg-white px-3 py-1 text-sm text-ink focus:border-forest-400 focus:outline-none focus:ring-2 focus:ring-forest-200"
            >
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="portfolio">Portfolio / Growth</option>
            </select>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Sending…' : 'Send invite'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
