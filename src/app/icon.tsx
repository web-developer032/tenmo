import { renderAppIcon } from '@/features/pwa/app-icon';

export const runtime = 'edge';
export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

/** PWA installable icon — 512×512, maskable safe-zone. */
export default function Icon() {
  return renderAppIcon({ size: 512, variant: 'maskable' });
}
