'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { AdminRole } from '@/features/admin/server';

type Props = {
  userId: string;
  currentRole: AdminRole;
  canEdit: boolean;
  isSelf: boolean;
};

const ROLES: { value: AdminRole; label: string }[] = [
  { value: 'super', label: 'Super' },
  { value: 'support', label: 'Support' },
  { value: 'finance', label: 'Finance' },
  { value: 'readonly', label: 'Read-only' },
];

export function AdminMemberActions({ userId, currentRole, canEdit, isSelf }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const changeRole = (role: AdminRole) => {
    if (role === currentRole) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/team/${userId}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ role }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
          toast.error(j?.error?.message ?? 'Could not change role');
          return;
        }
        toast.success('Role updated');
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not change role');
      }
    });
  };

  const revoke = () => {
    if (!confirm('Revoke this admin? They will lose access immediately.')) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/team/${userId}`, { method: 'DELETE' });
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
          toast.error(j?.error?.message ?? 'Could not revoke');
          return;
        }
        toast.success('Admin revoked');
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not revoke');
      }
    });
  };

  if (!canEdit || isSelf) {
    return (
      <span className="text-[11.5px] italic text-ink-light">{isSelf ? 'You' : 'Read-only'}</span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        defaultValue={currentRole}
        disabled={pending}
        onChange={(e) => changeRole(e.target.value as AdminRole)}
        className="h-8 rounded-button border border-border-soft bg-white px-2 text-[12px] font-medium text-ink focus:border-forest-400 focus:outline-none focus:ring-2 focus:ring-forest-200"
      >
        {ROLES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      <Button size="sm" variant="destructive" onClick={revoke} disabled={pending}>
        Revoke
      </Button>
    </div>
  );
}
