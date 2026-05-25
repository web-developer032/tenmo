'use client';

import {
  BadgePoundSterling,
  Bell,
  Building2,
  ClipboardList,
  CreditCard,
  DoorOpen,
  FileText,
  HardHat,
  LayoutDashboard,
  MessageSquare,
  PiggyBank,
  ScrollText,
  Settings,
  ShieldCheck,
  UserCircle,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';
import { useMemo } from 'react';
import {
  SidebarFooter,
  SidebarHeader,
  SidebarNavItem,
  SidebarSection,
  SidebarShell,
} from './sidebar-shell';

/*
 * Landlord sidebar.
 *
 * IA (per HMOeez design + plan decisions):
 *   Landlord    — Dashboard, Properties, Listings, Tenants, Rent,
 *                 Maintenance, Compliance, Documents
 *   Operations  — Financials & MTD, Deposits, Right to Rent,
 *                 Inspections, Contractors
 *   Shared      — Messages, Notifications
 *   Account     — My Profile, Billing, Settings
 *
 * The component is fully presentational. Counts/badges are passed in by
 * the layout (server) which has access to live unread totals.
 */

export type LandlordSidebarProps = {
  orgSlug: string;
  orgName?: string | null;
  tierLabel?: string | null;
  propertyCount?: number | null;
  unreadMessages?: number;
  unreadNotifications?: number;
  openTickets?: number;
  vacantListings?: number;
  overdueRent?: number;
  expiringCompliance?: number;
  rtrRechecksDue?: number;
  userInitials?: string;
  userName?: string;
  userSub?: string;
};

export function LandlordSidebar({
  orgSlug,
  orgName,
  tierLabel,
  propertyCount,
  unreadMessages = 0,
  unreadNotifications = 0,
  openTickets = 0,
  vacantListings = 0,
  overdueRent = 0,
  expiringCompliance = 0,
  rtrRechecksDue = 0,
  userInitials = 'U',
  userName,
  userSub,
}: LandlordSidebarProps) {
  const base = `/landlord/${orgSlug}`;
  const dashboardMatch = useMemo(() => (p: string) => p === base, [base]);

  const planSub = useMemo(() => {
    const parts: string[] = [];
    if (tierLabel) parts.push(tierLabel);
    if (typeof propertyCount === 'number') {
      parts.push(`${propertyCount} ${propertyCount === 1 ? 'property' : 'properties'}`);
    }
    return parts.length > 0 ? parts.join(' · ') : userSub;
  }, [tierLabel, propertyCount, userSub]);

  return (
    <SidebarShell
      header={<SidebarHeader brand="Tenantly" subline={orgName ?? 'HMO Management Platform'} />}
      footer={
        <SidebarFooter
          initials={userInitials}
          name={userName ?? orgName ?? 'Tenantly user'}
          sub={planSub}
        />
      }
    >
      <SidebarSection label="Landlord">
        <SidebarNavItem
          href={base}
          label="Dashboard"
          icon={LayoutDashboard}
          match={dashboardMatch}
        />
        <SidebarNavItem href={`${base}/properties`} label="Properties" icon={Building2} />
        <SidebarNavItem
          href={`${base}/listings`}
          label="Listings"
          icon={DoorOpen}
          badge={vacantListings > 0 ? { count: vacantListings, tone: 'green' } : undefined}
        />
        <SidebarNavItem href={`${base}/tenancies`} label="Tenants" icon={Users} />
        <SidebarNavItem
          href={`${base}/finance`}
          label="Rent"
          icon={Wallet}
          badge={overdueRent > 0 ? { count: overdueRent, tone: 'red' } : undefined}
        />
        <SidebarNavItem
          href={`${base}/maintenance`}
          label="Maintenance"
          icon={Wrench}
          badge={openTickets > 0 ? { count: openTickets, tone: 'amber' } : undefined}
        />
        <SidebarNavItem
          href={`${base}/compliance`}
          label="Compliance"
          icon={ShieldCheck}
          badge={expiringCompliance > 0 ? { count: expiringCompliance, tone: 'amber' } : undefined}
        />
        <SidebarNavItem href={`${base}/documents`} label="Documents" icon={FileText} />
      </SidebarSection>

      <SidebarSection label="Operations">
        <SidebarNavItem
          href={`${base}/financials`}
          label="Financials &amp; MTD"
          icon={BadgePoundSterling}
        />
        <SidebarNavItem href={`${base}/deposits`} label="Deposits" icon={PiggyBank} />
        <SidebarNavItem
          href={`${base}/right-to-rent`}
          label="Right to Rent"
          icon={ScrollText}
          badge={rtrRechecksDue > 0 ? { count: rtrRechecksDue, tone: 'amber' } : undefined}
        />
        <SidebarNavItem href={`${base}/inspections`} label="Inspections" icon={ClipboardList} />
        <SidebarNavItem href={`${base}/contractors`} label="Contractors" icon={HardHat} />
      </SidebarSection>

      <SidebarSection label="Shared">
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

      <SidebarSection label="Account">
        <SidebarNavItem href={`${base}/profile`} label="My Profile" icon={UserCircle} />
        <SidebarNavItem href={`${base}/billing`} label="Billing" icon={CreditCard} />
        <SidebarNavItem href={`${base}/settings`} label="Settings" icon={Settings} />
      </SidebarSection>
    </SidebarShell>
  );
}
