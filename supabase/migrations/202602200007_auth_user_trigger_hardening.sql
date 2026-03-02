-- Allow phone-only accounts (OTP) where email can be null.
alter table public.users
  alter column email drop not null;

-- Harden auth -> public.users sync to avoid blocking signups.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  referral_code_used text;
  referrer uuid;
  generated_referral_code text;
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
      and id <> new.id
    limit 1;
  end if;

  generated_referral_code := coalesce(
    nullif(upper(new.raw_user_meta_data->>'referral_code'), ''),
    public.generate_referral_code()
  );

  insert into public.users (id, email, phone, full_name, avatar_url, referral_code)
  values (
    new.id,
    new.email,
    coalesce(new.phone, new.raw_user_meta_data->>'phone'),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    generated_referral_code
  )
  on conflict (id) do update
  set
    email = coalesce(excluded.email, public.users.email),
    phone = coalesce(excluded.phone, public.users.phone),
    full_name = coalesce(excluded.full_name, public.users.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.users.avatar_url),
    referral_code = coalesce(public.users.referral_code, excluded.referral_code);

  if referrer is not null then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'users'
        and column_name = 'referred_by_user_id'
    ) then
      execute
        'update public.users set referred_by_user_id = coalesce(referred_by_user_id, $1) where id = $2'
      using referrer, new.id;
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'users'
        and column_name = 'referred_by'
    ) then
      execute
        'update public.users set referred_by = coalesce(referred_by, $1) where id = $2'
      using referrer, new.id;
    end if;

    if exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = 'referrals'
    ) then
      insert into public.referrals (referrer_id, referred_id, reward_credited)
      values (referrer, new.id, false)
      on conflict (referred_id) do nothing;
    end if;
  end if;

  return new;
exception
  when others then
    -- Keep auth signup resilient; app bootstrap will upsert profile on first request.
    raise log 'handle_new_user failed for user %, reason: %', new.id, sqlerrm;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
