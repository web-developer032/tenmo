import type { Property, PropertyCreate, PropertyUpdate } from '../schemas/property';
import { http } from './http';

export const propertyApi = {
  listForOrg: (orgId: string) => http.get<Property[]>(`/api/orgs/${orgId}/properties`),
  detail: (propertyId: string) => http.get<Property>(`/api/properties/${propertyId}`),
  create: (orgId: string, input: PropertyCreate, idempotencyKey?: string) =>
    http.post<Property>(`/api/orgs/${orgId}/properties`, input, { idempotencyKey }),
  update: (propertyId: string, input: PropertyUpdate) =>
    http.patch<Property>(`/api/properties/${propertyId}`, input),
};
