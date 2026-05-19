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

export function InviteAdminDialog({ disabled = false }: { disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'support' | 'finance' | 'readonly' | 'super'>('support');
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/team/invite', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email, role }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
          toast.error(j?.error?.message ?? 'Could not send invite');
          return;
        }
        toast.success(`Invite sent to ${email}`);
        setOpen(false);
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
        <Button size="sm" disabled={disabled}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add admin user
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite an admin team member</DialogTitle>
          <DialogDescription>
            They'll receive a sign-up link. Their `admin_users` row is provisioned the first time
            they accept and sign in.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="iad-email">Email</Label>
            <Input
              id="iad-email"
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@tenantly.app"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="iad-role">Role</Label>
            <select
              id="iad-role"
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
              className="flex h-9 w-full rounded-button border border-border-soft bg-white px-3 py-1 text-sm text-ink focus:border-forest-400 focus:outline-none focus:ring-2 focus:ring-forest-200"
            >
              <option value="support">Support</option>
              <option value="finance">Finance</option>
              <option value="readonly">Read-only</option>
              <option value="super">Super admin</option>
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
