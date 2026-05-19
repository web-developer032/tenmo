'use client';

import {
  Bell,
  CreditCard,
  FileSearch,
  FileText,
  Home,
  IdCard,
  MessageSquare,
  ReceiptText,
  Sparkles,
  Wrench,
} from 'lucide-react';
import {
  SidebarFooter,
  SidebarHeader,
  SidebarNavItem,
  SidebarSection,
  SidebarShell,
} from './sidebar-shell';

/*
 * Tenant sidebar.
 *
 * IA mirrors the mock's tenant portal nav (My Home / Communication /
 * Account), plus a "Explore" group exposing the pre-tenancy listings flow
 * for tenants who are between properties.
 */

export type TenantSidebarProps = {
  unreadMessages?: number;
  unreadNotifications?: number;
  openTickets?: number;
  pendingApplications?: number;
  userInitials?: string;
  userName?: string;
  userSub?: string;
};

export function TenantSidebar({
  unreadMessages = 0,
  unreadNotifications = 0,
  openTickets = 0,
  pendingApplications = 0,
  userInitials = 'T',
  userName,
  userSub,
}: TenantSidebarProps) {
  return (
    <SidebarShell
      header={
        <SidebarHeader
          brand="Tenantly"
          subline="Tenant Portal"
          badge={
            <span className="inline-flex items-center rounded-full bg-forest-100 px-1.5 text-[9.5px] font-bold uppercase tracking-wider text-forest-700">
              Tenant
            </span>
          }
        />
      }
      footer={<SidebarFooter initials={userInitials} name={userName ?? 'Tenant'} sub={userSub} />}
    >
      <SidebarSection label="My Home">
        <SidebarNavItem href="/tenant" label="Home" icon={Home} match={(p) => p === '/tenant'} />
        <SidebarNavItem href="/tenant/rent" label="Payments" icon={CreditCard} />
        <SidebarNavItem
          href="/tenant/tickets"
          label="Maintenance"
          icon={Wrench}
          badge={openTickets > 0 ? { count: openTickets, tone: 'amber' } : undefined}
        />
        <SidebarNavItem href="/tenant/bills" label="Bills" icon={ReceiptText} />
        <SidebarNavItem href="/tenant/passport" label="Rental Passport" icon={IdCard} />
        <SidebarNavItem href="/tenant/documents" label="Documents" icon={FileText} />
      </SidebarSection>

      <SidebarSection label="Explore">
        <SidebarNavItem href="/listings" label="Find a room" icon={FileSearch} />
        <SidebarNavItem
          href="/tenant/applications"
          label="My applications"
          icon={Sparkles}
          badge={
            pendingApplications > 0 ? { count: pendingApplications, tone: 'green' } : undefined
          }
        />
      </SidebarSection>

      <SidebarSection label="Communication">
        <SidebarNavItem
          href="/messages"
          label="Messages"
          icon={MessageSquare}
          badge={unreadMessages > 0 ? { count: unreadMessages, tone: 'green' } : undefined}
        />
        <SidebarNavItem
          href="/notifications"
          label="Notifications"
          icon={Bell}
          badge={
            unreadNotifications > 0 ? { count: unreadNotifications, tone: 'amber' } : undefined
          }
        />
      </SidebarSection>
    </SidebarShell>
  );
}
