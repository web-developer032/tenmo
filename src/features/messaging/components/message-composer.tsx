'use client';

import { Loader2, Send } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MESSAGE_MAX_LENGTH } from '@/core/constants/messaging';
import { isValidMessageBody } from '@/core/utils/messaging-rules';

/**
 * Composer — auto-grows the textarea, submits on Enter (Shift+Enter for
 * a newline), shows a remaining-char counter once the user is within
 * 100 chars of the limit.
 *
 * `onTyping` is invoked on every keystroke that mutates the body. The
 * throttle/expiry logic lives in `useConversation.notifyTyping()` so
 * the composer stays dumb.
 */
export function MessageComposer({
  onSend,
  onTyping,
  sending,
  disabled,
  placeholder = 'Write a message…',
}: {
  onSend: (body: string) => Promise<void> | void;
  onTyping?: () => void;
  sending: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [body, setBody] = React.useState('');
  const taRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, []);

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBody(e.target.value);
    const ta = taRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
    }
    if (e.target.value.trim().length > 0) onTyping?.();
  };

  const valid = isValidMessageBody(body);
  const remaining = MESSAGE_MAX_LENGTH - body.length;

  const submit = async () => {
    if (!valid || sending || disabled) return;
    await onSend(body);
    setBody('');
    if (taRef.current) {
      taRef.current.style.height = 'auto';
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div className="border-t bg-background px-3 py-2">
      <div className="flex items-end gap-2">
        <Textarea
          ref={taRef}
          value={body}
          onChange={onChange}
          onKeyDown={onKeyDown}
          rows={1}
          maxLength={MESSAGE_MAX_LENGTH}
          placeholder={placeholder}
          disabled={disabled || sending}
          className="min-h-[40px] resize-none"
        />
        <Button
          type="button"
          size="icon"
          onClick={() => void submit()}
          disabled={!valid || sending || disabled}
          aria-label="Send message"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      {remaining < 100 ? (
        <p className="mt-1 text-right text-[10px] text-muted-foreground">
          {remaining} characters remaining
        </p>
      ) : null}
    </div>
  );
}
