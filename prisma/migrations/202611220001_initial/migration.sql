-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('draft', 'unpaid', 'partially_paid', 'paid', 'cancelled');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'upi', 'bank_transfer', 'card', 'other');

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('advance', 'partial', 'final');

-- CreateEnum
CREATE TYPE "PaymentVerificationStatus" AS ENUM ('seller_recorded');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('draft', 'sent');

-- CreateEnum
CREATE TYPE "FollowUpChannel" AS ENUM ('whatsapp', 'copied', 'other');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('blank_t_shirts', 'printing', 'yarn', 'packaging', 'delivery', 'other');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('unpaid', 'paid');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('overdue_invoice', 'upcoming_bill', 'cash_shortage', 'overdue_no_expected_date');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('active', 'resolved');

-- CreateEnum
CREATE TYPE "ScenarioStatus" AS ENUM ('active', 'reset');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clerk_user_id" TEXT NOT NULL,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "last_signed_in_at" TIMESTAMP(3),
    "last_signed_out_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shops" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "opening_cash_balance" DECIMAL(12,2),
    "opening_balance_effective_date" DATE,

    CONSTRAINT "shops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "shop_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_items" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "shop_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "saved_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "shop_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'draft',
    "issue_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "expected_collection_date" DATE,
    "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "invoice_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "line_total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "invoice_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paid_on" DATE NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "kind" "PaymentKind" NOT NULL,
    "verification_status" "PaymentVerificationStatus" NOT NULL DEFAULT 'seller_recorded',
    "idempotency_key" TEXT NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_ups" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "invoice_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'draft',
    "channel" "FollowUpChannel",
    "sent_at" TIMESTAMP(3),

    CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "shop_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "due_date" DATE NOT NULL,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'unpaid',
    "paid_on" DATE,
    "revised_payment_date" DATE,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "shop_id" UUID NOT NULL,
    "alert_type" "AlertType" NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'active',
    "invoice_id" UUID,
    "expense_id" UUID,
    "shortage_date" DATE,
    "shortage_amount" DECIMAL(12,2),
    "message" TEXT NOT NULL,
    "action_taken_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenarios" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "shop_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "status" "ScenarioStatus" NOT NULL DEFAULT 'active',
    "delay_days" INTEGER NOT NULL DEFAULT 15,
    "forecast_days" INTEGER NOT NULL DEFAULT 30,
    "scenario_expected_collection_date" DATE,
    "baseline_min_cash" DECIMAL(12,2),
    "scenario_min_cash" DECIMAL(12,2),
    "baseline_first_shortage_date" DATE,
    "scenario_first_shortage_date" DATE,
    "shortage_amount" DECIMAL(12,2),
    "suggested_action" TEXT,
    "is_baseline" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_clerk_user_id_key" ON "users"("clerk_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "shops_user_id_key" ON "shops"("user_id");

-- CreateIndex
CREATE INDEX "customers_shop_id_idx" ON "customers"("shop_id");

-- CreateIndex
CREATE INDEX "saved_items_shop_id_idx" ON "saved_items"("shop_id");

-- CreateIndex
CREATE INDEX "invoices_shop_id_status_due_date_idx" ON "invoices"("shop_id", "status", "due_date");

-- CreateIndex
CREATE INDEX "invoices_customer_id_idx" ON "invoices"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_shop_id_invoice_number_key" ON "invoices"("shop_id", "invoice_number");

-- CreateIndex
CREATE INDEX "invoice_items_invoice_id_idx" ON "invoice_items"("invoice_id");

-- CreateIndex
CREATE INDEX "payments_invoice_id_idx" ON "payments"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_invoice_id_idempotency_key_key" ON "payments"("invoice_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "follow_ups_invoice_id_idx" ON "follow_ups"("invoice_id");

-- CreateIndex
CREATE INDEX "expenses_shop_id_status_due_date_idx" ON "expenses"("shop_id", "status", "due_date");

-- CreateIndex
CREATE INDEX "alerts_shop_id_status_idx" ON "alerts"("shop_id", "status");

-- CreateIndex
CREATE INDEX "alerts_invoice_id_idx" ON "alerts"("invoice_id");

-- CreateIndex
CREATE INDEX "alerts_expense_id_idx" ON "alerts"("expense_id");

-- CreateIndex
CREATE INDEX "scenarios_shop_id_status_idx" ON "scenarios"("shop_id", "status");

-- CreateIndex
CREATE INDEX "scenarios_invoice_id_idx" ON "scenarios"("invoice_id");

-- AddForeignKey
ALTER TABLE "shops" ADD CONSTRAINT "shops_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_items" ADD CONSTRAINT "saved_items_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Invariants that cannot be represented by Prisma field attributes.
ALTER TABLE shops ADD CONSTRAINT opening_balance_paired CHECK ((opening_cash_balance IS NULL) = (opening_balance_effective_date IS NULL));
ALTER TABLE expenses ADD CONSTRAINT paid_date_matches_status CHECK ((status = 'paid') = (paid_on IS NOT NULL));
ALTER TABLE expenses ADD CONSTRAINT positive_expense CHECK (amount > 0);
ALTER TABLE payments ADD CONSTRAINT positive_payment CHECK (amount > 0);
ALTER TABLE invoice_items ADD CONSTRAINT valid_line_amount CHECK (quantity > 0 AND unit_price >= 0 AND line_total = quantity * unit_price);
ALTER TABLE invoices ADD CONSTRAINT valid_invoice_dates CHECK (due_date >= issue_date);
ALTER TABLE invoices ADD CONSTRAINT valid_invoice_total CHECK (total_amount >= 0);
ALTER TABLE follow_ups ADD CONSTRAINT sent_date_matches_status CHECK ((status = 'sent') = (sent_at IS NOT NULL));
ALTER TABLE scenarios ADD CONSTRAINT valid_scenario_window CHECK (delay_days BETWEEN 0 AND 90 AND forecast_days IN (30,60,90));
