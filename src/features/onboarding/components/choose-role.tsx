'use client';

import { Building2, Home, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const choices = [
  {
    id: 'landlord' as const,
    icon: Building2,
    title: 'I rent out rooms or properties',
    description:
      'You manage HMOs or single lets. Tenantly is free for 14 days, then £29/mo. Tenants always free.',
    next: '/onboarding/create-org',
  },
  {
    id: 'tenant' as const,
    icon: Home,
    title: 'I rent a room or property',
    description:
      "You're a tenant. Tenantly is free for you, forever. We'll connect you to your landlord by invite.",
    next: '/onboarding/tenant-waiting',
  },
  {
    id: 'both' as const,
    icon: Users,
    title: 'Both — I rent and I let',
    description:
      "Switch between landlord and tenant views any time. We'll set you up as a landlord first.",
    next: '/onboarding/create-org',
  },
];

export function ChooseRole() {
  const router = useRouter();
  const [selected, setSelected] = React.useState<(typeof choices)[number]['id'] | null>(null);

  return (
    <div className="space-y-4">
      <header className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Welcome to Tenantly</h1>
        <p className="text-muted-foreground">How do you want to start?</p>
      </header>

      <div className="grid gap-3">
        {choices.map((c) => {
          const Icon = c.icon;
          const isSelected = selected === c.id;
          return (
            <Card
              key={c.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelected(c.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelected(c.id);
                }
              }}
              className={`cursor-pointer transition-colors ${
                isSelected ? 'border-primary ring-2 ring-primary/40' : 'hover:border-primary/50'
              }`}
            >
              <CardHeader className="flex flex-row items-start gap-4 space-y-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 space-y-1">
                  <CardTitle className="text-lg">{c.title}</CardTitle>
                  <CardDescription>{c.description}</CardDescription>
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      <CardContent className="px-0">
        <Button
          className="w-full"
          size="lg"
          disabled={!selected}
          onClick={() => {
            const choice = choices.find((c) => c.id === selected);
            if (choice) router.push(choice.next);
          }}
        >
          Continue
        </Button>
      </CardContent>
    </div>
  );
}
