import { Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { PassportExportListItem } from '../server/list-exports';

/**
 * Past exports list. Each link is a fresh signed URL minted at page
 * load (TTL=5 min). After that the tenant must regenerate.
 */
export function ExportHistoryList({ exports }: { exports: ReadonlyArray<PassportExportListItem> }) {
  if (exports.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Past exports</CardTitle>
          <CardDescription>You have not exported your passport yet.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Past exports</CardTitle>
        <CardDescription>
          Download links are valid for 5 minutes. Re-open this page or regenerate to get a fresh
          link.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {exports.map((e) => (
          <div
            key={e.id}
            className="flex items-center justify-between border-b border-border/50 py-2 text-sm last:border-b-0"
          >
            <div>
              <div className="font-medium">{formatHumanDateTime(e.generated_at)}</div>
              <div className="text-xs text-muted-foreground">Export {e.id.slice(0, 8)}</div>
            </div>
            {e.download_url ? (
              <a
                href={e.download_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                <Download className="h-4 w-4" /> Download
              </a>
            ) : (
              <span className="text-xs text-muted-foreground">Link expired</span>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function formatHumanDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
