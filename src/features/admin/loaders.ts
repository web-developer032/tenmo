import 'server-only';
import { createClient } from '@/lib/supabase/server';
import {
  type AdminAnalytics,
  type AdminDashboardStats,
  type AdminOrgDetail,
  type AdminTeamData,
  type AdminUserDetail,
  getAdminAnalyticsWithClient,
  getAdminTeamWithClient,
  getDashboardStatsWithClient,
  getOrgDetailWithClient,
  getUserDetailWithClient,
  type ListAuditParams,
  type ListAuditResult,
  type ListOrgSummaryParams,
  type ListOrgSummaryResult,
  type ListOrgsParams,
  type ListOrgsResult,
  type ListTenantsParams,
  type ListTenantsResult,
  type ListUsersParams,
  type ListUsersResult,
  listAuditWithClient,
  listOrgSummaryWithClient,
  listOrgsWithClient,
  listTenantsWithClient,
  listUsersWithClient,
} from './server';

/**
 * RSC loaders for `/admin/*`. Thin wrappers that share the
 * underlying queries with the API route handlers — the
 * `*WithClient` helpers in `./server`. The `/admin` layout has
 * already verified the caller is a platform admin.
 */

export async function loadAdminUsers(params: ListUsersParams): Promise<ListUsersResult> {
  const sb = await createClient();
  return listUsersWithClient(sb, params);
}

export async function loadAdminOrgs(params: ListOrgsParams): Promise<ListOrgsResult> {
  const sb = await createClient();
  return listOrgsWithClient(sb, params);
}

export async function loadAdminLandlords(
  params: ListOrgSummaryParams,
): Promise<ListOrgSummaryResult> {
  const sb = await createClient();
  return listOrgSummaryWithClient(sb, params);
}

export async function loadAdminTenants(params: ListTenantsParams): Promise<ListTenantsResult> {
  const sb = await createClient();
  return listTenantsWithClient(sb, params);
}

export async function loadAdminUserDetail(userId: string): Promise<AdminUserDetail> {
  const sb = await createClient();
  return getUserDetailWithClient(sb, userId);
}

export async function loadAdminOrgDetail(orgId: string): Promise<AdminOrgDetail> {
  const sb = await createClient();
  return getOrgDetailWithClient(sb, orgId);
}

export async function loadAdminDashboardStats(): Promise<AdminDashboardStats> {
  const sb = await createClient();
  return getDashboardStatsWithClient(sb);
}

export async function loadAdminAudit(params: ListAuditParams): Promise<ListAuditResult> {
  const sb = await createClient();
  return listAuditWithClient(sb, params);
}

export async function loadAdminAnalytics(): Promise<AdminAnalytics> {
  const sb = await createClient();
  return getAdminAnalyticsWithClient(sb);
}

export async function loadAdminTeam(): Promise<AdminTeamData> {
  const sb = await createClient();
  return getAdminTeamWithClient(sb);
}
