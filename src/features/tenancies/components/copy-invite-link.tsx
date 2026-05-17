'use client';

import { Check, Copy } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

/**
 * Reusable copy-to-clipboard button. Used to share invite URLs when the
 * email gateway is offline, or when a landlord wants to deliver the link
 * via WhatsApp/SMS instead.
 */
export function CopyInviteLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = React.useState(false);

  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Invite link copied');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — copy from the field above');
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={onClick}>
      {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
      {copied ? 'Copied' : 'Copy invite link'}
    </Button>
  );
}
