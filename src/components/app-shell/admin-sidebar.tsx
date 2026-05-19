'use client';

import {
  BarChart3,
  Building2,
  ClipboardList,
  CreditCard,
  Gauge,
  LifeBuoy,
  Settings2,
  ShieldCheck,
  UserCog,
  UserRound,
  Users,
} from 'lucide-react';
import {
  SidebarFooter,
  SidebarHeader,
  SidebarNavItem,
  SidebarSection,
  SidebarShell,
} from './sidebar-shell';

/**
 * Admin sidebar — platform operators only.
 *
 * Information architecture mirrors the HMOeez admin design while
 * keeping our /admin/orgs URL (we display "Landlords" as the label so
 * support staff can talk in customer-friendly terms). Counts come from
 * the layout via `loadAdminSidebarCounts()` and surface as nav badges.
 */

export type AdminSidebarCounts = {
  landlords: number;
  tenants: number;
  support_open: number;
  compliance_critical: number;
  billing_failed: number;
};

export type AdminSidebarProps = {
  userInitials?: string;
  userName?: string;
  userSub?: string;
  counts?: AdminSidebarCounts;
};

export function AdminSidebar({
  userInitials = 'A',
  userName = 'Platform Admin',
  userSub = 'Internal team',
  counts,
}: AdminSidebarProps) {
  return (
    <SidebarShell
      header={
        <SidebarHeader
          brand="Tenantly"
          subline="Admin Console"
          badge={
            <span className="inline-flex items-center rounded-full bg-alert-bg px-1.5 text-[9.5px] font-bold uppercase tracking-wider text-alert">
              Admin
            </span>
          }
        />
      }
      footer={<SidebarFooter initials={userInitials} name={userName} sub={userSub} />}
    >
      <SidebarSection label="Overview">
        <SidebarNavItem
          href="/admin"
          label="Dashboard"
          icon={Gauge}
          match={(p) => p === '/admin'}
        />
        <SidebarNavItem href="/admin/analytics" label="Analytics" icon={BarChart3} />
      </SidebarSection>

      <SidebarSection label="Users">
        <SidebarNavItem
          href="/admin/orgs"
          label="Landlords"
          icon={Building2}
          badge={
            counts && counts.landlords > 0 ? { count: counts.landlords, tone: 'green' } : undefined
          }
        />
        <SidebarNavItem
          href="/admin/tenants"
          label="Tenants"
          icon={Users}
          badge={
            counts && counts.tenants > 0 ? { count: counts.tenants, tone: 'green' } : undefined
          }
        />
        <SidebarNavItem href="/admin/users" label="User Management" icon={UserCog} />
      </SidebarSection>

      <SidebarSection label="Business">
        <SidebarNavItem
          href="/admin/billing"
          label="Subscriptions"
          icon={CreditCard}
          badge={
            counts && counts.billing_failed > 0
              ? { count: counts.billing_failed, tone: 'red' }
              : undefined
          }
        />
        <SidebarNavItem
          href="/admin/support"
          label="Support Tickets"
          icon={LifeBuoy}
          badge={
            counts && counts.support_open > 0
              ? { count: counts.support_open, tone: 'amber' }
              : undefined
          }
        />
        <SidebarNavItem
          href="/admin/compliance"
          label="Compliance Alerts"
          icon={ShieldCheck}
          badge={
            counts && counts.compliance_critical > 0
              ? { count: counts.compliance_critical, tone: 'red' }
              : undefined
          }
        />
      </SidebarSection>

      <SidebarSection label="Platform">
        <SidebarNavItem href="/admin/audit" label="Audit Log" icon={ClipboardList} />
        <SidebarNavItem href="/admin/settings" label="Platform Settings" icon={Settings2} />
      </SidebarSection>

      <SidebarSection label="Account">
        <SidebarNavItem href="/admin/profile" label="My Profile" icon={UserRound} />
      </SidebarSection>
    </SidebarShell>
  );
}
