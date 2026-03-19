alter table public.prompts
  add column if not exists search_document tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(category, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(tags, ' '), '')), 'C')
  ) stored;

create index if not exists idx_prompts_search_document
  on public.prompts
  using gin (search_document);

create or replace function public.search_public_prompts(
  category_input text default 'All',
  search_input text default '',
  sort_input text default 'trending',
  featured_only_input boolean default false,
  limit_input integer default 60,
  tag_input text default ''
)
returns table (
  id uuid,
  title text,
  description text,
  prompt_text text,
  category text,
  example_image_url text,
  tags text[],
  is_featured boolean,
  is_sponsored boolean,
  sponsor_name text,
  sponsor_logo_url text,
  use_count integer,
  created_at timestamptz
)
language sql
stable
set search_path = public
as $$
  with raw_params as (
    select
      nullif(btrim(category_input), '') as category_filter,
      nullif(btrim(search_input), '') as search_filter,
      nullif(lower(btrim(tag_input)), '') as tag_filter,
      greatest(1, least(coalesce(limit_input, 60), 180)) as limit_value,
      case
        when sort_input in ('newest', 'most_used', 'trending') then sort_input
        else 'trending'
      end as sort_key
  ),
  params as (
    select
      category_filter,
      search_filter,
      tag_filter,
      limit_value,
      sort_key,
      case
        when search_filter is null then null::tsquery
        else websearch_to_tsquery('simple', search_filter)
      end as search_query
    from raw_params
  ),
  ranked as (
    select
      p.*,
      case
        when params.search_query is null then 0::real
        else ts_rank_cd(p.search_document, params.search_query)
      end as search_rank
    from public.prompts p
    cross join params
    where (params.category_filter is null or params.category_filter = 'All' or p.category = params.category_filter)
      and (not featured_only_input or p.is_featured)
      and (
        params.tag_filter is null
        or exists (
          select 1
          from unnest(coalesce(p.tags, '{}'::text[])) as prompt_tag
          where lower(btrim(prompt_tag)) = params.tag_filter
        )
      )
      and (
        params.search_query is null
        or p.search_document @@ params.search_query
      )
  )
  select
    ranked.id,
    ranked.title,
    ranked.description,
    ranked.prompt_text,
    ranked.category,
    ranked.example_image_url,
    ranked.tags,
    ranked.is_featured,
    ranked.is_sponsored,
    ranked.sponsor_name,
    ranked.sponsor_logo_url,
    ranked.use_count,
    ranked.created_at
  from ranked
  cross join params
  order by
    case when params.sort_key = 'trending' then ranked.search_rank end desc,
    case when params.sort_key = 'trending' then case when ranked.is_featured then 1 else 0 end end desc,
    case when params.sort_key = 'trending' then ranked.use_count end desc,
    case when params.sort_key = 'most_used' then ranked.use_count end desc,
    case when params.sort_key = 'newest' then extract(epoch from ranked.created_at) end desc,
    ranked.created_at desc
  limit (select limit_value from params);
$$;
