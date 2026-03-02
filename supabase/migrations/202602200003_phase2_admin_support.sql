alter table public.users
  add column if not exists is_suspended boolean not null default false;

alter table public.users
  add column if not exists welcome_email_sent_at timestamptz;

create index if not exists idx_users_is_suspended on public.users (is_suspended);
