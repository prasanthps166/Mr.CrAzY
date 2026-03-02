alter table public.users
  add column if not exists stripe_subscription_id text;

create unique index if not exists idx_users_stripe_customer_id
  on public.users (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists idx_users_stripe_subscription_id
  on public.users (stripe_subscription_id)
  where stripe_subscription_id is not null;

create table if not exists public.billing_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  plan_id text not null,
  kind text not null check (kind in ('subscription', 'credits', 'marketplace', 'other')),
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'refunded', 'canceled')),
  amount_total numeric(10, 2) not null default 0 check (amount_total >= 0),
  currency text not null default 'usd',
  stripe_event_id text,
  stripe_customer_id text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_invoice_id text,
  stripe_subscription_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_billing_transactions_user_created
  on public.billing_transactions (user_id, created_at desc);

create index if not exists idx_billing_transactions_plan_id
  on public.billing_transactions (plan_id);

create index if not exists idx_billing_transactions_status
  on public.billing_transactions (status);

create unique index if not exists idx_billing_transactions_stripe_event_id
  on public.billing_transactions (stripe_event_id)
  where stripe_event_id is not null;

create unique index if not exists idx_billing_transactions_stripe_checkout_session_id
  on public.billing_transactions (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index if not exists idx_billing_transactions_stripe_payment_intent_id
  on public.billing_transactions (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create unique index if not exists idx_billing_transactions_stripe_invoice_id
  on public.billing_transactions (stripe_invoice_id)
  where stripe_invoice_id is not null;

create or replace function public.set_billing_transaction_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_set_billing_transaction_updated_at on public.billing_transactions;
create trigger trg_set_billing_transaction_updated_at
before update on public.billing_transactions
for each row execute function public.set_billing_transaction_updated_at();

alter table public.billing_transactions enable row level security;

drop policy if exists "Users can read own billing transactions" on public.billing_transactions;
create policy "Users can read own billing transactions"
on public.billing_transactions
for select
to authenticated
using (auth.uid() = user_id);
