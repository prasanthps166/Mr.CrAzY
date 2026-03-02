create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.users(id) on delete cascade,
  referred_id uuid not null unique references public.users(id) on delete cascade,
  reward_credited boolean not null default false,
  created_at timestamptz not null default now(),
  unique (referrer_id, referred_id)
);

create index if not exists idx_analytics_events_created_at on public.analytics_events (created_at desc);
create index if not exists idx_analytics_events_event_type on public.analytics_events (event_type);
create index if not exists idx_analytics_events_user_id on public.analytics_events (user_id);
create index if not exists idx_referrals_referrer_id on public.referrals (referrer_id);
create index if not exists idx_referrals_referred_id on public.referrals (referred_id);

alter table public.analytics_events enable row level security;
alter table public.referrals enable row level security;

drop policy if exists "Users can read own analytics events" on public.analytics_events;
create policy "Users can read own analytics events"
on public.analytics_events
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert analytics for themselves" on public.analytics_events;
create policy "Users can insert analytics for themselves"
on public.analytics_events
for insert
to authenticated
with check (user_id is null or auth.uid() = user_id);

drop policy if exists "Users can read their referrals" on public.referrals;
create policy "Users can read their referrals"
on public.referrals
for select
to authenticated
using (auth.uid() = referrer_id or auth.uid() = referred_id);

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
  add column if not exists referral_code text,
  add column if not exists referred_by_user_id uuid references public.users(id) on delete set null;

alter table public.users
  alter column referral_code set default public.generate_referral_code();

update public.users
set referral_code = public.generate_referral_code()
where referral_code is null;

alter table public.users
  alter column referral_code set not null;

create unique index if not exists idx_users_referral_code on public.users (referral_code);
create index if not exists idx_users_referred_by_user_id on public.users (referred_by_user_id);

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
  set referred_by_user_id = coalesce(referred_by_user_id, referrer)
  where id = p_user_id;

  insert into public.referrals (referrer_id, referred_id, reward_credited)
  values (referrer, p_user_id, false)
  on conflict (referred_id) do nothing;

  return true;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  referral_code_used text;
  referrer uuid;
begin
  referral_code_used := upper(
    nullif(
      btrim(
        coalesce(
          new.raw_user_meta_data->>'referral_code_used',
          new.raw_user_meta_data->>'ref',
          ''
        )
      ),
      ''
    )
  );

  if referral_code_used is not null then
    select id into referrer
    from public.users
    where referral_code = referral_code_used
    limit 1;

    if referrer = new.id then
      referrer := null;
    end if;
  end if;

  insert into public.users (id, email, full_name, avatar_url, referral_code, referred_by_user_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    public.generate_referral_code(),
    referrer
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.users.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.users.avatar_url),
    referral_code = coalesce(public.users.referral_code, excluded.referral_code),
    referred_by_user_id = coalesce(public.users.referred_by_user_id, excluded.referred_by_user_id);

  if referrer is not null then
    insert into public.referrals (referrer_id, referred_id, reward_credited)
    values (referrer, new.id, false)
    on conflict (referred_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.referrals (referrer_id, referred_id, reward_credited)
select referred_by_user_id, id, false
from public.users
where referred_by_user_id is not null
on conflict (referred_id) do nothing;

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

  select r.referrer_id into referrer
  from public.referrals r
  where r.referred_id = new.user_id
    and r.reward_credited = false
  limit 1;

  if referrer is null then
    return new;
  end if;

  update public.users
  set credits = credits + 10
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

create or replace function public.log_generation_complete_event()
returns trigger
language plpgsql
as $$
begin
  insert into public.analytics_events (user_id, event_type, metadata)
  values (
    new.user_id,
    'generation_complete',
    jsonb_build_object(
      'generation_id', new.id,
      'prompt_id', new.prompt_id
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_log_generation_complete_event on public.generations;
create trigger trg_log_generation_complete_event
after insert on public.generations
for each row execute function public.log_generation_complete_event();

create or replace function public.log_share_event()
returns trigger
language plpgsql
as $$
begin
  insert into public.analytics_events (user_id, event_type, metadata)
  values (
    new.user_id,
    'share',
    jsonb_build_object(
      'community_post_id', new.id,
      'generation_id', new.generation_id
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_log_share_event on public.community_posts;
create trigger trg_log_share_event
after insert on public.community_posts
for each row execute function public.log_share_event();

create or replace function public.log_marketplace_purchase_event()
returns trigger
language plpgsql
as $$
begin
  insert into public.analytics_events (user_id, event_type, metadata)
  values (
    new.user_id,
    'purchase',
    jsonb_build_object(
      'purchase_id', new.id,
      'marketplace_prompt_id', new.marketplace_prompt_id,
      'amount_paid', new.amount_paid
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_log_marketplace_purchase_event on public.prompt_purchases;
create trigger trg_log_marketplace_purchase_event
after insert on public.prompt_purchases
for each row execute function public.log_marketplace_purchase_event();
