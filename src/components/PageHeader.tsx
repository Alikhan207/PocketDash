
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export default function PageHeader({
  title,
  description,
  actions,
  className = '',
}: PageHeaderProps) {
  const safeTitle = typeof title === 'string' ? title : '';
  const safeDescription = typeof description === 'string' ? description : '';

  return (
    <header data-nexen-component="nx_components_PageHeader"
      className={`flex w-full flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between ${className}`.trim()}
     data-nexen-id="nx-8bc82b36-0">
      <div className="min-w-0 flex-1">
        <h1 className="break-words font-sans text-2xl font-extrabold leading-tight tracking-tight text-foreground sm:text-3xl" data-nexen-id="nx-8bc82b36-1">
          {safeTitle}
        </h1>
        {safeDescription ? (
          <p className="mt-1 max-w-2xl break-words text-sm text-muted-foreground" data-nexen-id="nx-8bc82b36-2">
            {safeDescription}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          {actions}
        </div>
      ) : null}
    </header>
  );
}