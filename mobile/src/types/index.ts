export type Prompt = {
  id: string;
  title: string;
  description: string;
  prompt_text: string;
  category: string;
  example_image_url: string;
  tags: string[];
  is_featured: boolean;
  use_count: number;
  created_at: string;
};

export type CommunityPost = {
  id: string;
  likes: number;
  created_at: string;
  generation_id: string;
  prompt_id: string;
  prompt_title: string;
  prompt_category: string;
  prompt_description?: string;
  generated_image_url: string;
  user_id: string;
  username: string;
  user_avatar_url: string | null;
};

export type MarketplacePrompt = {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  prompt_text: string;
  category: string;
  cover_image_url: string;
  example_images: string[];
  price: number;
  price_inr?: number;
  is_free: boolean;
  tags: string[];
  purchase_count: number;
  rating_avg: number;
  rating_count: number;
  status: "pending_review" | "approved" | "rejected";
  rejection_reason: string | null;
  created_at: string;
  creator?: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    is_verified: boolean;
  } | null;
};

export type GenerationHistoryItem = {
  id: string;
  created_at: string;
  original_image_url: string;
  generated_image_url: string;
  prompt: Prompt | null;
};

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  credits: number;
  is_pro: boolean;
  is_suspended: boolean;
  referral_code: string | null;
};

export type AuthSessionLike = {
  access_token: string;
};
