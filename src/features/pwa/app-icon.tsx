import 'server-only';
import { ImageResponse } from 'next/og';

/**
 * Shared renderer for the app icon (PWA + favicon + Apple touch
 * icon). The glyph is a stylised "T" on the brand background —
 * same look across all sizes. Runs at build time on the edge
 * runtime; no binary assets in the repo.
 *
 * Tweak the colours here to retheme everywhere at once.
 */

const BG = '#0f1115';
const FG = '#ffffff';
const ACCENT = '#7c3aed';

export interface RenderAppIconOptions {
  /** Square pixel size — typically 32 (favicon), 180 (Apple
   * touch), or 512 (PWA install). */
  size: number;
  /** Apple touch icons render with rounded corners by iOS, so
   * we keep our background square. PWA maskable icons need at
   * least 10% safe-zone padding which we absorb here. */
  variant?: 'plain' | 'maskable';
}

export function renderAppIcon({ size, variant = 'plain' }: RenderAppIconOptions): ImageResponse {
  const padding = variant === 'maskable' ? Math.round(size * 0.12) : 0;
  const inner = size - padding * 2;
  const fontSize = Math.round(inner * 0.62);
  const cornerRadius = variant === 'maskable' ? 0 : Math.round(size * 0.18);

  return new ImageResponse(
    <div
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: BG,
        borderRadius: cornerRadius,
      }}
    >
      <div
        style={{
          width: inner,
          height: inner,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `linear-gradient(135deg, ${ACCENT} 0%, ${BG} 100%)`,
          borderRadius: cornerRadius,
        }}
      >
        <span
          style={{
            color: FG,
            fontSize,
            fontWeight: 800,
            letterSpacing: -fontSize * 0.04,
            fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
            lineHeight: 1,
          }}
        >
          T
        </span>
      </div>
    </div>,
    { width: size, height: size },
  );
}
