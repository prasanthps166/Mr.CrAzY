create extension if not exists "pgcrypto";

create table if not exists public.creator_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  display_name text not null,
  bio text,
  avatar_url text,
  total_earnings numeric(12, 2) not null default 0,
  payout_email text,
  stripe_account_id text,
  is_verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.marketplace_prompts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  title text not null,
  description text not null,
  prompt_text text not null,
  category text not null,
  cover_image_url text not null,
  example_images text[] not null default '{}',
  price numeric(10, 2) not null default 0,
  is_free boolean not null default false,
  tags text[] not null default '{}',
  purchase_count integer not null default 0,
  rating_avg numeric(3, 2) not null default 0,
  rating_count integer not null default 0,
  status text not null default 'pending_review' check (status in ('pending_review', 'approved', 'rejected')),
  rejection_reason text,
  created_at timestamptz not null default now(),
  constraint marketplace_prompts_example_images_limit check (cardinality(example_images) <= 5),
  constraint marketplace_prompts_price_limit check (price >= 0 and price <= 19.99)
);

create table if not exists public.prompt_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  marketplace_prompt_id uuid not null references public.marketplace_prompts(id) on delete cascade,
  amount_paid numeric(10, 2) not null check (amount_paid >= 0),
  creator_earnings numeric(10, 2) not null check (creator_earnings >= 0),
  platform_fee numeric(10, 2) not null check (platform_fee >= 0),
  stripe_payment_intent_id text,
  created_at timestamptz not null default now(),
  unique (user_id, marketplace_prompt_id)
);

create table if not exists public.prompt_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  marketplace_prompt_id uuid not null references public.marketplace_prompts(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  review_text text,
  created_at timestamptz not null default now(),
  unique (user_id, marketplace_prompt_id)
);

create index if not exists idx_creator_profiles_user_id on public.creator_profiles (user_id);
create index if not exists idx_marketplace_prompts_status_created_at
  on public.marketplace_prompts (status, created_at desc);
create index if not exists idx_marketplace_prompts_category on public.marketplace_prompts (category);
create index if not exists idx_marketplace_prompts_purchase_count
  on public.marketplace_prompts (purchase_count desc);
create index if not exists idx_marketplace_prompts_rating_avg
  on public.marketplace_prompts (rating_avg desc);
create index if not exists idx_prompt_purchases_user_id on public.prompt_purchases (user_id);
create index if not exists idx_prompt_purchases_prompt_id on public.prompt_purchases (marketplace_prompt_id);
create index if not exists idx_prompt_ratings_prompt_id on public.prompt_ratings (marketplace_prompt_id);

alter table public.creator_profiles enable row level security;
alter table public.marketplace_prompts enable row level security;
alter table public.prompt_purchases enable row level security;
alter table public.prompt_ratings enable row level security;

drop policy if exists "Creator profiles are publicly readable" on public.creator_profiles;
create policy "Creator profiles are publicly readable"
on public.creator_profiles
for select
using (true);

drop policy if exists "Users can insert own creator profile" on public.creator_profiles;
create policy "Users can insert own creator profile"
on public.creator_profiles
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own creator profile" on public.creator_profiles;
create policy "Users can update own creator profile"
on public.creator_profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own creator profile" on public.creator_profiles;
create policy "Users can delete own creator profile"
on public.creator_profiles
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Approved prompts are public, creators can read own" on public.marketplace_prompts;
create policy "Approved prompts are public, creators can read own"
on public.marketplace_prompts
for select
using (
  status = 'approved'
  or exists (
    select 1
    from public.creator_profiles cp
    where cp.id = creator_id and cp.user_id = auth.uid()
  )
);

drop policy if exists "Creators can insert own marketplace prompts" on public.marketplace_prompts;
create policy "Creators can insert own marketplace prompts"
on public.marketplace_prompts
for insert
to authenticated
with check (
  exists (
    select 1
    from public.creator_profiles cp
    where cp.id = creator_id and cp.user_id = auth.uid()
  )
);

