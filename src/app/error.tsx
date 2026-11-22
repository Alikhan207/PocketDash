'use client';

import Link from 'next/link';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl space-y-4 p-8">
      <h1 className="text-2xl font-bold">Something went wrong.</h1>
      <p className="text-muted-foreground">Your records are safe. Try again, or go back to Today.</p>
      <div className="flex gap-3">
        <button type="button" onClick={reset} className="rounded-full bg-primary px-5 py-2.5 font-semibold text-primary-foreground">Try again</button>
        <Link href="/" className="rounded-full border px-5 py-2.5 font-semibold">Back to Today</Link>
      </div>
    </main>
  );
}
