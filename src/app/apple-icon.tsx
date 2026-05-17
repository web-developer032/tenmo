import { renderAppIcon } from '@/features/pwa/app-icon';

export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/** iOS Home Screen icon — 180×180, plain (iOS adds its own
 * rounded mask). */
export default function AppleIcon() {
  return renderAppIcon({ size: 180, variant: 'plain' });
}
