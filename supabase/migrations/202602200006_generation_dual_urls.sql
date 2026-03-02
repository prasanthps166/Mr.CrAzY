alter table public.generations
  add column if not exists generated_image_url_clean text,
  add column if not exists generated_image_url_watermarked text;

update public.generations
set generated_image_url_clean = coalesce(generated_image_url_clean, generated_image_url)
where generated_image_url is not null
  and generated_image_url_clean is null;

update public.generations
set generated_image_url_watermarked = coalesce(generated_image_url_watermarked, generated_image_url)
where generated_image_url is not null
  and generated_image_url_watermarked is null;
