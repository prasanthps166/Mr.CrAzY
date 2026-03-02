-- Add famous/trending prompts from the last year (Feb 2025 - Feb 2026)
insert into public.prompts (
  id,
  title,
  description,
  prompt_text,
  category,
  example_image_url,
  tags,
  is_featured,
  use_count,
  created_at
)
values
(
  '7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c141',
  'Action Figure Blister Pack',
  'Turn portraits into collectible toy packaging style cards.',
  $$collectible action figure blister pack concept, transparent toy box shell, branded hobby-store shelf look, studio product lighting, highly detailed miniature likeness, preserve face identity and outfit colors, polished plastic reflections, premium packaging design aesthetic, no readable logo text$$,
  'Cartoon',
  'https://images.unsplash.com/photo-1514066558159-fc8c737ef259?auto=format&fit=crop&w=1200&q=80',
  array['action figure', 'toy box', 'collector', '2025 trend'],
  true,
  412,
  '2025-04-12T00:00:00.000Z'
),
(
  '7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c142',
  'Barbie Box Portrait',
  'Famous doll-box aesthetic with polished pink studio styling.',
  $$doll box portrait style, polished toy packaging layout, glossy pink and pastel palette, high-key studio lighting, clean retail shelf composition, preserve facial likeness and pose, smooth plastic-inspired finish, beauty campaign quality, no readable text$$,
  'Cartoon',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80',
  array['barbie style', 'doll box', 'pink aesthetic', 'viral'],
  true,
  365,
  '2025-04-20T00:00:00.000Z'
),
(
  '7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c143',
  'Mini Figurine Diorama',
  'Nano-figure trend with handcrafted diorama environment.',
  $$miniature figurine portrait in handcrafted diorama scene, tiny scale realism, macro lens depth, textured model environment, warm softbox lighting, preserve recognizable face traits, stylized toy-grade sculpt details, high-detail collectible render, no logo text$$,
  'Art',
  'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1200&q=80',
  array['miniature', 'diorama', 'figurine', 'nano trend'],
  true,
  338,
  '2025-09-01T00:00:00.000Z'
),
(
  '7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c144',
  'LinkedIn Pro Headshot',
  'Trending professional profile-photo enhancement look.',
  $$professional linkedin headshot style, clean neutral background, flattering key and fill lighting, realistic skin texture, natural confidence expression, tailored wardrobe refinement, preserve exact face identity, premium corporate portrait polish, no over-smoothing, no text$$,
  'Portrait',
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=1200&q=80',
  array['linkedin', 'headshot', 'professional', 'career'],
  true,
  327,
  '2025-06-10T00:00:00.000Z'
),
(
  '7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c145',
  'Passport to Studio Portrait',
  'Viral before-after style from plain passport to premium studio shot.',
  $$passport photo to studio portrait transformation, natural skin detail, clean backdrop gradient, soft cinematic lighting, realistic hair cleanup, preserve exact identity and proportions, premium DSLR look, subtle color grading, no watermark or text$$,
  'Portrait',
  'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=1200&q=80',
  array['passport glow-up', 'studio', 'portrait', 'before after'],
  true,
  295,
  '2025-07-03T00:00:00.000Z'
),
(
  '7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c146',
  '90s Yearbook Throwback',
  'Retro school-photo trend with classic film grain and backdrop.',
  $$1990s yearbook portrait style, retro school backdrop, flash-lit studio look, soft grain texture, nostalgic color cast, preserve face identity and expression, subtle analog imperfections, authentic yearbook composition, no text$$,
  'Vintage',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80',
  array['90s', 'yearbook', 'retro', 'nostalgia'],
  true,
  281,
  '2025-08-15T00:00:00.000Z'
),
(
  '7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c147',
  'LEGO Minifigure Avatar',
  'Blocky toy-avatar aesthetic inspired by minifigure design.',
  $$lego-style minifigure portrait transformation, blocky toy proportions, plastic material shading, playful construction-set palette, studio toy-photography lighting, preserve key identity markers, crisp clean edges, collectible figurine presentation, no text$$,
  'Cartoon',
  'https://images.unsplash.com/photo-1472457974886-0ebcd59440cc?auto=format&fit=crop&w=1200&q=80',
  array['lego style', 'minifigure', 'toy', 'avatar'],
  false,
  274,
  '2025-04-08T00:00:00.000Z'
),
(
  '7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c148',
  'Claymation Character',
  'Stop-motion clay character trend with handcrafted textures.',
  $$claymation portrait style, hand-sculpted clay texture, stop-motion film lighting, soft miniature set background, slightly imperfect artisanal details, preserve identity and expression, whimsical family-film mood, high-detail clay render, no text$$,
  'Cartoon',
  'https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=1200&q=80',
  array['claymation', 'stop motion', 'character', 'viral style'],
  false,
  261,
  '2025-05-27T00:00:00.000Z'
),
(
  '7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c149',
  'Neon Drift Street Portrait',
  'Night city drift vibe with high-contrast neon mood.',
  $$night street neon drift aesthetic, electric cyan and magenta rim lights, wet asphalt reflections, motion energy blur accents, cinematic urban depth, preserve face identity and pose, high-contrast commercial color grade, no text overlay$$,
  'Cyberpunk',
  'https://images.unsplash.com/photo-1516726817505-f5ed825624d8?auto=format&fit=crop&w=1200&q=80',
  array['neon', 'street', 'cyberpunk', 'reel trend'],
  false,
  249,
  '2025-10-04T00:00:00.000Z'
),
(
  '7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c150',
  'Anime Sky Dreamscape',
  'Shinkai-like sky glow and atmospheric anime cinematic style.',
  $$cinematic anime portrait with luminous sky backdrop, dramatic cloud lighting, clean cel-shaded linework, dreamy color gradients, emotional storytelling mood, preserve exact face identity and pose, high-detail anime finish, no subtitle text$$,
  'Anime',
  'https://images.unsplash.com/photo-1516569422868-5c2f58f2f942?auto=format&fit=crop&w=1200&q=80',
  array['anime', 'sky', 'cinematic', 'dreamscape'],
  false,
  236,
  '2025-11-09T00:00:00.000Z'
),
(
  '7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c151',
  'RPG Character Card',
  'Gaming profile-card trend with fantasy class styling.',
  $$fantasy rpg character card portrait style, legendary class armor details, magical particle ambience, dramatic key light, cinematic game UI framing feel, preserve recognizable identity and facial geometry, ultra-detailed concept art polish, no readable text$$,
  'Fantasy',
  'https://images.unsplash.com/photo-1511884642898-4c92249e20b6?auto=format&fit=crop&w=1200&q=80',
  array['rpg', 'character card', 'fantasy', 'gaming'],
  false,
  223,
  '2025-12-18T00:00:00.000Z'
),
(
  '7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c152',
  'Streetwear Lookbook Editorial',
  'Creator-friendly fashion lookbook style used in recent reels.',
  $$streetwear editorial portrait, urban fashion campaign lighting, premium texture retention on fabric, soft contrast background, dynamic model stance, preserve true face identity and body proportions, magazine-grade color grading, clean commercial finish, no text$$,
  'Portrait',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80',
  array['streetwear', 'editorial', 'lookbook', 'fashion'],
  false,
  214,
  '2026-01-22T00:00:00.000Z'
)
on conflict (id) do update
set
  title = excluded.title,
  description = excluded.description,
  prompt_text = excluded.prompt_text,
  category = excluded.category,
  example_image_url = excluded.example_image_url,
  tags = excluded.tags,
  is_featured = excluded.is_featured,
  use_count = excluded.use_count,
  created_at = excluded.created_at;
