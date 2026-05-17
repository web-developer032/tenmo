import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { propertyApi } from '../api/property';
import type { PropertyCreate, PropertyUpdate } from '../schemas/property';
import { queryKeys } from './keys';

export function usePropertiesForOrg(orgId: string | null | undefined) {
  return useQuery({
    queryKey: orgId ? queryKeys.properties.listForOrg(orgId) : queryKeys.properties.all(),
    queryFn: () => (orgId ? propertyApi.listForOrg(orgId) : Promise.reject(new Error('no orgId'))),
    enabled: !!orgId,
  });
}

export function useProperty(propertyId: string | null | undefined) {
  return useQuery({
    queryKey: propertyId ? queryKeys.properties.detail(propertyId) : queryKeys.properties.all(),
    queryFn: () =>
      propertyId ? propertyApi.detail(propertyId) : Promise.reject(new Error('no propertyId')),
    enabled: !!propertyId,
  });
}

export function useCreateProperty(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PropertyCreate) => propertyApi.create(orgId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.properties.listForOrg(orgId) });
    },
  });
}

export function useUpdateProperty(propertyId: string, orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PropertyUpdate) => propertyApi.update(propertyId, input),
    onSuccess: (property) => {
      queryClient.setQueryData(queryKeys.properties.detail(propertyId), property);
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.properties.listForOrg(orgId) });
      }
    },
  });
}
