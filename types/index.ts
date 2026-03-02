export type PromptCategory =
  | "Anime"
  | "Fantasy"
  | "Portrait"
  | "Architecture"
  | "Product"
  | "Vintage"
  | "Cartoon"
  | "Realistic"
  | "Art"
  | "Cyberpunk"
  | "Bollywood"
  | "Festival"
  | "India Special"
  | "Nature";

export interface UserProfile {
  id: string;
  email: string;
  phone: string | null;
  full_name: string | null;
  avatar_url: string | null;
  credits: number;
  daily_credits_used: number;
  daily_reset_at: string | null;
  daily_ad_credits: number;
  daily_share_credits: number;
  login_bonus_at: string | null;
  is_pro: boolean;
  is_suspended: boolean;
  credits_reset_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  referral_code: string | null;
  referred_by: string | null;
  referred_by_user_id: string | null;
  welcome_email_sent_at: string | null;
  created_at: string;
}

export interface Prompt {
  id: string;
  title: string;
  description: string;
  prompt_text: string;
  category: PromptCategory | string;
  example_image_url: string;
  tags: string[];
  is_featured: boolean;
  is_sponsored?: boolean;
  sponsor_name?: string | null;
  sponsor_logo_url?: string | null;
  use_count: number;
  created_at: string;
}

export interface Generation {
  id: string;
  user_id: string | null;
  prompt_id: string;
  original_image_url: string;
  generated_image_url: string;
  generated_image_url_clean?: string | null;
  generated_image_url_watermarked?: string | null;
  is_public: boolean;
  watermarked?: boolean;
  created_at: string;
}

export interface CommunityPost {
  id: string;
  generation_id: string;
  user_id: string;
  likes: number;
  created_at: string;
}

export interface CommunityPostView {
  id: string;
  likes: number;
  created_at: string;
  prompt_title: string;
  prompt_category: string;
  generated_image_url: string;
  username: string;
  user_avatar_url: string | null;
}

export interface GenerationWithPrompt extends Generation {
  prompt: Prompt | null;
}

export interface CreatorProfile {
  id: string;
  user_id: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  total_earnings: number;
  payout_email: string | null;
  razorpay_account_id: string | null;
  stripe_account_id: string | null;
  is_verified: boolean;
  created_at: string;
}

export type MarketplacePromptStatus = "pending_review" | "approved" | "rejected";

export interface MarketplacePrompt {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  prompt_text: string;
  category: string;
  cover_image_url: string;
  example_images: string[];
  price: number;
  price_inr: number;
  is_free: boolean;
  tags: string[];
  purchase_count: number;
  rating_avg: number;
  rating_count: number;
  status: MarketplacePromptStatus;
  rejection_reason: string | null;
  created_at: string;
}

export interface PromptPurchase {
  id: string;
  user_id: string;
  marketplace_prompt_id: string;
  amount_paid: number;
  amount_paid_inr: number;
  creator_earnings: number;
  creator_earnings_inr: number;
  platform_fee: number;
  platform_fee_inr: number;
  razorpay_payment_id: string | null;
  stripe_payment_intent_id: string | null;
  created_at: string;
}

export interface PromptRating {
  id: string;
  user_id: string;
  marketplace_prompt_id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
}

export interface MarketplacePromptReview extends PromptRating {
  user: Pick<UserProfile, "id" | "full_name" | "avatar_url"> | null;
}

export interface MarketplacePromptWithCreator extends MarketplacePrompt {
  creator: CreatorProfile | null;
}

export interface AnalyticsEvent {
  id: string;
  user_id: string | null;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referred_id: string;
  reward_credited: boolean;
  created_at: string;
}

export interface BillingTransaction {
  id: string;
  user_id: string;
  plan_id: string;
  kind: "subscription" | "credits" | "marketplace" | "other";
  status: "pending" | "succeeded" | "failed" | "refunded" | "canceled";
  amount_total: number;
  currency: string;
  stripe_event_id: string | null;
  stripe_customer_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_invoice_id: string | null;
  stripe_subscription_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
