/**
 * Server-only public surface of the maintenance tickets feature.
 *
 * Importing from this barrel inside a Client Component will trip the
 * `server-only` guard, so RPC + Storage logic stays on the server.
 */

export {
  type AttachmentUploadUrl,
  type CreateAttachmentUploadUrlInput,
  createAttachmentUploadUrl,
  signAttachmentDownloadUrl,
} from './attachments';
export { type CreateTicketResult, createTicket } from './create-ticket';
export { loadTicketDetail, type TicketDetail } from './get-ticket';
export {
  listOrgTickets,
  listTenantTickets,
  type TicketRow,
} from './list-tickets';
export {
  notifyTicketCreated,
  notifyTicketMessage,
  notifyTicketStatusChanged,
} from './notifications';
export {
  addTicketMessage,
  assignTicket,
  changeTicketStatus,
  resolveActorRole,
} from './update-ticket';
