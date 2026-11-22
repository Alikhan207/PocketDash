'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getInvoiceFollowUps,
  createInvoiceFollowUp,
  updateFollowUp,
  createFollowUpMarkSent,
  deleteFollowUp,
} from '@/lib/api';
import type { FollowUp } from '@/types/followup';

const MAX_LENGTH = 1000;

type Props = {
  invoiceId: string;
  customerPhone?: string | null;
};

function validateBody(text: string): string | null {
  if (text.trim().length === 0) {
    return 'Reminder message cannot be empty. Add some text before copying or opening WhatsApp.';
  }
  if (text.length > MAX_LENGTH) {
    return 'Reminder message is too long. Keep it under 1000 characters.';
  }
  return null;
}

export function ReminderPanel({ invoiceId, customerPhone }: Props) {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftBody, setDraftBody] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await getInvoiceFollowUps(invoiceId);
      setFollowUps(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load reminders.');
    } finally {
      setIsLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    load();
  }, [load]);

  const safeList = Array.isArray(followUps) ? followUps : [];
  const drafts = safeList.filter((f) => f.status === 'draft');
  const sent = safeList.filter((f) => f.status === 'sent');
  const current = drafts.find((f) => f.id === selectedId) ?? drafts[0];

  useEffect(() => {
    setDraftBody(current?.body ?? '');
  }, [current?.id, current?.body]);

  const hasPhone = Boolean(customerPhone && customerPhone.replace(/\D/g, '').length > 0);
  const whatsappHref = hasPhone
    ? `https://wa.me/${((customerPhone ?? '').replace(/\D/g, '').length === 10 ? '91' : '') + (customerPhone ?? '').replace(/\D/g, '')}?text=${encodeURIComponent(draftBody)}`
    : '';

  async function handleCreate() {
    setBusy(true);
    setError(null);
    try {
      const created = await createInvoiceFollowUp(invoiceId, {});
      setFollowUps((prev) => [created, ...prev]);
      setSelectedId(created.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create a reminder draft.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!current) return;
    const problem = validateBody(draftBody);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      const saved = await updateFollowUp(current.id, { body: draftBody });
      setFollowUps((prev) => prev.map((f) => (f.id === saved.id ? saved : f)));
      setNotice('Draft saved. The reminder is still unsent.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the draft.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    const problem = validateBody(draftBody);
    if (problem) return setError(problem);
    try {
      await navigator.clipboard.writeText(draftBody);
      setNotice('Copied. The reminder stays unsent until you record it as sent.');
    } catch {
      setError('Could not copy the reminder. Select the text and copy it manually.');
    }
  }

  async function handleMarkSent(channel: 'whatsapp' | 'copied' | 'other') {
    if (!current) return;
    setBusy(true);
    setError(null);
    try {
      const problem = validateBody(draftBody); if(problem) throw new Error(problem);
      await updateFollowUp(current.id, {body:draftBody});
      const updated = await createFollowUpMarkSent(current.id, { channel });
      setFollowUps((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
      setSelectedId(null);
      setNotice('Recorded as sent.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record the reminder as sent.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!current) return;
    setBusy(true);
    setError(null);
    try {
      await deleteFollowUp(current.id);
      setFollowUps((prev) => prev.filter((f) => f.id !== current.id));
      setSelectedId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the draft.');
    } finally {
      setBusy(false);
    }
  }

  const btn =
    'inline-flex h-9 items-center justify-center rounded-full border border-border px-4 text-sm font-medium disabled:opacity-50';
  const btnPrimary =
    'inline-flex h-9 items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50';

  return (
    <section data-nexen-component="nx_components_ReminderPanel" className="w-full min-w-0 rounded-[var(--radius)] border bg-card p-4 shadow-sm sm:p-6" data-nexen-id="nx-d2457e89-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-bold" data-nexen-id="nx-d2457e89-1">Reminder</h3>
        <button type="button" className={btnPrimary} onClick={handleCreate} disabled={busy || isLoading} data-nexen-id="nx-d2457e89-2">
          New draft
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-destructive" data-nexen-id="nx-d2457e89-3">{error}</p>}
      {notice && <p className="mt-3 text-sm text-muted-foreground" data-nexen-id="nx-d2457e89-4">{notice}</p>}

      {isLoading && <p className="mt-4 text-sm text-muted-foreground" data-nexen-id="nx-d2457e89-5">Loading reminders…</p>}

      {!isLoading && !current && (
        <p className="mt-4 text-sm text-muted-foreground" data-nexen-id="nx-d2457e89-6">No open draft. Create one to review and send.</p>
      )}

      {current && (
        <div className="mt-4 flex flex-col gap-3">
          <textarea
            className="min-h-32 w-full min-w-0 rounded-[var(--radius)] border bg-background p-3 text-sm"
            value={draftBody}
            maxLength={MAX_LENGTH + 1}
            onChange={(e) => setDraftBody(e.target.value)}
            aria-label="Reminder message"
           data-nexen-id="nx-d2457e89-7"/>
          <p className="text-xs text-muted-foreground" data-nexen-id="nx-d2457e89-8">
            {draftBody.length} / {MAX_LENGTH} characters
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn} onClick={handleSave} disabled={busy} data-nexen-id="nx-d2457e89-9">
              Save draft
            </button>
            <button type="button" className={btn} onClick={handleCopy} disabled={busy} data-nexen-id="nx-d2457e89-10">
              Copy
            </button>
            {hasPhone && (
              <a className={btn} href={whatsappHref} target="_blank" rel="noopener noreferrer" data-nexen-id="nx-d2457e89-11">
                Open in WhatsApp
              </a>
            )}
            <button type="button" className={btnPrimary} onClick={() => handleMarkSent(hasPhone ? 'whatsapp' : 'copied')} disabled={busy} data-nexen-id="nx-d2457e89-12">
              Record as sent
            </button>
            <button type="button" className={btn} onClick={handleDelete} disabled={busy} data-nexen-id="nx-d2457e89-13">
              Delete draft
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 border-t pt-4">
        <h4 className="text-sm font-semibold" data-nexen-id="nx-d2457e89-14">Sent history</h4>
        {sent.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground" data-nexen-id="nx-d2457e89-15">No reminders sent yet.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2" data-nexen-id="nx-d2457e89-16">
            {sent.map((f) => (
              <li key={f.id} className="flex min-w-0 flex-col gap-1 rounded-[var(--radius)] border p-3 text-sm sm:flex-row sm:justify-between" data-nexen-id="nx-d2457e89-17">
                <span className="min-w-0 truncate" data-nexen-id="nx-d2457e89-18">{f.body}</span>
                <span className="shrink-0 text-muted-foreground" data-nexen-id="nx-d2457e89-19">
                  {f.sentAt ? String(f.sentAt).slice(0, 10) : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default ReminderPanel;