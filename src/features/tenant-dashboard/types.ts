/**
 * Tenant dashboard shared types.
 *
 * Mirrors the panels rendered by `/tenant` (Home) — rent hero, "My home"
 * detail rows, recent payments timeline, notices, my-requests list,
 * emergency contacts. The same `TenantDashboardData` shape is consumed by
 * the rest of the tenant portal (Profile read-only summary, Maintenance
 * snapshot, etc.) so we never re-query the same scopes twice per request.
 */

import type { ComplianceStatus, ComplianceType } from '@/core/constants/compliance';
import type { TicketCategory, TicketSeverity, TicketStatus } from '@/core/constants/tickets';
import type { TenancyStatus } from '@/core/schemas/tenancy';

/** Status of the tenant's next rent charge (this calendar month). */
export type RentHeroState = 'paid' | 'due' | 'overdue' | 'upcoming';

export type TenantDashboardProperty = {
  id: string;
  name: string;
  addressLine1: string | null;
  city: string | null;
  postcode: string | null;
};

export type TenantDashboardLandlord = {
  /** User id of the org's primary contact (for messaging). */
  userId: string | null;
  /** Display name — preferred over the org name in the Notices card. */
  displayName: string;
  contactPhone: string | null;
  contactEmail: string | null;
};

export type EmergencyContact = {
  name: string | null;
  relationship: string | null;
  phone: string | null;
};

export type TenantPrimaryTenancy = {
  id: string;
  orgId: string;
  status: TenancyStatus;
  startDate: string | null;
  endDate: string | null;
  rentPence: number;
  rentFrequency: 'monthly' | 'weekly';
  rentDueDay: number | null;
  depositPence: number;
  depositScheme: string | null;
  depositProtectedAt: string | null;
  property: TenantDashboardProperty;
  roomName: string | null;
  landlord: TenantDashboardLandlord;
  paymentReference: string;
  /** Months elapsed since `startDate` clamped to [0, totalMonths]. */
  monthsElapsed: number;
  /** Total months between `startDate` and `endDate`. `null` for periodic. */
  totalMonths: number | null;
  /** Percentage of the tenancy that has elapsed (`null` for periodic). */
  progressPct: number | null;
};

export type RentHero = {
  amountPence: number;
  dueDate: string | null;
  state: RentHeroState;
  monthLabel: string;
  paidOn: string | null;
  rentMethodLabel: string;
};

export type NoticeRow = {
  id: string;
  title: string;
  body: string | null;
  dotTone: 'forest' | 'amber' | 'alert';
  createdAt: string;
};

export type RecentPaymentRow = {
  id: string;
  monthLabel: string;
  amountPence: number;
  status: 'paid' | 'late' | 'due' | 'overdue';
  paidAt: string | null;
  dueDate: string;
  methodLabel: string;
  /** Days late vs due_date (positive when paid after the due date). */
  daysLate: number;
};

export type MaintenanceSnapshotRow = {
  id: string;
  title: string;
  category: TicketCategory;
  status: TicketStatus;
  severity: TicketSeverity;
  reportedAt: string;
  resolvedAt: string | null;
  iconTone: 'forest' | 'blue' | 'amber' | 'alert';
};

export type TenantComplianceRow = {
  id: string;
  type: ComplianceType;
  status: ComplianceStatus;
  expiresAt: string | null;
};

export type TenantDashboardData = {
  greetingName: string;
  firstName: string;
  initials: string;
  todayLabel: string;
  monthLabel: string;
  hasInvites: boolean;
  inviteCount: number;
  tenancy: TenantPrimaryTenancy | null;
  rentHero: RentHero | null;
  recentPayments: RecentPaymentRow[];
  paidThisYearPence: number;
  paidThisYearLabel: string;
  notices: NoticeRow[];
  unreadNotificationCount: number;
  unreadMessageCount: number;
  maintenance: MaintenanceSnapshotRow[];
  maintenanceOpenCount: number;
  maintenanceResolvedCount: number;
  maintenanceAvgResolutionDays: number | null;
  compliance: TenantComplianceRow[];
  emergencyContact: EmergencyContact | null;
};
