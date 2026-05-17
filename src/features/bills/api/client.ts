import type { Bill, CreateBillInput, UpdateBillInput } from '@/core/schemas/bills';
import type { BillWithAllocations } from '../loaders';

/**
 * Browser API client for the bills domain. Calls our routes only.
 */

export class BillsApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'BillsApiError';
  }
}

async function unwrap<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => null)) as {
    data?: T;
    error?: { message?: string; code?: string; details?: unknown };
  } | null;
  if (!res.ok || !json || !('data' in json) || json.data === undefined) {
    const msg = json?.error?.message ?? `Request failed (${res.status})`;
    throw new BillsApiError(msg, res.status, json?.error?.code, json?.error?.details);
  }
  return json.data as T;
}

export interface CreateBillResponse {
  bill: Bill;
  allocations: Array<{
    id: string;
    room_id: string;
    tenancy_id: string | null;
    amount_pence: number;
    share_basis_points: number | null;
  }>;
}

export async function createBillApi(input: CreateBillInput): Promise<CreateBillResponse> {
  const res = await fetch('/api/bills', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return unwrap<CreateBillResponse>(res);
}

export async function listBillsApi(propertyId: string): Promise<Bill[]> {
  const res = await fetch(`/api/bills?property_id=${encodeURIComponent(propertyId)}`, {
    method: 'GET',
    credentials: 'same-origin',
  });
  return unwrap<Bill[]>(res);
}

export async function getBillApi(billId: string): Promise<BillWithAllocations> {
  const res = await fetch(`/api/bills/${encodeURIComponent(billId)}`, {
    method: 'GET',
    credentials: 'same-origin',
  });
  return unwrap<BillWithAllocations>(res);
}

export async function updateBillApi(billId: string, input: UpdateBillInput): Promise<Bill> {
  const res = await fetch(`/api/bills/${encodeURIComponent(billId)}`, {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return unwrap<Bill>(res);
}

export async function deleteBillApi(billId: string): Promise<{ id: string; deleted: true }> {
  const res = await fetch(`/api/bills/${encodeURIComponent(billId)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  });
  return unwrap<{ id: string; deleted: true }>(res);
}
