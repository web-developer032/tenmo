/**
 * Document vault server modules.
 *
 * Barrel export for the API layer + features that need to read/write
 * documents (compliance attach, AST upload, property docs tab, etc.).
 *
 * All modules live behind `server-only`; importing them from a Client
 * Component will fail to compile.
 */
export { deleteDocument } from './delete';
export { listDocuments } from './list';
export { notifyDocumentUploaded } from './notify';
export { recordDocument } from './record';
export { signDocumentDownloadUrl } from './sign-download';
export { createDocumentUploadUrl } from './upload-url';
