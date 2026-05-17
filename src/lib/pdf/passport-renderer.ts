import 'server-only';
import PDFDocument from 'pdfkit';
import {
  PASSPORT_SECTION_LABEL,
  PAYMENT_BAND_BLURB,
  PAYMENT_BAND_LABEL,
  RTR_STATUS_LABEL,
} from '@/core/constants/passport';
import type { PassportData } from '@/core/schemas/passport';
import { formatMoney } from '@/core/utils/money';

/**
 * pdfkit-based renderer for the Rental Passport PDF.
 *
 * The output is a single-column A4 document with five sections,
 * mirroring `PASSPORT_SECTION_LABEL`. We deliberately use pdfkit's
 * imperative primitives instead of a tabular helper — the passport
 * is short (typically 1-2 pages) and bespoke layout reads better
 * than a generic table component.
 *
 * Pure: takes a `PassportData` and writes a PDF buffer. No I/O, no
 * Supabase. The server module is responsible for storage upload.
 */

const COLOURS = {
  text: '#0f172a', // slate-900
  muted: '#475569', // slate-600
  accent: '#0d9488', // teal-600
  divider: '#cbd5e1', // slate-300
  good: '#15803d', // green-700
  warn: '#b45309', // amber-700
  bad: '#b91c1c', // red-700
} as const;

const MARGIN = 50;

