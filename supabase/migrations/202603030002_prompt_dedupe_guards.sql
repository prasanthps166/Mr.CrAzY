-- Prompt dedupe guardrails:
-- 1) remove existing duplicates by normalized title + category
-- 2) remove exact prompt-text duplicates inside the same category
-- 3) enforce unique indexes to prevent future duplicates

with ranked as (
  select
    id,
    row_number() over (
      partition by lower(trim(title)), lower(trim(category))
      order by is_featured desc, use_count desc, created_at desc, id asc
    ) as row_rank
  from public.prompts
)
delete from public.prompts as p
using ranked
where p.id = ranked.id
  and ranked.row_rank > 1;

with ranked as (
  select
    id,
    row_number() over (
      partition by
        lower(trim(category)),
        md5(regexp_replace(lower(trim(prompt_text)), '\s+', ' ', 'g'))
      order by is_featured desc, use_count desc, created_at desc, id asc
    ) as row_rank
  from public.prompts
)
delete from public.prompts as p
using ranked
where p.id = ranked.id
  and ranked.row_rank > 1;

create unique index if not exists ux_prompts_title_category_norm
  on public.prompts ((lower(trim(title))), (lower(trim(category))));

create unique index if not exists ux_prompts_prompt_text_category_norm
  on public.prompts (
    (md5(regexp_replace(lower(trim(prompt_text)), '\s+', ' ', 'g'))),
    (lower(trim(category)))
  );