drop policy if exists "Creators can update own marketplace prompts" on public.marketplace_prompts;
create policy "Creators can update own marketplace prompts"
on public.marketplace_prompts
for update
to authenticated
using (
  exists (
    select 1
    from public.creator_profiles cp
    where cp.id = creator_id and cp.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.creator_profiles cp
    where cp.id = creator_id and cp.user_id = auth.uid()
  )
);

drop policy if exists "Creators can delete own marketplace prompts" on public.marketplace_prompts;
create policy "Creators can delete own marketplace prompts"
on public.marketplace_prompts
for delete
to authenticated
using (
  exists (
    select 1
    from public.creator_profiles cp
    where cp.id = creator_id and cp.user_id = auth.uid()
  )
);

drop policy if exists "Users can read own purchases" on public.prompt_purchases;
create policy "Users can read own purchases"
on public.prompt_purchases
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own purchases" on public.prompt_purchases;
create policy "Users can insert own purchases"
on public.prompt_purchases
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Prompt ratings are publicly readable" on public.prompt_ratings;
create policy "Prompt ratings are publicly readable"
on public.prompt_ratings
for select
using (true);

drop policy if exists "Users can insert ratings for purchased prompts" on public.prompt_ratings;
create policy "Users can insert ratings for purchased prompts"
on public.prompt_ratings
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.prompt_purchases pp
    where pp.user_id = auth.uid()
      and pp.marketplace_prompt_id = prompt_ratings.marketplace_prompt_id
  )
);

drop policy if exists "Users can update own ratings" on public.prompt_ratings;
create policy "Users can update own ratings"
on public.prompt_ratings
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own ratings" on public.prompt_ratings;
create policy "Users can delete own ratings"
on public.prompt_ratings
for delete
to authenticated
using (auth.uid() = user_id);

create or replace function public.sync_marketplace_prompt_ratings()
returns trigger
language plpgsql
as $$
declare
  target_prompt_id uuid;
begin
  target_prompt_id := coalesce(new.marketplace_prompt_id, old.marketplace_prompt_id);

  update public.marketplace_prompts
  set
    rating_avg = coalesce(stats.avg_rating, 0),
    rating_count = coalesce(stats.rating_count, 0)
  from (
    select
      round(coalesce(avg(rating), 0)::numeric, 2) as avg_rating,
      count(*)::integer as rating_count
    from public.prompt_ratings
    where marketplace_prompt_id = target_prompt_id
  ) stats
  where id = target_prompt_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_marketplace_prompt_ratings on public.prompt_ratings;
create trigger trg_sync_marketplace_prompt_ratings
after insert or update or delete on public.prompt_ratings
for each row execute function public.sync_marketplace_prompt_ratings();

create or replace function public.apply_marketplace_purchase_effects()
returns trigger
language plpgsql
as $$
declare
  prompt_creator_id uuid;
begin
  update public.marketplace_prompts
  set purchase_count = purchase_count + 1
  where id = new.marketplace_prompt_id
  returning creator_id into prompt_creator_id;

  if prompt_creator_id is not null then
    update public.creator_profiles
    set total_earnings = total_earnings + coalesce(new.creator_earnings, 0)
    where id = prompt_creator_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_apply_marketplace_purchase_effects on public.prompt_purchases;
create trigger trg_apply_marketplace_purchase_effects
after insert on public.prompt_purchases
for each row execute function public.apply_marketplace_purchase_effects();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'marketplace-examples',
  'marketplace-examples',
  true,
  20971520,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "Anyone can read marketplace images" on storage.objects;
create policy "Anyone can read marketplace images"
on storage.objects
for select
using (bucket_id = 'marketplace-examples');

drop policy if exists "Creators can upload marketplace images" on storage.objects;
create policy "Creators can upload marketplace images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'marketplace-examples'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Creators can update marketplace images" on storage.objects;
create policy "Creators can update marketplace images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'marketplace-examples'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'marketplace-examples'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Creators can delete marketplace images" on storage.objects;
create policy "Creators can delete marketplace images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'marketplace-examples'
  and (storage.foldername(name))[1] = auth.uid()::text
);
