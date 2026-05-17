import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/cn';

export type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  description: string;
  cta?: { label: string; href: string };
  className?: string;
};

export function EmptyState({ icon, title, description, cta, className }: EmptyStateProps) {
  return (
    <Card className={cn('border-dashed', className)}>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="max-w-md text-sm text-muted-foreground">{description}</p>
        </div>
        {cta ? (
          <Button asChild size="sm" className="mt-2">
            <Link href={cta.href}>{cta.label}</Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
