'use client';

import { useEffect, useState, type FormEvent } from 'react';
import PageHeader from '@/components/PageHeader';
import OpeningBalanceForm from '@/components/OpeningBalanceForm';
import {
  ApiError,
  deleteSavedItem,
  getAuthMe,
  getSavedItems,
  getShopById,
  updateSavedItem,
  updateShop,
} from '@/lib/api';
import type { Shop } from '@/types/shop';

type SavedItem = Awaited<ReturnType<typeof getSavedItems>>[number];

type ShopFormValues = {
  name: string;
  phone: string;
  email: string;
  address: string;
};

type ShopFormErrors = Partial<Record<keyof ShopFormValues, string>>;

const NAME_MAX = 80;
const ADDRESS_MAX = 200;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^(\+91|0)?\d{10}$/;

const inputClass =
  'w-full min-w-0 rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring';
const cardClass =
  'rounded-[var(--radius)] border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-6';
const primaryButtonClass =
  'inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-50';
const outlineButtonClass =
  'inline-flex h-9 items-center justify-center rounded-full border border-border px-4 text-sm font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-50';

const rupeeFormatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

function formatRupees(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) ? rupeeFormatter.format(n) : '—';
}

function cleanOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function validateShop(values: ShopFormValues): ShopFormErrors {
  const errors: ShopFormErrors = {};
  const name = values.name.trim();
  if (name === '') {
    errors.name = 'Please enter your shop name.';
  } else if (name.length > NAME_MAX) {
    errors.name = 'Shop name must be 80 characters or fewer.';
  }
  const phone = values.phone.trim();
  if (phone !== '' && !PHONE_PATTERN.test(phone.replace(/[\s-]/g, ''))) {
    errors.phone = 'Enter a valid 10-digit phone number, for example 98765 43210.';
  }
  const email = values.email.trim();
  if (email !== '' && !EMAIL_PATTERN.test(email)) {
    errors.email = 'Enter a valid email address, for example shop@example.com.';
  }
  if (values.address.trim().length > ADDRESS_MAX) {
    errors.address = 'Address must be 200 characters or fewer.';
  }
  return errors;
}

