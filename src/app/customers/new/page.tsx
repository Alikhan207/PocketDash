
import PageHeader from '@/components/PageHeader';
import CustomerForm from '@/components/CustomerForm';

export default function NewCustomerPage() {
  return (
    <div data-nexen-component="nx_app_customers_new_page" className="mx-auto w-full max-w-2xl min-w-0 space-y-6 px-4 py-6 sm:px-6">
      <PageHeader
        title="New customer"
        description="Name is required. Phone number and email are optional."
        actions={null}
        className=""
      />
      <div className="min-w-0 rounded-[var(--radius)] border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-6">
        <CustomerForm customerId="new" initialValues={{}} />
      </div>
    </div>
  );
}