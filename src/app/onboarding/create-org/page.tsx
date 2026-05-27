import { BackLink } from '@/components/common/back-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CreateOrgForm } from '@/features/onboarding/components/create-org-form';

export default function CreateOrgPage() {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <BackLink fallbackHref="/dispatch" />
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
