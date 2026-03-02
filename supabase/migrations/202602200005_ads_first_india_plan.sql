create extension if not exists "pgcrypto";

-- Users table: ads-first credit model + referral compatibility columns.
alter table public.users
  add column if not exists phone text,
  add column if not exists daily_credits_used integer not null default 0,
  add column if not exists daily_reset_at timestamptz not null default now(),
  add column if not exists daily_ad_credits integer not null default 0,
  add column if not exists daily_share_credits integer not null default 0,
  add column if not exists login_bonus_at timestamptz,
  add column if not exists referred_by uuid references public.users(id) on delete set null;

alter table public.users
  alter column credits set default 3;

update public.users
set daily_reset_at = coalesce(daily_reset_at, now())
where daily_reset_at is null;

update public.users
set daily_credits_used = 0
where daily_credits_used is null;

update public.users
set daily_ad_credits = 0
where daily_ad_credits is null;

update public.users
set daily_share_credits = 0
where daily_share_credits is null;

create index if not exists idx_users_phone on public.users (phone);
create index if not exists idx_users_referred_by on public.users (referred_by);
create index if not exists idx_users_daily_reset_at on public.users (daily_reset_at);

create or replace function public.generate_referral_code()
returns text
language plpgsql
as $$
declare
  generated_code text;
begin
  loop
    generated_code := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
    exit when not exists (
      select 1
      from public.users
      where referral_code = generated_code
    );
  end loop;

  return generated_code;
end;
$$;

alter table public.users
  add column if not exists referral_code text;

alter table public.users
  alter column referral_code set default public.generate_referral_code();

update public.users
set referral_code = public.generate_referral_code()
where referral_code is null;

alter table public.users
  alter column referral_code set not null;

create unique index if not exists idx_users_referral_code on public.users (referral_code);

create or replace function public.link_referral_code(p_user_id uuid, p_referral_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_code text;
  referrer uuid;
begin
  normalized_code := upper(nullif(btrim(coalesce(p_referral_code, '')), ''));
  if normalized_code is null then
    return false;
  end if;

  select id into referrer
  from public.users
  where referral_code = normalized_code
  limit 1;

  if referrer is null or referrer = p_user_id then
    return false;
  end if;

  update public.users
  set referred_by = coalesce(referred_by, referrer)
  where id = p_user_id;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'referred_by_user_id'
  ) then
    execute
      'update public.users set referred_by_user_id = coalesce(referred_by_user_id, $1) where id = $2'
    using referrer, p_user_id;
  end if;

  insert into public.referrals (referrer_id, referred_id, reward_credited)
  values (referrer, p_user_id, false)
  on conflict (referred_id) do nothing;

  return true;
end;
$$;

-- Prompts table: sponsored inventory support.
alter table public.prompts
  add column if not exists is_sponsored boolean not null default false,
  add column if not exists sponsor_name text,
  add column if not exists sponsor_logo_url text;

create index if not exists idx_prompts_is_sponsored on public.prompts (is_sponsored);

-- Generations table: store watermark state.
alter table public.generations
  add column if not exists watermarked boolean not null default true;

-- Creator profile compatibility for Razorpay payouts.
alter table public.creator_profiles
  add column if not exists razorpay_account_id text;

-- Marketplace prompts: INR pricing column while keeping legacy price for backward compatibility.
alter table public.marketplace_prompts
  add column if not exists price_inr numeric(10, 2);

update public.marketplace_prompts
set price_inr = coalesce(price_inr, price)
where price_inr is null;

alter table public.marketplace_prompts
  alter column price_inr set default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'marketplace_prompts_price_inr_limit'
  ) then
    alter table public.marketplace_prompts
      add constraint marketplace_prompts_price_inr_limit check (price_inr >= 0 and price_inr <= 9999);
  end if;
end
$$;

create index if not exists idx_marketplace_prompts_price_inr on public.marketplace_prompts (price_inr);

-- Purchases: INR and Razorpay tracking fields while retaining legacy Stripe field.
alter table public.prompt_purchases
  add column if not exists amount_paid_inr numeric(10, 2),
  add column if not exists creator_earnings_inr numeric(10, 2),
  add column if not exists platform_fee_inr numeric(10, 2),
  add column if not exists razorpay_payment_id text;

update public.prompt_purchases
set
  amount_paid_inr = coalesce(amount_paid_inr, amount_paid),
  creator_earnings_inr = coalesce(creator_earnings_inr, creator_earnings),
  platform_fee_inr = coalesce(platform_fee_inr, platform_fee)
where amount_paid_inr is null
   or creator_earnings_inr is null
   or platform_fee_inr is null;

create index if not exists idx_prompt_purchases_razorpay_payment_id
  on public.prompt_purchases (razorpay_payment_id)
  where razorpay_payment_id is not null;

-- API key management (phase 3 public API).
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  key_hash text not null,
  name text not null,
  is_active boolean not null default true,
  total_calls integer not null default 0 check (total_calls >= 0),
  monthly_limit integer not null default 500 check (monthly_limit >= 0),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create unique index if not exists idx_api_keys_key_hash on public.api_keys (key_hash);
create index if not exists idx_api_keys_user_id on public.api_keys (user_id);
create index if not exists idx_api_keys_active on public.api_keys (is_active);

alter table public.api_keys enable row level security;

drop policy if exists "Users can read own api keys" on public.api_keys;
create policy "Users can read own api keys"
on public.api_keys
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own api keys" on public.api_keys;
create policy "Users can insert own api keys"
on public.api_keys
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own api keys" on public.api_keys;
create policy "Users can update own api keys"
on public.api_keys
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own api keys" on public.api_keys;
create policy "Users can delete own api keys"
on public.api_keys
for delete
to authenticated
using (auth.uid() = user_id);

-- Ad economy ledger.
create table if not exists public.ad_watches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  ad_type text not null check (ad_type in ('rewarded_web', 'rewarded_mobile', 'interstitial')),
  credits_earned integer not null default 0 check (credits_earned >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_ad_watches_user_created
  on public.ad_watches (user_id, created_at desc);
create index if not exists idx_ad_watches_ad_type on public.ad_watches (ad_type);

alter table public.ad_watches enable row level security;

drop policy if exists "Users can read own ad watches" on public.ad_watches;
create policy "Users can read own ad watches"
on public.ad_watches
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own ad watches" on public.ad_watches;
create policy "Users can insert own ad watches"
on public.ad_watches
for insert
to authenticated
with check (auth.uid() = user_id);

-- Referral reward update: referrer gets 5 credits on referred user's first generation.
create or replace function public.reward_referrer_on_first_generation()
returns trigger
language plpgsql
as $$
declare
  referrer uuid;
begin
  if new.user_id is null then
    return new;
  end if;

  if exists (
    select 1
    from public.generations g
    where g.user_id = new.user_id
      and g.id <> new.id
  ) then
    return new;
  end if;

  select coalesce(r.referrer_id, u.referred_by) into referrer
  from public.users u
  left join public.referrals r on r.referred_id = new.user_id and r.reward_credited = false
  where u.id = new.user_id
  limit 1;

  if referrer is null then
    return new;
  end if;

  update public.users
  set credits = credits + 5
  where id = referrer;

  update public.referrals
  set reward_credited = true
  where referred_id = new.user_id
    and reward_credited = false;

  return new;
end;
$$;

drop trigger if exists trg_reward_referrer_on_generation on public.generations;
create trigger trg_reward_referrer_on_generation
after insert on public.generations
for each row execute function public.reward_referrer_on_first_generation();
