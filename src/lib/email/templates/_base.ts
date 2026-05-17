/**
 * Shared building blocks for transactional emails.
 *
 * Every template renders against the same brand-consistent layout, so we
 * keep the HTML chrome here and let templates focus on their `body`.
 */

export type RenderedEmail = { subject: string; html: string; text: string };

/** HTML-escape a value for inclusion in a string template. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type BaseLayoutInput = {
  /** Hidden preview text shown in inbox previews. */
  preheader: string;
  /** Inner HTML — already escaped where appropriate. */
  body: string;
  /** Optional small footer line under the brand strip. */
  footerNote?: string;
};

/**
 * Wraps `body` in the Tenantly email chrome. Same colour palette and
 * typography as the marketing site.
 */
export function baseLayout({
  preheader,
  body,
  footerNote = "UK HMO management built around the Renters' Rights Bill.",
}: BaseLayoutInput): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Tenantly</title>
  </head>
  <body style="margin:0;padding:0;background:#f7f7f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,sans-serif;">
    <span style="display:none;visibility:hidden;opacity:0;height:0;width:0;font-size:1px;">${escapeHtml(preheader)}</span>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f7f7f8;">
      <tr><td align="center" style="padding:24px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="background:#fff;max-width:560px;width:100%;border:1px solid #ececef;border-radius:12px;">
          <tr><td style="padding:24px 28px 8px;">
            <span style="display:inline-block;font-weight:700;letter-spacing:-0.01em;color:#0b0b0d;font-size:18px;">Tenantly</span>
          </td></tr>
          <tr><td style="padding:8px 28px 28px;">
            ${body}
          </td></tr>
          <tr><td style="padding:0 28px 24px;color:#999;font-size:12px;border-top:1px solid #ececef;">
            <p style="margin:16px 0 0;">${escapeHtml(footerNote)}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

/** Generic CTA button. */
export function ctaButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#0b0b0d;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">
  ${escapeHtml(label)}
</a>`;
}
