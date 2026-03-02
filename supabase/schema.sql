-- PromptGallery schema
-- Run in Supabase SQL editor before starting the app.

create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  avatar_url text,
  credits integer not null default 5 check (credits >= 0),
  is_pro boolean not null default false,
  credits_reset_at timestamptz not null default now(),
  stripe_customer_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.prompts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  prompt_text text not null,
  category text not null,
  example_image_url text not null,
  tags text[] not null default '{}',
  is_featured boolean not null default false,
  use_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  prompt_id uuid not null references public.prompts(id) on delete restrict,
  original_image_url text not null,
  generated_image_url text not null,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null unique references public.generations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  likes integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_prompts_category on public.prompts (category);
create index if not exists idx_prompts_use_count on public.prompts (use_count desc);
create index if not exists idx_generations_user_id on public.generations (user_id);
create index if not exists idx_generations_prompt_id on public.generations (prompt_id);
create index if not exists idx_generations_public on public.generations (is_public);
create index if not exists idx_community_posts_likes on public.community_posts (likes desc);
create index if not exists idx_community_posts_created on public.community_posts (created_at desc);

alter table public.users enable row level security;
alter table public.prompts enable row level security;
alter table public.generations enable row level security;
alter table public.community_posts enable row level security;

drop policy if exists "Users can read public profile fields" on public.users;
create policy "Users can read public profile fields"
on public.users
for select
using (true);

drop policy if exists "Users can insert own profile" on public.users;
create policy "Users can insert own profile"
on public.users
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.users;
create policy "Users can update own profile"
on public.users
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Prompts are readable by anyone" on public.prompts;
create policy "Prompts are readable by anyone"
on public.prompts
for select
using (true);

drop policy if exists "Authenticated users can increment use_count" on public.prompts;
create policy "Authenticated users can increment use_count"
on public.prompts
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Users can read own or public generations" on public.generations;
create policy "Users can read own or public generations"
on public.generations
for select
using (is_public = true or auth.uid() = user_id);

drop policy if exists "Users can insert own generations" on public.generations;
create policy "Users can insert own generations"
on public.generations
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own generations" on public.generations;
create policy "Users can update own generations"
on public.generations
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Community posts are readable by anyone" on public.community_posts;
create policy "Community posts are readable by anyone"
on public.community_posts
for select
using (true);

drop policy if exists "Users can create own community posts" on public.community_posts;
create policy "Users can create own community posts"
on public.community_posts
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Authenticated users can like posts" on public.community_posts;
create policy "Authenticated users can like posts"
on public.community_posts
for update
to authenticated
using (true)
with check (true);

-- Storage buckets for source and generated images.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('originals', 'originals', true, 10485760, array['image/png', 'image/jpeg', 'image/webp']),
  ('generated', 'generated', true, 20971520, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "Users can upload originals" on storage.objects;
create policy "Users can upload originals"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'originals' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can read own originals" on storage.objects;
create policy "Users can read own originals"
on storage.objects
for select
to authenticated
using (bucket_id = 'originals' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Anyone can read originals images" on storage.objects;
create policy "Anyone can read originals images"
on storage.objects
for select
using (bucket_id = 'originals');

drop policy if exists "Anyone can read generated images" on storage.objects;
create policy "Anyone can read generated images"
on storage.objects
for select
using (bucket_id = 'generated');

drop policy if exists "Authenticated users can upload generated images" on storage.objects;
create policy "Authenticated users can upload generated images"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'generated');

-- Sync auth.users into public.users table automatically.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.users.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.users.avatar_url);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
