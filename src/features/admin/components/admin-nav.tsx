import { ClipboardList, Gauge, ShieldCheck, UsersRound } from 'lucide-react';
import Link from 'next/link';

/**
 * Side / top nav shared by every `/admin/*` page. Server-rendered;
 * no active-link styling — the page heading + breadcrumb communicate
 * location.
 */
export function AdminNav() {
  return (
    <nav className="flex flex-wrap items-center gap-1 rounded-md border bg-card p-1 text-sm">
      <NavLink href="/admin" icon={<Gauge className="h-4 w-4" />} label="Dashboard" />
      <NavLink href="/admin/users" icon={<UsersRound className="h-4 w-4" />} label="Users" />
      <NavLink
        href="/admin/orgs"
        icon={<ShieldCheck className="h-4 w-4" />}
        label="Organisations"
      />
      <NavLink href="/admin/audit" icon={<ClipboardList className="h-4 w-4" />} label="Audit log" />
    </nav>
  );
}

function NavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
