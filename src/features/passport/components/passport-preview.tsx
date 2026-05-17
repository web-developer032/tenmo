import { BookUser, Building2, FileText, ShieldCheck, Wallet } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  PASSPORT_SECTION_LABEL,
  PAYMENT_BAND_BLURB,
  RTR_STATUS_LABEL,
} from '@/core/constants/passport';
import type { PassportData } from '@/core/schemas/passport';
import { formatMoney } from '@/core/utils/money';
import { PassportBandBadge } from './passport-band-badge';

/**
 * Read-only on-screen preview of the assembled passport. Mirrors
 * the PDF section-for-section so what the tenant sees on screen is
 * what they get in the export.
 */
export function PassportPreview({ passport }: { passport: PassportData }) {
  return (
    <div className="space-y-4">
      <IdentitySection passport={passport} />
      <RtrSection passport={passport} />
      <TenanciesSection passport={passport} />
      <PaymentsSection passport={passport} />
      <DocumentsSection passport={passport} />
    </div>
  );
}

function IdentitySection({ passport }: { passport: PassportData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BookUser className="h-4 w-4 text-muted-foreground" />
          {PASSPORT_SECTION_LABEL.identity}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <Kv label="Name" value={passport.identity.full_name} />
        <Kv label="Email" value={passport.identity.email} />
        {passport.identity.phone ? <Kv label="Phone" value={passport.identity.phone} /> : null}
        <Kv label="Member since" value={formatHumanDate(passport.identity.member_since)} />
      </CardContent>
    </Card>
  );
}

function RtrSection({ passport }: { passport: PassportData }) {
  const tone =
    passport.right_to_rent.status === 'verified'
      ? 'text-emerald-700 dark:text-emerald-300'
      : passport.right_to_rent.status === 'expired'
        ? 'text-destructive'
        : 'text-muted-foreground';
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          {PASSPORT_SECTION_LABEL.right_to_rent}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <div className={`font-medium ${tone}`}>
          {RTR_STATUS_LABEL[passport.right_to_rent.status]}
        </div>
        {passport.right_to_rent.issued_at || passport.right_to_rent.expires_at ? (
          <div className="text-xs text-muted-foreground">
            {[
              passport.right_to_rent.issued_at
                ? `Checked ${formatHumanDate(passport.right_to_rent.issued_at)}`
                : null,
              passport.right_to_rent.expires_at
                ? `Expires ${formatHumanDate(passport.right_to_rent.expires_at)}`
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function TenanciesSection({ passport }: { passport: PassportData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          {PASSPORT_SECTION_LABEL.tenancies}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {passport.tenancies.length === 0 ? (
          <p className="text-muted-foreground">No tenancies recorded yet.</p>
        ) : (
          passport.tenancies.map((t) => (
            <div
              key={t.tenancy_id}
              className="border-b border-border/50 pb-3 last:border-b-0 last:pb-0"
            >
              <div className="font-medium">{t.property_name}</div>
              <div className="text-xs text-muted-foreground">{t.property_address || '—'}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {formatHumanDate(t.start_date)} →{' '}
                {t.end_date ? formatHumanDate(t.end_date) : 'present'}
                {t.room_name ? ` · Room: ${t.room_name}` : ''}
                {t.monthly_rent_pence != null ? ` · ${formatMoney(t.monthly_rent_pence)} pcm` : ''}
                {' · '}Status: {t.status}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function PaymentsSection({ passport }: { passport: PassportData }) {
  const p = passport.payments;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="h-4 w-4 text-muted-foreground" />
          {PASSPORT_SECTION_LABEL.payments}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <PassportBandBadge band={p.band} />
        <p className="text-xs text-muted-foreground">{PAYMENT_BAND_BLURB[p.band]}</p>
        {p.paid_charges > 0 ? (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Kv label="Total paid" value={formatMoney(p.total_paid_pence)} />
            <Kv label="Paid on time" value={`${p.on_time_charges} of ${p.paid_charges}`} />
            {p.earliest_payment_date && p.latest_payment_date ? (
              <Kv
                label="Period covered"
                value={`${formatHumanDate(p.earliest_payment_date)} → ${formatHumanDate(p.latest_payment_date)}`}
              />
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DocumentsSection({ passport }: { passport: PassportData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-muted-foreground" />
          {PASSPORT_SECTION_LABEL.documents}
        </CardTitle>
        <CardDescription>
          Documents shared by your landlord. Signed ASTs and certificates appear here automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        {passport.documents.length === 0 ? (
          <p className="text-muted-foreground">No documents recorded yet.</p>
        ) : (
          <ul className="space-y-1">
            {passport.documents.slice(0, 12).map((d) => (
              <li key={`${d.kind}-${d.added_at}-${d.title}`} className="text-xs">
                <span className="text-foreground">{d.title}</span>
                <span className="ml-2 text-muted-foreground">
                  ({d.kind} · {formatHumanDate(d.added_at)})
                </span>
              </li>
            ))}
            {passport.documents.length > 12 ? (
              <li className="text-xs text-muted-foreground">
                …and {passport.documents.length - 12} more in the PDF.
              </li>
            ) : null}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium text-foreground/90">{value}</div>
    </div>
  );
}

function formatHumanDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
