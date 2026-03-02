# PromptGallery

PromptGallery is a full-stack Next.js 14 app for AI-powered image transformation:
- Browse curated prompts
- Upload a photo and generate transformed output
- Share results to community
- Manage credits with an ads-first economy
- Optional Pro + credit packs via Razorpay (mock fallback supported)

## Stack
- Next.js 14 App Router + Tailwind CSS + shadcn-style UI components
- Supabase (Postgres + Auth + Storage)
- Replicate (FLUX + Stable Diffusion img2img)
- Ads-first credit system + optional Razorpay payments
- Sharp watermarking for free-tier outputs

## Local Setup
1. Install dependencies:
```bash
npm install
```

2. Copy env template and fill values:
```bash
cp .env.example .env.local
```

Required env vars:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `REPLICATE_API_TOKEN`
- `NEXT_PUBLIC_APP_URL`

Recommended billing mode vars:
- `BILLING_MODE` (`mock` by default; set to `stripe` to enable real Stripe)
- `NEXT_PUBLIC_BILLING_MODE` (match `BILLING_MODE` for pricing UI messaging)

Optional ads/payments vars:
- `NEXT_PUBLIC_ADSENSE_CLIENT_ID`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `NEXT_PUBLIC_RAZORPAY_KEY_ID`

Optional distributed rate limit vars:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

3. In Supabase SQL Editor, run:
- `supabase/schema.sql`
- `supabase/seed.sql`
- `supabase/migrations/*.sql` in filename order

If your project already exists and smoke tests fail with errors like
`column users.referral_code does not exist` or
`column users.stripe_subscription_id does not exist`,
re-run the migration files in order:
- `supabase/migrations/202602200001_phase2_marketplace.sql`
- `supabase/migrations/202602200002_phase2_analytics_referrals.sql`
- `supabase/migrations/202602200003_phase2_admin_support.sql`
- `supabase/migrations/202602200004_phase3_billing.sql`
- `supabase/migrations/202602200005_ads_first_india_plan.sql`
- `supabase/migrations/202602200006_generation_dual_urls.sql`
- `supabase/migrations/202602200007_auth_user_trigger_hardening.sql`
- `supabase/migrations/202602210001_last_year_trending_prompts.sql`

4. Run the app:
```bash
npm run dev
```

5. Open:
- `http://localhost:3000`

## Scripts
- `npm run dev` - start dev server
- `npm run lint` - lint checks
- `npm run test:run` - run unit tests
- `npm run check:guards` - verify API route auth/key guard conventions
- `npm run verify` - run lint + tests + guard checks + build + mobile typecheck
- `npm run build` - production build
- `npm run smoke:phase2` - Phase 2 marketplace/admin/analytics smoke run
- `npm run smoke:phase3` - Phase 3 billing/checkout/webhook smoke run

## Key Routes
- `/` landing page
- `/gallery` prompt gallery
- `/gallery/[id]` prompt details + community examples
- `/generate` generation page
- `/dashboard` user history + credits
- `/community` public feed
- `/pricing` plans and checkout
- `/login` / `/signup` auth

API:
- `POST /api/generate`
- `GET /api/credits`
- `POST /api/community/share`
- `POST /api/community/like`
- `POST /api/credits/watch-ad`
- `POST /api/credits/share`
- `POST /api/referral/complete`
- `POST /api/razorpay/create-order`
- `POST /api/razorpay/verify`
- `POST /api/v1/transform`
- `GET /api/v1/generation/[id]`
- `GET /api/v1/prompts`

## Notes
- Free users: 2 daily credits + rewarded ad credits + watermark.
- Pro users: unlimited, no watermark.
- Guest users: one trial generation via cookie gate.
- Rate limit on generation API: 10 requests/minute per user/IP key.
- Uses Upstash Redis for shared rate limiting when configured, with in-memory fallback.
- Billing switches by environment:
- Mock mode by default (`BILLING_MODE=mock`).
- Stripe mode only when `BILLING_MODE=stripe` and Stripe keys are set.

## Stripe Local Webhook Replay (Phase 3)
1. Start your local app:
```bash
npm run dev
```

Before replaying Stripe webhooks, ensure:
```bash
BILLING_MODE=stripe
NEXT_PUBLIC_BILLING_MODE=stripe
```

2. Start Stripe CLI listener and forward events:
```bash
stripe listen --forward-to http://localhost:3000/api/stripe/webhook
```
Copy the printed signing secret and set it in `.env.local` as:
```bash
STRIPE_WEBHOOK_SECRET=whsec_...
```

3. Trigger a real checkout from `/pricing` (using Stripe test mode card `4242 4242 4242 4242`) so your app receives:
- `checkout.session.completed`
- `invoice.paid` (for subscription renewals or subscription initial cycle)

4. Replay an already received event to validate idempotency:
```bash
stripe events resend evt_123 --forward-to http://localhost:3000/api/stripe/webhook
```

5. Run the Phase 3 smoke verification:
```bash
npm run smoke:phase3
```

## Mobile App (Expo Android)
The React Native app is in `mobile/` and is fully separate from Next.js `app/`.

### Mobile setup
1. Create env file:
```bash
cd mobile
cp .env.example .env
```

2. Fill env values:
- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` (required for paid marketplace checkout)

3. Install and run:
```bash
npm install
npm run start
```

4. Open Android:
```bash
npm run android
```

### Mobile screens included
- Splash (2s animated redirect)
- Onboarding (first launch only)
- Home
- Prompt Detail
- Generate (camera/gallery + lottie + result actions)
- Community (infinite grid + like animation + full-screen post)
- Marketplace (Stripe RN card flow + purchases)
- Profile (credits, history, upgrade CTA, notification/theme/logout settings)
