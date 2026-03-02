export const PROMPT_CATEGORIES = [
  "All",
  "Anime",
  "Fantasy",
  "Portrait",
  "Vintage",
  "Cartoon",
  "Cyberpunk",
  "Bollywood",
  "Festival",
  "Traditional Art",
  "India Special",
  "Nature",
  "Art",
] as const;

export const GENERATE_MESSAGES = [
  "Ek second yaar...",
  "AI kaam kar raha hai",
  "Almost ready yaar!",
  "Magic touch add ho raha hai",
  "Bas ho gaya, final polish chal rahi hai...",
];

export const PRICING = {
  free: {
    name: "Free",
    description: "Best for daily fun and sharing",
    price: "\u20b90",
    features: [
      "2 daily free credits",
      "Earn more via rewarded ads",
      "Watermarked output",
      "WhatsApp-friendly sharing",
    ],
  },
  pro: {
    name: "Pro",
    description: "No ads, no watermark, HD quality",
    price: "\u20b949/month",
    features: [
      "Unlimited generations",
      "No watermark",
      "HD quality",
      "No ads across app",
    ],
  },
  credits: [
    { id: "credits_10", label: "10 credits", price: "\u20b99", credits: 10 },
    { id: "credits_50", label: "50 credits", price: "\u20b939", credits: 50 },
    { id: "credits_100", label: "100 credits", price: "\u20b969", credits: 100 },
  ],
} as const;

export const FEATURED_EXAMPLES = [
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
];
