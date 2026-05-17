import type { Room, RoomCreate, RoomUpdate } from '../schemas/room';
import { http } from './http';

export const roomApi = {
  listForProperty: (propertyId: string) => http.get<Room[]>(`/api/properties/${propertyId}/rooms`),
  detail: (roomId: string) => http.get<Room>(`/api/rooms/${roomId}`),
  create: (propertyId: string, input: RoomCreate, idempotencyKey?: string) =>
    http.post<Room>(`/api/properties/${propertyId}/rooms`, input, { idempotencyKey }),
  update: (roomId: string, input: RoomUpdate) => http.patch<Room>(`/api/rooms/${roomId}`, input),
};