export async function renderPassportPdf(passport: PassportData): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: MARGIN,
      info: {
        Title: 'Rental Passport',
        Author: passport.identity.full_name,
        Subject: 'Tenantly Rental Passport',
        Creator: 'Tenantly',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      drawHeader(doc, passport);
      drawIdentity(doc, passport);
      drawRightToRent(doc, passport);
      drawTenancies(doc, passport);
      drawPayments(doc, passport);
      drawDocuments(doc, passport);
      drawFooter(doc, passport);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function drawHeader(doc: PDFKit.PDFDocument, passport: PassportData) {
  doc
    .fillColor(COLOURS.accent)
    .fontSize(22)
    .font('Helvetica-Bold')
    .text('Rental Passport', MARGIN, MARGIN);

  doc
    .fillColor(COLOURS.muted)
    .fontSize(10)
    .font('Helvetica')
    .text(`Generated ${formatDate(passport.generated_at)} · tenantly.io`, MARGIN, MARGIN + 30);

  drawDivider(doc, MARGIN + 55);
  doc.y = MARGIN + 70;
}

function drawIdentity(doc: PDFKit.PDFDocument, passport: PassportData) {
  drawSectionHeading(doc, PASSPORT_SECTION_LABEL.identity);
  drawKv(doc, 'Name', passport.identity.full_name);
  drawKv(doc, 'Email', passport.identity.email);
  if (passport.identity.phone) drawKv(doc, 'Phone', passport.identity.phone);
  drawKv(doc, 'Member since', formatDate(passport.identity.member_since));
  doc.moveDown(0.8);
}

function drawRightToRent(doc: PDFKit.PDFDocument, passport: PassportData) {
  drawSectionHeading(doc, PASSPORT_SECTION_LABEL.right_to_rent);
  const tone = rtrTone(passport.right_to_rent.status);
  doc
    .fillColor(tone)
    .fontSize(11)
    .font('Helvetica-Bold')
    .text(RTR_STATUS_LABEL[passport.right_to_rent.status]);

  if (passport.right_to_rent.issued_at || passport.right_to_rent.expires_at) {
    doc
      .fillColor(COLOURS.muted)
      .fontSize(10)
      .font('Helvetica')
      .text(
        [
          passport.right_to_rent.issued_at
            ? `Checked: ${formatDate(passport.right_to_rent.issued_at)}`
            : null,
          passport.right_to_rent.expires_at
            ? `Expires: ${formatDate(passport.right_to_rent.expires_at)}`
            : null,
        ]
          .filter(Boolean)
          .join('  ·  '),
      );
  }
  doc.moveDown(0.8);
}

function drawTenancies(doc: PDFKit.PDFDocument, passport: PassportData) {
  drawSectionHeading(doc, PASSPORT_SECTION_LABEL.tenancies);
  if (passport.tenancies.length === 0) {
    drawMutedLine(doc, 'No tenancies recorded yet.');
    doc.moveDown(0.8);
    return;
  }
  for (const t of passport.tenancies) {
    doc.fillColor(COLOURS.text).fontSize(11).font('Helvetica-Bold').text(t.property_name);
    doc
      .fillColor(COLOURS.muted)
      .fontSize(10)
      .font('Helvetica')
      .text(t.property_address || '—');
    const dates = `${formatDate(t.start_date)} → ${t.end_date ? formatDate(t.end_date) : 'present'}`;
    const room = t.room_name ? ` · Room: ${t.room_name}` : '';
    const rent =
      t.monthly_rent_pence != null ? ` · Rent: ${formatMoney(t.monthly_rent_pence)} pcm` : '';
    const status = ` · Status: ${t.status}`;
    doc.fillColor(COLOURS.text).fontSize(10).text(`${dates}${room}${rent}${status}`);
    doc.moveDown(0.6);
  }
}

function drawPayments(doc: PDFKit.PDFDocument, passport: PassportData) {
  drawSectionHeading(doc, PASSPORT_SECTION_LABEL.payments);
  const p = passport.payments;
  doc
    .fillColor(paymentTone(p.band))
    .fontSize(12)
    .font('Helvetica-Bold')
    .text(PAYMENT_BAND_LABEL[p.band]);
  doc
    .fillColor(COLOURS.muted)
    .fontSize(10)
    .font('Helvetica')
    .text(PAYMENT_BAND_BLURB[p.band], { align: 'left' });
  doc.moveDown(0.4);

  drawKv(doc, 'Total paid', formatMoney(p.total_paid_pence));
  drawKv(doc, 'Charges paid', String(p.paid_charges));
  if (p.paid_charges > 0) {
    drawKv(doc, 'Paid on time', `${p.on_time_charges} of ${p.paid_charges}`);
  }
  if (p.earliest_payment_date && p.latest_payment_date) {
    drawKv(
      doc,
      'Period covered',
      `${formatDate(p.earliest_payment_date)} → ${formatDate(p.latest_payment_date)}`,
    );
  }
  doc.moveDown(0.8);
}

function drawDocuments(doc: PDFKit.PDFDocument, passport: PassportData) {
  drawSectionHeading(doc, PASSPORT_SECTION_LABEL.documents);
  if (passport.documents.length === 0) {
    drawMutedLine(doc, 'No documents recorded yet.');
    doc.moveDown(0.8);
    return;
  }
  for (const d of passport.documents.slice(0, 12)) {
    doc
      .fillColor(COLOURS.text)
      .fontSize(10)
      .font('Helvetica')
      .text(`• ${d.title}`, { continued: true })
      .fillColor(COLOURS.muted)
      .text(`  (${d.kind} · ${formatDate(d.added_at)})`);
  }
  if (passport.documents.length > 12) {
    drawMutedLine(doc, `…and ${passport.documents.length - 12} more.`);
  }
  doc.moveDown(0.5);
}

function drawFooter(doc: PDFKit.PDFDocument, passport: PassportData) {
  // Pin the footer to the bottom of the LAST page only — pdfkit
  // does not auto-paginate footers, so we draw it once at the end.
  const pageHeight = doc.page.height;
  doc.fillColor(COLOURS.muted).fontSize(8).font('Helvetica');
  doc.text(
    'This passport was generated by Tenantly. The figures are taken from the system of record at the time of generation.',
    MARGIN,
    pageHeight - MARGIN - 30,
    { width: doc.page.width - MARGIN * 2, align: 'center' },
  );
  doc.text(
    `Owner: ${passport.identity.email}  ·  Generated: ${formatDate(passport.generated_at)}`,
    MARGIN,
    pageHeight - MARGIN - 15,
    { width: doc.page.width - MARGIN * 2, align: 'center' },
  );
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

function drawSectionHeading(doc: PDFKit.PDFDocument, label: string) {
  doc.moveDown(0.4);
  doc.fillColor(COLOURS.accent).fontSize(13).font('Helvetica-Bold').text(label);
  drawDivider(doc, doc.y + 4);
  doc.y += 12;
}

function drawKv(doc: PDFKit.PDFDocument, label: string, value: string) {
  doc
    .fillColor(COLOURS.muted)
    .fontSize(10)
    .font('Helvetica')
    .text(`${label}: `, MARGIN, doc.y, { continued: true })
    .fillColor(COLOURS.text)
    .font('Helvetica-Bold')
    .text(value);
}

function drawMutedLine(doc: PDFKit.PDFDocument, text: string) {
  doc.fillColor(COLOURS.muted).fontSize(10).font('Helvetica').text(text);
}

function drawDivider(doc: PDFKit.PDFDocument, y: number) {
  const right = doc.page.width - MARGIN;
  doc.moveTo(MARGIN, y).lineTo(right, y).strokeColor(COLOURS.divider).lineWidth(0.5).stroke();
}

function rtrTone(status: PassportData['right_to_rent']['status']): string {
  switch (status) {
    case 'verified':
      return COLOURS.good;
    case 'pending':
      return COLOURS.warn;
    case 'expired':
      return COLOURS.bad;
    default:
      return COLOURS.muted;
  }
}

function paymentTone(band: PassportData['payments']['band']): string {
  switch (band) {
    case 'excellent':
      return COLOURS.good;
    case 'reliable':
      return COLOURS.good;
    case 'mixed':
      return COLOURS.warn;
    case 'building':
      return COLOURS.muted;
    case 'no_record':
      return COLOURS.muted;
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
