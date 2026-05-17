import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orgApi } from '../api/org';
import type { OrgCreate, OrgUpdate } from '../schemas/org';
import { queryKeys } from './keys';

export function useOrgs() {
  return useQuery({
    queryKey: queryKeys.orgs.list(),
    queryFn: () => orgApi.list(),
  });
}

export function useOrg(orgId: string | null | undefined) {
  return useQuery({
    queryKey: orgId ? queryKeys.orgs.detail(orgId) : queryKeys.orgs.all(),
    queryFn: () => (orgId ? orgApi.detail(orgId) : Promise.reject(new Error('no orgId'))),
    enabled: !!orgId,
  });
}

export function useOrgBySlug(slug: string | null | undefined) {
  return useQuery({
    queryKey: slug ? queryKeys.orgs.bySlug(slug) : queryKeys.orgs.all(),
    queryFn: () => (slug ? orgApi.bySlug(slug) : Promise.reject(new Error('no slug'))),
    enabled: !!slug,
  });
}

export function useCreateOrg() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: OrgCreate) => orgApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orgs.list() });
    },
  });
}

export function useUpdateOrg(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: OrgUpdate) => orgApi.update(orgId, input),
    onSuccess: (org) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orgs.list() });
      queryClient.setQueryData(queryKeys.orgs.detail(orgId), org);
    },
  });
}
