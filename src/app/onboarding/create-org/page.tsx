import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CreateOrgForm } from '@/features/onboarding/components/create-org-form';

export default function CreateOrgPage() {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <Link
          href="/onboarding"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Link>
        <CardTitle className="text-2xl">Create your organisation</CardTitle>
        <CardDescription>
          One org per landlord business. You can rename it later, but the URL slug is permanent.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CreateOrgForm />
      </CardContent>
    </Card>
  );
}