export default function SettingsPage() {
  const [shopId, setShopId] = useState<string | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [items, setItems] = useState<SavedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState<ShopFormValues>({ name: '', phone: '', email: '', address: '' });
  const [formErrors, setFormErrors] = useState<ShopFormErrors>({});
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [itemError, setItemError] = useState<string | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  const safeItems = Array.isArray(items) ? items : [];

  async function loadItems() {
    try {
      setItems(await getSavedItems());
    } catch (err) {
      setItemError(err instanceof ApiError ? err.message : 'Could not load saved items.');
    }
  }

  async function loadShop(id: string) {
    const loaded = await getShopById(id);
    setShop(loaded);
    return loaded;
  }

  async function loadAll() {
    setLoadError(null);
    try {
      const me = (await getAuthMe()) as { shop_id?: string } | null;
      const id = me?.shop_id ?? null;
      setShopId(id);
      if (!id) {
        setLoadError('Your shop is not set up yet. Open Today and retry setup.');
        return;
      }
      const loaded = await loadShop(id);
      setForm({
        name: loaded.name ?? '',
        phone: loaded.phone ?? '',
        email: loaded.email ?? '',
        address: loaded.address ?? '',
      });
      await loadItems();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load settings.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
    // loadAll is stable for initial load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleShopSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!shopId || isSaving) return;
    const errors = validateShop(form);
    setFormErrors(errors);
    setFormMessage(null);
    if (Object.keys(errors).length > 0) return;

    setIsSaving(true);
    try {
      const updated = await updateShop(shopId, {
        name: form.name.trim(),
        phone: cleanOrNull(form.phone),
        email: cleanOrNull(form.email)?.toLowerCase() ?? null,
        address: cleanOrNull(form.address),
      });
      setShop(updated);
      setFormMessage('Shop details saved.');
    } catch (err) {
      setFormMessage(err instanceof ApiError ? err.message : 'Could not save shop details. Try again.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleOpeningSaved() {
    if (!shopId) return;
    try {
      await loadShop(shopId);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not refresh shop details.');
    }
  }

  function startEdit(item: SavedItem) {
    setItemError(null);
    setEditingId(item.id);
    setEditDescription(item.description ?? '');
    setEditPrice(String(Number(item.unitPrice)));
  }

  async function saveItem(id: string) {
    const description = editDescription.trim();
    const price = Number(editPrice);
    if (description === '') {
      setItemError('Please enter a description for this item.');
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setItemError('Unit price must be 0 or more.');
      return;
    }
    setItemError(null);
    setBusyItemId(id);
    try {
      await updateSavedItem(id, { description, unitPrice: String(price) });
      setEditingId(null);
      await loadItems();
    } catch (err) {
      setItemError(err instanceof ApiError ? err.message : 'Could not save this item.');
    } finally {
      setBusyItemId(null);
    }
  }

  async function removeItem(id: string) {
    if (!window.confirm('Remove this saved item? Invoices already using it are unchanged.')) return;
    setItemError(null);
    setBusyItemId(id);
    try {
      await deleteSavedItem(id);
      await loadItems();
    } catch (err) {
      setItemError(err instanceof ApiError ? err.message : 'Could not remove this item.');
    } finally {
      setBusyItemId(null);
    }
  }

  if (isLoading) {
    return <p className="p-4 text-sm text-muted-foreground" data-nexen-id="nx-31a1988f-0">Loading settings…</p>;
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Settings"
        description="Shop details, opening cash balance and saved items."
        actions={null}
        className=""
      />

      {loadError && (
        <div role="alert" className="rounded-[var(--radius)] border border-border bg-card p-4 text-sm text-destructive">
          {loadError}
        </div>
      )}

      <section className={cardClass} aria-labelledby="shop-details-heading" data-nexen-id="nx-31a1988f-1">
        <h2 id="shop-details-heading" className="text-lg font-semibold" data-nexen-id="nx-31a1988f-2">Shop details</h2>
        <p className="mb-4 mt-1 text-sm text-muted-foreground" data-nexen-id="nx-31a1988f-3">
          Shown on invoice previews, printouts and reminder drafts.
        </p>
        <form onSubmit={handleShopSubmit} noValidate className="space-y-4" data-nexen-id="nx-31a1988f-4">
          <div className="space-y-1">
            <label htmlFor="shop-name" className="text-sm font-medium" data-nexen-id="nx-31a1988f-5">Shop name</label>
            <input
              id="shop-name"
              className={inputClass}
              value={form.name}
              maxLength={NAME_MAX + 20}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
             data-nexen-id="nx-31a1988f-6"/>
            {formErrors.name && <p className="text-sm text-destructive" data-nexen-id="nx-31a1988f-7">{formErrors.name}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="shop-phone" className="text-sm font-medium" data-nexen-id="nx-31a1988f-8">Phone (optional)</label>
              <input
                id="shop-phone"
                type="tel"
                className={inputClass}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
               data-nexen-id="nx-31a1988f-9"/>
              {formErrors.phone && <p className="text-sm text-destructive" data-nexen-id="nx-31a1988f-10">{formErrors.phone}</p>}
            </div>
            <div className="space-y-1">
              <label htmlFor="shop-email" className="text-sm font-medium" data-nexen-id="nx-31a1988f-11">Email (optional)</label>
              <input
                id="shop-email"
                type="email"
                className={inputClass}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
               data-nexen-id="nx-31a1988f-12"/>
              {formErrors.email && <p className="text-sm text-destructive" data-nexen-id="nx-31a1988f-13">{formErrors.email}</p>}
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="shop-address" className="text-sm font-medium" data-nexen-id="nx-31a1988f-14">Address (optional)</label>
            <textarea
              id="shop-address"
              rows={3}
              className={inputClass}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
             data-nexen-id="nx-31a1988f-15"/>
            {formErrors.address && <p className="text-sm text-destructive" data-nexen-id="nx-31a1988f-16">{formErrors.address}</p>}
          </div>

          {formMessage && <p role="status" className="text-sm text-muted-foreground" data-nexen-id="nx-31a1988f-17">{formMessage}</p>}

          <button type="submit" className={primaryButtonClass} disabled={isSaving || !shopId} data-nexen-id="nx-31a1988f-18">
            {isSaving ? 'Saving…' : 'Save shop details'}
          </button>
        </form>
      </section>

      <section className={cardClass} aria-labelledby="opening-balance-heading" data-nexen-id="nx-31a1988f-19">
        <h2 id="opening-balance-heading" className="text-lg font-semibold" data-nexen-id="nx-31a1988f-20">Opening cash balance</h2>
        <p className="mb-4 mt-1 text-sm text-muted-foreground" data-nexen-id="nx-31a1988f-21">
          Records placed on or after the effective date are counted in available cash.
        </p>
        {shopId && shop && (
          <OpeningBalanceForm
            shopId={shopId}
            openingCashBalance={shop.openingCashBalance ?? null}
            openingBalanceEffectiveDate={shop.openingBalanceEffectiveDate ?? null}
            onSaved={handleOpeningSaved}
          />
        )}
      </section>

      <section className={cardClass} aria-labelledby="saved-items-heading" data-nexen-id="nx-31a1988f-22">
        <h2 id="saved-items-heading" className="text-lg font-semibold" data-nexen-id="nx-31a1988f-23">Saved items</h2>
        <p className="mb-4 mt-1 text-sm text-muted-foreground" data-nexen-id="nx-31a1988f-24">
          Reusable item details for New Invoice. Edits never change existing invoices.
        </p>

        {itemError && (
          <p role="alert" className="mb-3 text-sm text-destructive" data-nexen-id="nx-31a1988f-25">{itemError}</p>
        )}

        {safeItems.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-nexen-id="nx-31a1988f-26">No saved items yet. Save one from New Invoice.</p>
        ) : (
          <ul className="divide-y divide-border" data-nexen-id="nx-31a1988f-27">
            {safeItems.map((item) => {
              const isEditing = editingId === item.id;
              const isBusy = busyItemId === item.id;
              return (
                <li data-nexen-component="nx_app_settings_page" key={item.id} className="py-3" data-nexen-id="nx-31a1988f-28">
                  {isEditing ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        aria-label="Item description"
                        className={`${inputClass} sm:flex-1`}
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                       data-nexen-id="nx-31a1988f-29"/>
                      <input
                        aria-label="Unit price"
                        type="number"
                        min={0}
                        step="0.01"
                        className={`${inputClass} sm:w-32`}
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                       data-nexen-id="nx-31a1988f-30"/>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className={primaryButtonClass.replace('h-11', 'h-9')}
                          disabled={isBusy}
                          onClick={() => saveItem(item.id)}
                         data-nexen-id="nx-31a1988f-31">
                          Save
                        </button>
                        <button
                          type="button"
                          className={outlineButtonClass}
                          disabled={isBusy}
                          onClick={() => setEditingId(null)}
                         data-nexen-id="nx-31a1988f-32">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium" data-nexen-id="nx-31a1988f-33">{item.description}</p>
                        <p className="text-sm text-muted-foreground" data-nexen-id="nx-31a1988f-34">{formatRupees(item.unitPrice)} per unit</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className={outlineButtonClass}
                          disabled={isBusy}
                          onClick={() => startEdit(item)}
                         data-nexen-id="nx-31a1988f-35">
                          Edit
                        </button>
                        <button
                          type="button"
                          className={outlineButtonClass}
                          disabled={isBusy}
                          onClick={() => removeItem(item.id)}
                         data-nexen-id="nx-31a1988f-36">
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}