
'use client';

import { useEffect, useState } from 'react';
import { getSavedItems } from '@/lib/api';

export type InvoiceItemDraft = {
  description: string;
  quantity: number;
  unitPrice: number;
};

type Props = {
  items?: InvoiceItemDraft[];
  onChange: (items: InvoiceItemDraft[]) => void;
};

type SavedOption = { id: string; description: string; unitPrice: number };

const EMPTY_ITEM: InvoiceItemDraft = { description: '', quantity: 1, unitPrice: 0 };

export function getItemError(item: InvoiceItemDraft): string | null {
  if (!item.description.trim()) {
    return "Enter a description for this item, for example 'Printed T-shirt' or 'Delivery charge'.";
  }
  if (!Number.isInteger(item.quantity) || item.quantity < 1) {
    return 'Quantity must be a whole number of 1 or more.';
  }
  const paise = item.unitPrice * 100;
  if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0 || Math.abs(paise - Math.round(paise)) > 1e-6) {
    return 'Unit price must be ₹0 or more, with no more than two decimal places.';
  }
  return null;
}

export function lineTotalOf(item: InvoiceItemDraft): number {
  return Math.round(item.quantity * item.unitPrice * 100) / 100;
}

export default function InvoiceItemsEditor({ items, onChange }: Props) {
  const safeItems: InvoiceItemDraft[] = Array.isArray(items) ? items : [];
  const [saved, setSaved] = useState<SavedOption[]>([]);

  useEffect(() => {
    let active = true;
    getSavedItems()
      .then((list) => {
        if (!active) return;
        const arr = Array.isArray(list) ? list : [];
        setSaved(
          arr.map((s) => ({
            id: s.id,
            description: s.description,
            unitPrice: Number(s.unitPrice),
          })),
        );
      })
      .catch(() => {
        if (active) setSaved([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const update = (index: number, patch: Partial<InvoiceItemDraft>) =>
    onChange(safeItems.map((it, i) => (i === index ? { ...it, ...patch } : it)));

  const remove = (index: number) => onChange(safeItems.filter((_, i) => i !== index));

  const add = () => onChange([...safeItems, { ...EMPTY_ITEM }]);

  const pickSaved = (index: number, savedId: string) => {
    const option = saved.find((s) => s.id === savedId);
    if (option) update(index, { description: option.description, unitPrice: option.unitPrice });
  };

  const grandTotal = safeItems.reduce((sum, it) => sum + lineTotalOf(it), 0);

  return (
    <div className="flex flex-col gap-3">
      {safeItems.map((item, index) => {
        const error = getItemError(item);
        return (
          <div data-nexen-component="nx_components_InvoiceItemsEditor"
            key={index}
            className="flex flex-col gap-3 rounded-[var(--radius)] border bg-card p-4 shadow-sm"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="text"
                aria-label={`Item ${index + 1} description`}
                placeholder="Description, e.g. Printed T-shirt"
                value={item.description}
                maxLength={200}
                onChange={(e) => update(index, { description: e.target.value })}
                className="h-10 w-full min-w-0 flex-1 rounded-[var(--radius)] border bg-background px-3 text-sm"
               data-nexen-id="nx-93511bb5-0"/>
              <select
                aria-label={`Item ${index + 1} saved item`}
                value=""
                disabled={saved.length === 0}
                onChange={(e) => pickSaved(index, e.target.value)}
                className="h-10 w-full min-w-0 rounded-[var(--radius)] border bg-background px-3 text-sm text-muted-foreground sm:w-48"
               data-nexen-id="nx-93511bb5-1">
                <option value="">{saved.length ? 'Use a saved item' : 'No saved items'}</option>
                {saved.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.description}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground" data-nexen-id="nx-93511bb5-2">
                Qty
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={item.quantity}
                  onChange={(e) => update(index, { quantity: Number(e.target.value) })}
                  className="h-10 w-20 rounded-[var(--radius)] border bg-background px-3 text-sm text-foreground"
                 data-nexen-id="nx-93511bb5-3"/>
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground" data-nexen-id="nx-93511bb5-4">
                Unit price (₹)
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={item.unitPrice}
                  onChange={(e) => update(index, { unitPrice: Number(e.target.value) })}
                  className="h-10 w-32 rounded-[var(--radius)] border bg-background px-3 text-sm text-foreground"
                 data-nexen-id="nx-93511bb5-5"/>
              </label>
              <div className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
                Line total
                <span className="flex h-10 items-center text-sm font-semibold text-foreground" data-nexen-id="nx-93511bb5-6">
                  ₹{lineTotalOf(item).toFixed(2)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => remove(index)}
                disabled={safeItems.length <= 1}
                className="ml-auto h-10 rounded-full border px-4 text-sm font-medium text-destructive disabled:opacity-40"
               data-nexen-id="nx-93511bb5-7">
                Remove
              </button>
            </div>

            {error && <p className="text-xs text-destructive" data-nexen-id="nx-93511bb5-8">{error}</p>}
          </div>
        );
      })}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={add}
          className="h-10 rounded-full border px-5 text-sm font-semibold text-foreground"
         data-nexen-id="nx-93511bb5-9">
          Add item
        </button>
        <p className="text-sm text-muted-foreground" data-nexen-id="nx-93511bb5-10">
          Invoice total:{' '}
          <span className="font-semibold text-foreground" data-nexen-id="nx-93511bb5-11">₹{grandTotal.toFixed(2)}</span>
        </p>
      </div>
    </div>
  );
}