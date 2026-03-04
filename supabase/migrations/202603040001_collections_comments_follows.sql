create extension if not exists "pgcrypto";

create table if not exists public.prompt_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.prompt_collection_items (
  collection_id uuid not null references public.prompt_collections(id) on delete cascade,
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (collection_id, prompt_id)
);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  comment_text text not null check (char_length(btrim(comment_text)) between 1 and 500),
  created_at timestamptz not null default now()
);

create table if not exists public.user_follows (
  follower_id uuid not null references public.users(id) on delete cascade,
  following_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint user_follows_not_self check (follower_id <> following_id)
);

create index if not exists idx_prompt_collections_user_created
  on public.prompt_collections (user_id, created_at desc);
create unique index if not exists ux_prompt_collections_user_name_norm
  on public.prompt_collections (user_id, lower(btrim(name)));
create unique index if not exists ux_prompt_collections_single_default
  on public.prompt_collections (user_id)
  where is_default = true;

create index if not exists idx_prompt_collection_items_prompt
  on public.prompt_collection_items (prompt_id);

create index if not exists idx_community_comments_post_created
  on public.community_comments (post_id, created_at desc);
create index if not exists idx_community_comments_user_created
  on public.community_comments (user_id, created_at desc);

create index if not exists idx_user_follows_following
  on public.user_follows (following_id);
create index if not exists idx_user_follows_created
  on public.user_follows (created_at desc);

alter table public.prompt_collections enable row level security;
alter table public.prompt_collection_items enable row level security;
alter table public.community_comments enable row level security;
alter table public.user_follows enable row level security;

drop policy if exists "Users can read own prompt collections" on public.prompt_collections;
create policy "Users can read own prompt collections"
on public.prompt_collections
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can create own prompt collections" on public.prompt_collections;
create policy "Users can create own prompt collections"
on public.prompt_collections
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own prompt collections" on public.prompt_collections;
create policy "Users can update own prompt collections"
on public.prompt_collections
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own non-default prompt collections" on public.prompt_collections;
create policy "Users can delete own non-default prompt collections"
on public.prompt_collections
for delete
to authenticated
using (auth.uid() = user_id and is_default = false);

drop policy if exists "Users can read own saved prompt items" on public.prompt_collection_items;
create policy "Users can read own saved prompt items"
on public.prompt_collection_items
for select
to authenticated
using (
  exists (
    select 1
    from public.prompt_collections collections
    where collections.id = prompt_collection_items.collection_id
      and collections.user_id = auth.uid()
  )
);

drop policy if exists "Users can add own saved prompt items" on public.prompt_collection_items;
create policy "Users can add own saved prompt items"
on public.prompt_collection_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.prompt_collections collections
    where collections.id = prompt_collection_items.collection_id
      and collections.user_id = auth.uid()
  )
);

drop policy if exists "Users can remove own saved prompt items" on public.prompt_collection_items;
create policy "Users can remove own saved prompt items"
on public.prompt_collection_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.prompt_collections collections
    where collections.id = prompt_collection_items.collection_id
      and collections.user_id = auth.uid()
  )
);

drop policy if exists "Community comments are publicly readable" on public.community_comments;
create policy "Community comments are publicly readable"
on public.community_comments
for select
using (true);

drop policy if exists "Users can create own community comments" on public.community_comments;
create policy "Users can create own community comments"
on public.community_comments
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own community comments" on public.community_comments;
create policy "Users can update own community comments"
on public.community_comments
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own community comments" on public.community_comments;
create policy "Users can delete own community comments"
on public.community_comments
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "User follows are publicly readable" on public.user_follows;
create policy "User follows are publicly readable"
on public.user_follows
for select
using (true);

drop policy if exists "Users can follow from own account" on public.user_follows;
create policy "Users can follow from own account"
on public.user_follows
for insert
to authenticated
with check (auth.uid() = follower_id and follower_id <> following_id);

drop policy if exists "Users can unfollow from own account" on public.user_follows;
create policy "Users can unfollow from own account"
on public.user_follows
for delete
to authenticated
using (auth.uid() = follower_id);
