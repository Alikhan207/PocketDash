
import PageHeader from '@/components/PageHeader';
import ExpenseForm from '@/components/ExpenseForm';

export default function NewExpensePage() {
  return (
    <div data-nexen-component="nx_app_expenses_new_page" className="mx-auto w-full max-w-2xl min-w-0 space-y-6 px-4 py-6 sm:px-6">
      <PageHeader
        title="New expense"
        description="This bill will be added to upcoming bills."
        actions={null}
        className="min-w-0"
      />
      <section className="w-full min-w-0 rounded-[var(--radius)] border border-border bg-card p-4 shadow-sm sm:p-6" data-nexen-id="nx-6a7d77a8-0">
        <ExpenseForm />
      </section>
    </div>
  );
}