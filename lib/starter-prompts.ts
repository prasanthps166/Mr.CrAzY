import { Prompt } from "@/types";

export const STARTER_PROMPTS: Prompt[] = [
  {
    id: "7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c101",
    title: "Studio Ghibli Anime",
    description: "Transform portraits into warm hand-painted Miyazaki-inspired scenes.",
    prompt_text:
      "masterpiece anime frame, studio ghibli inspired art direction, soft watercolor shading, luminous ambient light, expressive eyes, cinematic composition, rich natural background, highly detailed line art, clean face structure, gentle color palette, keep original subject identity and pose, img2img transformation, avoid text and logo",
    category: "Anime",
    example_image_url:
      "https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=1200&q=80",
    tags: ["anime", "ghibli", "cinematic", "portrait"],
    is_featured: true,
    use_count: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: "7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c102",
    title: "Oil Painting Master",
    description: "Convert photos to dramatic museum-style oil paintings.",
    prompt_text:
      "classical oil painting on linen canvas, visible brushwork, rich impasto texture, old master lighting, warm skin tones, dramatic chiaroscuro, painterly detail, natural proportions, preserve subject likeness, high dynamic range paint strokes, subtle varnish glow, no modern artifacts, no watermark",
    category: "Art",
    example_image_url:
      "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=1200&q=80",
    tags: ["oil painting", "fine art", "portrait", "classic"],
    is_featured: true,
    use_count: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: "7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c103",
    title: "Cyberpunk City",
    description: "Give images a futuristic neon cyberpunk atmosphere.",
    prompt_text:
      "cyberpunk megacity aesthetic, neon magenta and cyan lighting, rainy night reflections, volumetric fog, holographic billboards, high contrast cinematic grade, ultra detailed textures, urban depth, preserve person and perspective from source image, stylized but realistic anatomy, no text overlays",
    category: "Fantasy",
    example_image_url:
      "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1200&q=80",
    tags: ["cyberpunk", "neon", "city", "night"],
    is_featured: true,
    use_count: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: "7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c104",
    title: "Vintage 1970s Film",
    description: "Apply nostalgic grain and analog color shifts.",
    prompt_text:
      "1970s analog film photo look, kodak film grain, slightly faded colors, warm highlights, soft contrast, subtle lens bloom, realistic skin texture, natural motion blur feeling, preserve composition and identity, cinematic candid framing, no digital oversharpening, no text",
    category: "Vintage",
    example_image_url:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=80",
    tags: ["vintage", "film", "retro", "grain"],
    is_featured: true,
    use_count: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: "7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c105",
    title: "Fantasy Portrait",
    description: "Turn portraits into epic character concept art.",
    prompt_text:
      "epic fantasy character portrait, ornate costume details, cinematic rim lighting, mystical particles, painterly realism, detailed hair and fabric, heroic expression, high resolution concept art quality, preserve face geometry and pose, dramatic depth of field, no deformed hands, no text",
    category: "Fantasy",
    example_image_url:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80",
    tags: ["fantasy", "portrait", "cinematic", "concept art"],
    is_featured: true,
    use_count: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: "7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c106",
    title: "Watercolor Dream",
    description: "Soft watercolor wash style with dreamy tones.",
    prompt_text:
      "delicate watercolor illustration, bleeding pigment edges, pastel tonal harmony, textured watercolor paper, airy brush diffusion, soft highlights, clean silhouette preservation, keep subject identity, artistic hand-painted finish, no harsh outlines, no typography",
    category: "Art",
    example_image_url:
      "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?auto=format&fit=crop&w=1200&q=80",
    tags: ["watercolor", "soft", "dreamy", "painting"],
    is_featured: true,
    use_count: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: "7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c107",
    title: "Comic Book Hero",
    description: "Punchy comic-book ink and halftone shading.",
    prompt_text:
      "dynamic comic book illustration, bold ink outlines, halftone shadow dots, vivid primary colors, dramatic action lighting, graphic novel style composition, preserve facial likeness and body pose, crisp edges, high detail panel-ready artwork, no speech bubbles, no text",
    category: "Cartoon",
    example_image_url:
      "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=1200&q=80",
    tags: ["comic", "hero", "illustration", "bold"],
    is_featured: false,
    use_count: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: "7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c108",
    title: "Neon Noir",
    description: "Moody noir scene with vibrant neon accents.",
    prompt_text:
      "neo-noir portrait style, deep shadows, selective neon highlights, wet pavement reflections, atmospheric smoke, cinematic grading, dramatic facial key light, preserve subject identity and framing, realistic anatomy, high-detail texture, no logo, no text",
    category: "Realistic",
    example_image_url:
      "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1200&q=80",
    tags: ["noir", "neon", "cinematic", "moody"],
    is_featured: false,
    use_count: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: "7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c109",
    title: "Renaissance Portrait",
    description: "Classic old-world portrait with rich painterly tones.",
    prompt_text:
      "renaissance portrait painting, sfumato blending, elegant costume details, warm candlelit chiaroscuro, museum-grade fine art look, realistic eyes and skin, preserve source identity and expression, ornate background, high painterly fidelity, no modern objects, no text",
    category: "Portrait",
    example_image_url:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=80",
    tags: ["renaissance", "classical", "portrait", "fine art"],
    is_featured: false,
    use_count: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: "7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c110",
    title: "Pixar Character",
    description: "Friendly 3D animation look with cinematic polish.",
    prompt_text:
      "stylized 3d animated character, family-film aesthetic, soft global illumination, detailed skin and hair shading, expressive eyes, polished render quality, preserve subject identity and pose, colorful storytelling background, clean geometry, no text, no watermark",
    category: "Cartoon",
    example_image_url:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=1200&q=80",
    tags: ["3d", "animation", "character", "pixar-style"],
    is_featured: false,
    use_count: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: "7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c111",
    title: "Sketch Artist",
    description: "Detailed graphite hand-drawn sketch conversion.",
    prompt_text:
      "graphite pencil sketch, cross-hatching details, realistic shading gradients, textured paper grain, artist studio drawing style, keep facial proportions and source composition, monochrome elegance, high precision line work, no color bleed, no typography",
    category: "Art",
    example_image_url:
      "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?auto=format&fit=crop&w=1200&q=80",
    tags: ["sketch", "graphite", "drawing", "monochrome"],
    is_featured: false,
    use_count: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: "7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c112",
    title: "Vaporwave Aesthetic",
    description: "Dreamy pastel neon with retro-futurist mood.",
    prompt_text:
      "vaporwave visual style, pastel pink and cyan palette, sunset gradient sky, retro digital glow, surreal geometric accents, glossy highlights, preserve person and camera angle from source, high aesthetic coherence, clean output, no readable text",
    category: "Fantasy",
    example_image_url:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
    tags: ["vaporwave", "retro", "pastel", "neon"],
    is_featured: false,
    use_count: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: "7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c113",
    title: "Dark Fantasy",
    description: "Gothic dark-world transformation with rich atmosphere.",
    prompt_text:
      "dark fantasy artwork, gothic architecture backdrop, dramatic mist, moonlit rim light, textured armor and fabric, haunting cinematic mood, preserve identity and posture from source image, hyper-detailed fantasy painting quality, no gore, no text",
    category: "Fantasy",
    example_image_url:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
    tags: ["dark fantasy", "gothic", "epic", "moody"],
    is_featured: false,
    use_count: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: "7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c114",
    title: "Product Photography",
    description: "Professional clean white-background product style.",
    prompt_text:
      "premium ecommerce product photography, seamless white backdrop, softbox studio lighting, realistic shadows and reflections, sharp focus, color accuracy, preserve object geometry and branding shape, high-detail catalog quality, no clutter, no text overlays",
    category: "Product",
    example_image_url:
      "https://images.unsplash.com/photo-1585386959984-a4155224a1ad?auto=format&fit=crop&w=1200&q=80",
    tags: ["product", "studio", "ecommerce", "clean"],
    is_featured: false,
    use_count: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: "7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c115",
    title: "Impressionist Painting",
    description: "Monet-inspired brushy color impression.",
    prompt_text:
      "impressionist painting style, broken color brush strokes, luminous daylight palette, soft atmospheric depth, plein air feeling, painterly motion, preserve composition and subject silhouette, rich artistic texture, museum-quality finish, no text",
    category: "Art",
    example_image_url:
      "https://images.unsplash.com/photo-1511884642898-4c92249e20b6?auto=format&fit=crop&w=1200&q=80",
    tags: ["impressionist", "monet", "painting", "fine art"],
    is_featured: false,
    use_count: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: "7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c116",
    title: "Sticker Art",
    description: "Cute flat sticker-pack illustration style.",
    prompt_text:
      "cute sticker illustration style, clean vector-like outlines, pastel palette, glossy sticker finish, simplified shapes, playful expression, keep recognizable subject identity, transparent-style background feel, crisp edges, no typography, no watermark",
    category: "Cartoon",
    example_image_url:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80",
    tags: ["sticker", "cute", "illustration", "flat"],
    is_featured: false,
    use_count: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: "7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c117",
    title: "Cinematic Movie Still",
    description: "Give photos blockbuster film-grade color and lighting.",
    prompt_text:
      "cinematic movie still, anamorphic lens flare, teal-orange color grade, dramatic key and fill lighting, ultra realistic detail, shallow depth of field, preserve identity and framing, professional post-production look, no text, no logo",
    category: "Realistic",
    example_image_url:
      "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=1200&q=80",
    tags: ["cinematic", "movie", "color grade", "realistic"],
    is_featured: false,
    use_count: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: "7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c118",
    title: "Low Poly Art",
    description: "Convert subjects into geometric low-poly 3D render.",
    prompt_text:
      "low poly 3d art style, geometric facets, clean triangulated surfaces, ambient occlusion shading, stylized color blocks, preserve original pose and silhouette, modern digital sculpture look, sharp edges, high detail composition, no text",
    category: "Architecture",
    example_image_url:
      "https://images.unsplash.com/photo-1460574283810-2aab119d8511?auto=format&fit=crop&w=1200&q=80",
    tags: ["low poly", "geometric", "3d", "stylized"],
    is_featured: false,
    use_count: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: "7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c119",
    title: "Retro Pixel Art",
    description: "16-bit game style with chunky pixel shading.",
    prompt_text:
      "retro 16-bit pixel art style, limited color palette, crisp pixel edges, sprite-like shading, nostalgic arcade look, preserve subject silhouette and key facial cues, balanced dithering, clean background, no modern blur, no text",
    category: "Cartoon",
    example_image_url:
      "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80",
    tags: ["pixel art", "retro", "16-bit", "game"],
    is_featured: false,
    use_count: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: "7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c120",
    title: "Magazine Cover",
    description: "Editorial high-fashion cover style transformation.",
    prompt_text:
      "editorial magazine cover photography style, high-fashion lighting, premium skin retouch feel, bold composition, studio backdrop, couture mood, preserve facial identity and pose, ultra clean detail, photoreal finish, no readable text or logo",
    category: "Portrait",
    example_image_url:
      "https://images.unsplash.com/photo-1552374196-c4e7ffc6e126?auto=format&fit=crop&w=1200&q=80",
    tags: ["editorial", "fashion", "magazine", "portrait"],
    is_featured: false,
    use_count: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: "7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c141",
    title: "Action Figure Blister Pack",
    description: "Turn portraits into collectible toy packaging style cards.",
    prompt_text:
      "collectible action figure blister pack concept, transparent toy box shell, branded hobby-store shelf look, studio product lighting, highly detailed miniature likeness, preserve face identity and outfit colors, polished plastic reflections, premium packaging design aesthetic, no readable logo text",
    category: "Cartoon",
    example_image_url:
      "https://images.unsplash.com/photo-1514066558159-fc8c737ef259?auto=format&fit=crop&w=1200&q=80",
    tags: ["action figure", "toy box", "collector", "2025 trend"],
    is_featured: true,
    use_count: 412,
    created_at: "2025-04-12T00:00:00.000Z",
  },
  {
    id: "7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c142",
    title: "Barbie Box Portrait",
    description: "Famous doll-box aesthetic with polished pink studio styling.",
    prompt_text:
      "doll box portrait style, polished toy packaging layout, glossy pink and pastel palette, high-key studio lighting, clean retail shelf composition, preserve facial likeness and pose, smooth plastic-inspired finish, beauty campaign quality, no readable text",
    category: "Cartoon",
    example_image_url:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80",
    tags: ["barbie style", "doll box", "pink aesthetic", "viral"],
    is_featured: true,
    use_count: 365,
    created_at: "2025-04-20T00:00:00.000Z",
  },
  {
    id: "7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c143",
    title: "Mini Figurine Diorama",
    description: "Nano-figure trend with handcrafted diorama environment.",
    prompt_text:
      "miniature figurine portrait in handcrafted diorama scene, tiny scale realism, macro lens depth, textured model environment, warm softbox lighting, preserve recognizable face traits, stylized toy-grade sculpt details, high-detail collectible render, no logo text",
    category: "Art",
    example_image_url:
      "https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1200&q=80",
    tags: ["miniature", "diorama", "figurine", "nano trend"],
    is_featured: true,
    use_count: 338,
    created_at: "2025-09-01T00:00:00.000Z",
  },
  {
    id: "7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c144",
    title: "LinkedIn Pro Headshot",
    description: "Trending professional profile-photo enhancement look.",
    prompt_text:
      "professional linkedin headshot style, clean neutral background, flattering key and fill lighting, realistic skin texture, natural confidence expression, tailored wardrobe refinement, preserve exact face identity, premium corporate portrait polish, no over-smoothing, no text",
    category: "Portrait",
    example_image_url:
      "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=1200&q=80",
    tags: ["linkedin", "headshot", "professional", "career"],
    is_featured: true,
    use_count: 327,
    created_at: "2025-06-10T00:00:00.000Z",
  },
  {
    id: "7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c145",
    title: "Passport to Studio Portrait",
    description: "Viral before-after style from plain passport to premium studio shot.",
    prompt_text:
      "passport photo to studio portrait transformation, natural skin detail, clean backdrop gradient, soft cinematic lighting, realistic hair cleanup, preserve exact identity and proportions, premium DSLR look, subtle color grading, no watermark or text",
    category: "Portrait",
    example_image_url:
      "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=1200&q=80",
    tags: ["passport glow-up", "studio", "portrait", "before after"],
    is_featured: true,
    use_count: 295,
    created_at: "2025-07-03T00:00:00.000Z",
  },
  {
    id: "7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c146",
    title: "90s Yearbook Throwback",
    description: "Retro school-photo trend with classic film grain and backdrop.",
    prompt_text:
      "1990s yearbook portrait style, retro school backdrop, flash-lit studio look, soft grain texture, nostalgic color cast, preserve face identity and expression, subtle analog imperfections, authentic yearbook composition, no text",
    category: "Vintage",
    example_image_url:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80",
    tags: ["90s", "yearbook", "retro", "nostalgia"],
    is_featured: true,
    use_count: 281,
    created_at: "2025-08-15T00:00:00.000Z",
  },
  {
    id: "7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c147",
    title: "LEGO Minifigure Avatar",
    description: "Blocky toy-avatar aesthetic inspired by minifigure design.",
    prompt_text:
      "lego-style minifigure portrait transformation, blocky toy proportions, plastic material shading, playful construction-set palette, studio toy-photography lighting, preserve key identity markers, crisp clean edges, collectible figurine presentation, no text",
    category: "Cartoon",
    example_image_url:
      "https://images.unsplash.com/photo-1472457974886-0ebcd59440cc?auto=format&fit=crop&w=1200&q=80",
    tags: ["lego style", "minifigure", "toy", "avatar"],
    is_featured: false,
    use_count: 274,
    created_at: "2025-04-08T00:00:00.000Z",
  },
  {
    id: "7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c148",
    title: "Claymation Character",
    description: "Stop-motion clay character trend with handcrafted textures.",
    prompt_text:
      "claymation portrait style, hand-sculpted clay texture, stop-motion film lighting, soft miniature set background, slightly imperfect artisanal details, preserve identity and expression, whimsical family-film mood, high-detail clay render, no text",
    category: "Cartoon",
    example_image_url:
      "https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=1200&q=80",
    tags: ["claymation", "stop motion", "character", "viral style"],
    is_featured: false,
    use_count: 261,
    created_at: "2025-05-27T00:00:00.000Z",
  },
  {
    id: "7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c149",
    title: "Neon Drift Street Portrait",
    description: "Night city drift vibe with high-contrast neon mood.",
    prompt_text:
      "night street neon drift aesthetic, electric cyan and magenta rim lights, wet asphalt reflections, motion energy blur accents, cinematic urban depth, preserve face identity and pose, high-contrast commercial color grade, no text overlay",
    category: "Cyberpunk",
    example_image_url:
      "https://images.unsplash.com/photo-1516726817505-f5ed825624d8?auto=format&fit=crop&w=1200&q=80",
    tags: ["neon", "street", "cyberpunk", "reel trend"],
    is_featured: false,
    use_count: 249,
    created_at: "2025-10-04T00:00:00.000Z",
  },
  {
    id: "7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c150",
    title: "Anime Sky Dreamscape",
    description: "Shinkai-like sky glow and atmospheric anime cinematic style.",
    prompt_text:
      "cinematic anime portrait with luminous sky backdrop, dramatic cloud lighting, clean cel-shaded linework, dreamy color gradients, emotional storytelling mood, preserve exact face identity and pose, high-detail anime finish, no subtitle text",
    category: "Anime",
    example_image_url:
      "https://images.unsplash.com/photo-1516569422868-5c2f58f2f942?auto=format&fit=crop&w=1200&q=80",
    tags: ["anime", "sky", "cinematic", "dreamscape"],
    is_featured: false,
    use_count: 236,
    created_at: "2025-11-09T00:00:00.000Z",
  },
  {
    id: "7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c151",
    title: "RPG Character Card",
    description: "Gaming profile-card trend with fantasy class styling.",
    prompt_text:
      "fantasy rpg character card portrait style, legendary class armor details, magical particle ambience, dramatic key light, cinematic game UI framing feel, preserve recognizable identity and facial geometry, ultra-detailed concept art polish, no readable text",
    category: "Fantasy",
    example_image_url:
      "https://images.unsplash.com/photo-1511884642898-4c92249e20b6?auto=format&fit=crop&w=1200&q=80",
    tags: ["rpg", "character card", "fantasy", "gaming"],
    is_featured: false,
    use_count: 223,
    created_at: "2025-12-18T00:00:00.000Z",
  },
  {
    id: "7c9b0d3e-87ab-43f6-9fcb-1d3cf3e1c152",
    title: "Streetwear Lookbook Editorial",
    description: "Creator-friendly fashion lookbook style used in recent reels.",
    prompt_text:
      "streetwear editorial portrait, urban fashion campaign lighting, premium texture retention on fabric, soft contrast background, dynamic model stance, preserve true face identity and body proportions, magazine-grade color grading, clean commercial finish, no text",
    category: "Portrait",
    example_image_url:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80",
    tags: ["streetwear", "editorial", "lookbook", "fashion"],
    is_featured: false,
    use_count: 214,
    created_at: "2026-01-22T00:00:00.000Z",
  },
];
