/**
 * Public surface of `core/`. Importers should use these named exports rather
 * than reaching into individual files.
 */

// Adapters
export {
  getStorage,
  noopStorage,
  type StorageAdapter,
  setStorage,
} from './adapters/storage';
export { type ApiError, type ApiResponse, HttpError, NetworkError } from './api/errors';
// API
export { http } from './api/http';
export { orgApi } from './api/org';
export { propertyApi } from './api/property';
export { roomApi } from './api/room';
// Billing
export * from './billing/capabilities';
// Config
export { type PublicEnv, readPublicEnv } from './config/env';
// Constants
export * from './constants/compliance';
// Queries
export { queryKeys } from './queries/keys';
export * from './queries/orgs';
export * from './queries/properties';
export * from './queries/rooms';
// Schemas
export * from './schemas/common';
export * from './schemas/compliance';
export * from './schemas/org';
export * from './schemas/profile';
export * from './schemas/property';
export * from './schemas/rent';
export * from './schemas/room';
export * from './schemas/tenancy';
// Stores
export { useActiveContextStore } from './stores/active-context';
export * from './utils/compliance-rules';
export * from './utils/dates';
// Utils — money's `pence` helper would collide with schemas/common's `pence`,
// so we re-export it under `penceMoney` while keeping the rest as-is.
export {
  addMoney,
  formatMoney,
  formatMoneyShort,
  formatMoneyWhole,
  type Money,
  mulMoney,
  pence as penceMoney,
  pounds,
  subMoney,
} from './utils/money';
export * from './utils/rent-rules';
export * from './utils/slug';
export * from './utils/tenancy-rules';
