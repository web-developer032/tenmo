import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { roomApi } from '../api/room';
import type { RoomCreate, RoomUpdate } from '../schemas/room';
import { queryKeys } from './keys';

export function useRoomsForProperty(propertyId: string | null | undefined) {
  return useQuery({
    queryKey: propertyId ? queryKeys.properties.rooms(propertyId) : queryKeys.properties.all(),
    queryFn: () =>
      propertyId ? roomApi.listForProperty(propertyId) : Promise.reject(new Error('no propertyId')),
    enabled: !!propertyId,
  });
}

export function useRoom(roomId: string | null | undefined) {
  return useQuery({
    queryKey: roomId ? queryKeys.rooms.detail(roomId) : (['rooms'] as const),
    queryFn: () => (roomId ? roomApi.detail(roomId) : Promise.reject(new Error('no roomId'))),
    enabled: !!roomId,
  });
}

export function useCreateRoom(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RoomCreate) => roomApi.create(propertyId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.properties.rooms(propertyId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.properties.detail(propertyId) });
    },
  });
}

export function useUpdateRoom(roomId: string, propertyId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RoomUpdate) => roomApi.update(roomId, input),
    onSuccess: (room) => {
      queryClient.setQueryData(queryKeys.rooms.detail(roomId), room);
      if (propertyId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.properties.rooms(propertyId) });
      }
    },
  });
}
