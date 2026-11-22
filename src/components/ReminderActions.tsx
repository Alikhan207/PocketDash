
'use client';

import { useState } from 'react';
import { ApiError, createFollowUpMarkSent } from '@/lib/api';

const MAX_LENGTH = 1000;

interface ReminderActionsProps {
  followUpId?: string;
  body: string;
  customerPhone?: string | null;
  onSent?: () => void;
}

export default function ReminderActions(props: ReminderActionsProps) {
  const { followUpId, body, customerPhone, onSent } = props;
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const phoneDigits = ((customerPhone ?? '').replace(/\D/g, '').length === 10 ? '91' : '') + (customerPhone ?? '').replace(/\D/g, '');
  const canWhatsApp = phoneDigits.length > 0;

  function validateMessage(): string | null {
    if (!body || body.trim().length === 0) {
      return 'Reminder message cannot be empty. Add some text before copying or opening WhatsApp.';
    }
    if (body.length > MAX_LENGTH) {
      return 'Reminder message is too long. Keep it under 1000 characters.';
    }
    return null;
  }

  async function handleCopy() {
    const problem = validateMessage();
    if (problem) {
      setError(problem);
      setNotice(null);
      return;
    }
    try {
      await navigator.clipboard.writeText(body);
      setError(null);
      setNotice('Copied. The reminder stays unsent until you record it as sent.');
    } catch {
      setError('Could not copy the message. Select the text and copy it manually.');
      setNotice(null);
    }
  }

  function handleOpenWhatsApp() {
    const problem = validateMessage();
    if (problem) {
      setError(problem);
      setNotice(null);
      return;
    }
    if (!canWhatsApp) return;
    window.open(
      `https://wa.me/${phoneDigits}?text=${encodeURIComponent(body)}`,
      '_blank',
      'noopener,noreferrer',
    );
    setError(null);
    setNotice('WhatsApp opened with the draft. Record it as sent once you have sent it.');
  }

  async function markSent(channel: 'whatsapp' | 'other') {
    if (!followUpId) return;
    setBusy(true);
    setError(null);
    try {
      await createFollowUpMarkSent(followUpId, { channel });
      setNotice('Reminder recorded as sent.');
      onSent?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not record the reminder. Try again.');
      setNotice(null);
    } finally {
      setBusy(false);
    }
  }

  const pillBase =
    'inline-flex items-center justify-center h-9 px-4 rounded-full text-sm font-semibold border transition-opacity disabled:opacity-50';
  const pillPrimary = `${pillBase} bg-primary text-primary-foreground border-transparent shadow-sm`;
  const pillOutline = `${pillBase} bg-transparent text-foreground border-border`;

  return (
    <div data-nexen-component="nx_components_ReminderActions" className="flex flex-col gap-3 min-w-0">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={handleCopy} className={pillOutline} data-nexen-id="nx-8a5053c6-0">
          Copy reminder
        </button>
        {canWhatsApp && (
          <button type="button" onClick={handleOpenWhatsApp} className={pillOutline} data-nexen-id="nx-8a5053c6-1">
            Open WhatsApp draft
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {canWhatsApp && (
          <button
            type="button"
            onClick={() => markSent('whatsapp')}
            disabled={busy || !followUpId}
            className={pillPrimary}
           data-nexen-id="nx-8a5053c6-2">
            Record sent on WhatsApp
          </button>
        )}
        <button
          type="button"
          onClick={() => markSent('other')}
          disabled={busy || !followUpId}
          className={canWhatsApp ? pillOutline : pillPrimary}
         data-nexen-id="nx-8a5053c6-3">
          Record sent (other channel)
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-[hsl(var(--destructive))] break-words" data-nexen-id="nx-8a5053c6-4">
          {error}
        </p>
      )}
      {notice && !error && (
        <p role="status" className="text-sm text-muted-foreground break-words" data-nexen-id="nx-8a5053c6-5">
          {notice}
        </p>
      )}
    </div>
  );
}