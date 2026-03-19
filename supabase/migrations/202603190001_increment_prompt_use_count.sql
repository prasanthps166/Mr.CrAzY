create or replace function public.increment_prompt_use_count(prompt_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.prompts
  set use_count = coalesce(use_count, 0) + 1
  where id = prompt_id_input;
end;
$$;
