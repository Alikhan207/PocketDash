type Amount = number | string;

export interface OutstandingBalanceCardProps {
  total: Amount;
  paid: Amount;
  title?: string;
}

function toPaise(value: Amount | undefined): number {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

const rupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatPaise(paise: number): string {
  return rupees.format(paise / 100);
}

export default function OutstandingBalanceCard(props: OutstandingBalanceCardProps) {
  const title = props.title ?? 'Outstanding balance';
  const totalPaise = toPaise(props.total);
  const paidPaise = toPaise(props.paid);
  const outstandingPaise = totalPaise - paidPaise;

  const percentPaid =
    totalPaise > 0 ? Math.min(100, Math.max(0, Math.round((paidPaise / totalPaise) * 100))) : 0;

  const isOwed = outstandingPaise > 0;
  const isOverpaid = outstandingPaise < 0;

  const balanceLabel = isOwed
    ? 'Still to collect'
    : isOverpaid
      ? 'Overpaid by'
      : 'Fully settled';

  const balanceAmount = formatPaise(Math.abs(outstandingPaise));

  const balanceTone = isOverpaid
    ? 'text-destructive'
    : isOwed
      ? 'text-foreground'
      : 'text-muted-foreground';

  return (
    <section data-nexen-component="nx_components_OutstandingBalanceCard" className="relative w-full min-w-0 max-w-full rounded-[var(--radius)] border bg-card p-6 text-card-foreground shadow-sm" data-nexen-id="nx-b5de70e5-0">
      <div className="mb-4 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 text-sm font-medium text-muted-foreground" data-nexen-id="nx-b5de70e5-1">{title}</p>
        <span className="inline-flex w-fit rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground" data-nexen-id="nx-b5de70e5-2">
          {percentPaid}% paid
        </span>
      </div>

      <p className={`mb-4 break-words text-3xl font-extrabold tracking-tight ${balanceTone}`} data-nexen-id="nx-b5de70e5-3">
        <span className="block text-sm font-medium text-muted-foreground" data-nexen-id="nx-b5de70e5-4">{balanceLabel}</span>
        {balanceAmount}
      </p>

      <div
        className="mb-2 h-3 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Share of invoice total paid"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentPaid}
      >
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${percentPaid}%` }}
        />
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 border-t pt-4 text-sm sm:grid-cols-3" data-nexen-id="nx-b5de70e5-5">
        <div className="min-w-0">
          <dt className="text-muted-foreground" data-nexen-id="nx-b5de70e5-6">Total</dt>
          <dd className="break-words font-semibold" data-nexen-id="nx-b5de70e5-7">{formatPaise(totalPaise)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted-foreground" data-nexen-id="nx-b5de70e5-8">Paid</dt>
          <dd className="break-words font-semibold" data-nexen-id="nx-b5de70e5-9">{formatPaise(paidPaise)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted-foreground" data-nexen-id="nx-b5de70e5-10">Outstanding</dt>
          <dd className={`break-words font-semibold ${balanceTone}`} data-nexen-id="nx-b5de70e5-11">
            {formatPaise(outstandingPaise)}
          </dd>
        </div>
      </dl>
    </section>
  );
}