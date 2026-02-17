import { FitnessGoal } from "../types";

export type EvidenceLevel = "strong" | "moderate" | "limited";

export type KnowledgeCategory = "industry" | "supplements" | "diet" | "training";

export interface LessonSource {
  title: string;
  organization: string;
  year: number;
  url: string;
}

export interface LessonMythFact {
  myth: string;
  fact: string;
}

export interface LessonQuiz {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface KnowledgeLesson {
  id: string;
  category: KnowledgeCategory;
  title: string;
  readMinutes: number;
  summary: string;
  goalTags: FitnessGoal[];
  keyPoints: string[];
  actionSteps: string[];
  mythFact: LessonMythFact;
  evidenceLevel: EvidenceLevel;
  lastReviewed: string;
  sources: LessonSource[];
  quiz: LessonQuiz;
}

export const KNOWLEDGE_CATEGORY_LABELS: Record<KnowledgeCategory, string> = {
  industry: "Industry",
  supplements: "Supplements",
  diet: "Diet",
  training: "Training"
};

export const EVIDENCE_LABELS: Record<EvidenceLevel, string> = {
  strong: "Strong",
  moderate: "Moderate",
  limited: "Limited"
};

const LESSONS: KnowledgeLesson[] = [
  {
    id: "ind_claim_quality",
    category: "industry",
    title: "How To Judge Fitness Claims",
    readMinutes: 5,
    summary: "Separate evidence-based coaching from marketing by checking claim quality and source quality.",
    goalTags: ["lose_weight", "gain_muscle", "maintain"],
    keyPoints: [
      "Strong claims should cite peer-reviewed studies or official position stands.",
      "Single-study claims are weaker than systematic reviews and meta-analyses.",
      "Absolute language like always and never is a red flag in nutrition and training."
    ],
    actionSteps: [
      "Ask what evidence level supports the claim before changing your plan.",
      "Check if the result is meaningful in real life, not only statistically significant.",
      "Favor creators who update recommendations when new data appears."
    ],
    mythFact: {
      myth: "If a coach has a great physique, their advice is automatically evidence-based.",
      fact: "Outcomes can come from genetics, lifestyle, or adherence; evidence quality matters more than appearance."
    },
    evidenceLevel: "strong",
    lastReviewed: "2026-02-17",
    sources: [
      {
        title: "How to Read and Understand a Scientific Paper",
        organization: "National Institutes of Health",
        year: 2024,
        url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10491349/"
      },
      {
        title: "Hierarchy of Evidence",
        organization: "Oxford Centre for Evidence-Based Medicine",
        year: 2011,
        url: "https://www.cebm.ox.ac.uk/resources/levels-of-evidence/ocebm-levels-of-evidence"
      }
    ],
    quiz: {
      question: "Which source generally gives stronger practical guidance?",
      options: [
        "A single before-and-after client post",
        "A meta-analysis of controlled trials",
        "A motivational social media thread"
      ],
      correctIndex: 1,
      explanation: "Meta-analyses combine multiple controlled trials and reduce single-study noise."
    }
  },
  {
    id: "ind_supp_regulation",
    category: "industry",
    title: "Supplement Regulation Basics",
    readMinutes: 4,
    summary: "Understand what supplement labels can and cannot guarantee.",
    goalTags: ["lose_weight", "gain_muscle", "maintain"],
    keyPoints: [
      "Supplements are not approved like medications before market launch in many regions.",
      "Third-party testing improves quality confidence but does not guarantee effectiveness.",
      "Structure-function claims are different from disease-treatment claims."
    ],
    actionSteps: [
      "Prioritize third-party tested products when possible.",
      "Verify ingredient dose matches evidence-based ranges.",
      "Avoid proprietary blends when transparent dosing is unavailable."
    ],
    mythFact: {
      myth: "If a supplement is sold legally, it must be clinically proven.",
      fact: "Legal sale does not equal strong efficacy evidence."
    },
    evidenceLevel: "strong",
    lastReviewed: "2026-02-17",
    sources: [
      {
        title: "Dietary Supplements",
        organization: "U.S. Food and Drug Administration",
        year: 2025,
        url: "https://www.fda.gov/food/dietary-supplements"
      },
      {
        title: "Third-Party Certification",
        organization: "NSF",
        year: 2025,
        url: "https://www.nsf.org/consumer-resources/articles/dietary-supplements"
      }
    ],
    quiz: {
      question: "What does third-party testing primarily improve?",
      options: ["Product purity and label accuracy", "Guaranteed fat loss", "Guaranteed muscle gain"],
      correctIndex: 0,
      explanation: "Third-party testing is mostly about contamination and label verification."
    }
  },
  {
    id: "sup_creatine",
    category: "supplements",
    title: "Creatine Monohydrate Essentials",
    readMinutes: 5,
    summary: "Creatine is one of the most researched supplements for high-intensity performance and lean mass support.",
    goalTags: ["gain_muscle", "maintain", "lose_weight"],
    keyPoints: [
      "A typical maintenance dose is 3-5 g daily.",
      "Consistency matters more than exact timing for most users.",
      "Small water-weight increases are expected and not body fat."
    ],
    actionSteps: [
      "Use plain creatine monohydrate daily with any meal.",
      "Track body weight and training performance for 4-6 weeks.",
      "Pair with progressive overload and adequate protein."
    ],
    mythFact: {
      myth: "Creatine is a steroid.",
      fact: "Creatine is a naturally occurring compound involved in rapid energy production."
    },
    evidenceLevel: "strong",
    lastReviewed: "2026-02-17",
    sources: [
      {
        title: "International Society of Sports Nutrition Position Stand: Creatine",
        organization: "ISSN",
        year: 2021,
        url: "https://jissn.biomedcentral.com/articles/10.1186/s12970-021-00412-w"
      },
      {
        title: "Office of Dietary Supplements: Creatine",
        organization: "NIH ODS",
        year: 2025,
        url: "https://ods.od.nih.gov/factsheets/Creatine-HealthProfessional/"
      }
    ],
    quiz: {
      question: "What is the most practical daily creatine maintenance approach?",
      options: ["3-5 g every day", "Only on training days", "Only pre-workout in large doses"],
      correctIndex: 0,
      explanation: "Daily consistency is the key driver of muscle saturation."
    }
  },
  {
    id: "sup_caffeine",
    category: "supplements",
    title: "Caffeine For Performance",
    readMinutes: 5,
    summary: "Caffeine can improve power and endurance performance, but dose and timing should be individualized.",
    goalTags: ["lose_weight", "gain_muscle", "maintain"],
    keyPoints: [
      "Common performance dosing ranges around 3-6 mg/kg bodyweight.",
      "Too much caffeine can impair sleep, recovery, and next-day performance.",
      "Habitual users may still get benefits but should monitor tolerance."
    ],
    actionSteps: [
      "Start low and test tolerance in normal training sessions.",
      "Avoid high doses late in the day if sleep quality drops.",
      "Cycle dosage only if tolerance and side effects become problematic."
    ],
    mythFact: {
      myth: "More caffeine always means better workouts.",
      fact: "Higher doses increase side effects and may reduce performance quality."
    },
    evidenceLevel: "strong",
    lastReviewed: "2026-02-17",
    sources: [
      {
        title: "ISSN Position Stand: Caffeine and Exercise Performance",
        organization: "ISSN",
        year: 2021,
        url: "https://jissn.biomedcentral.com/articles/10.1186/s12970-020-00383-4"
      },
      {
        title: "Caffeine and Sleep",
        organization: "Sleep Foundation",
        year: 2024,
        url: "https://www.sleepfoundation.org/nutrition/caffeine-and-sleep"
      }
    ],
    quiz: {
      question: "What is the biggest risk of overusing caffeine in training?",
      options: ["Better strength gains", "Poor sleep and recovery", "Guaranteed fat loss"],
      correctIndex: 1,
      explanation: "Recovery quality declines when caffeine disrupts sleep."
    }
  },
  {
    id: "sup_protein_powder",
    category: "supplements",
    title: "Protein Powders: What They Are For",
    readMinutes: 4,
    summary: "Protein powders are convenience tools to hit daily protein targets, not magic muscle builders.",
    goalTags: ["gain_muscle", "lose_weight", "maintain"],
    keyPoints: [
      "Daily total protein intake matters more than brand choice.",
      "Whey can be practical post-workout, but timing is less important than daily totals.",
      "Whole-food protein should remain a major part of intake."
    ],
    actionSteps: [
      "Set a daily protein target based on body weight and goal.",
      "Use powder only to fill intake gaps.",
      "Choose a product with transparent ingredient and dose labeling."
    ],
    mythFact: {
      myth: "If you miss a post-workout shake, gains are lost.",
      fact: "Total daily protein and consistent training matter far more."
    },
    evidenceLevel: "moderate",
    lastReviewed: "2026-02-17",
    sources: [
      {
        title: "Dietary Protein and Resistance Training",
        organization: "British Journal of Sports Medicine",
        year: 2018,
        url: "https://bjsm.bmj.com/content/52/6/376"
      },
      {
        title: "Protein Fact Sheet",
        organization: "NIH ODS",
        year: 2025,
        url: "https://ods.od.nih.gov/factsheets/Protein-Consumer/"
      }
    ],
    quiz: {
      question: "What is the primary role of protein powder?",
      options: ["Replace all whole foods", "Help meet daily protein targets", "Burn fat directly"],
      correctIndex: 1,
      explanation: "Protein powder is mainly a convenience strategy for target adherence."
    }
  },
  {
    id: "diet_energy_balance",
    category: "diet",
    title: "Energy Balance Without Confusion",
    readMinutes: 6,
    summary: "Weight trend changes depend on long-term energy balance, with behavior and environment driving adherence.",
    goalTags: ["lose_weight", "gain_muscle", "maintain"],
    keyPoints: [
      "Fat loss requires a sustained calorie deficit.",
      "Muscle gain is optimized by progressive training plus sufficient calories and protein.",
      "Consistency over weeks matters more than single-day perfection."
    ],
    actionSteps: [
      "Track bodyweight trend weekly, not just daily fluctuations.",
      "Adjust intake by small increments based on 2-3 week trends.",
      "Anchor meals around protein and fiber to improve adherence."
    ],
    mythFact: {
      myth: "Certain foods break the laws of energy balance.",
      fact: "Food quality matters for health and adherence, but energy balance still drives weight trend."
    },
    evidenceLevel: "strong",
    lastReviewed: "2026-02-17",
    sources: [
      {
        title: "Energy Balance and Obesity",
        organization: "National Institute of Diabetes and Digestive and Kidney Diseases",
        year: 2024,
        url: "https://www.niddk.nih.gov/health-information/weight-management/take-charge-health-guide-teenagers/energy-balance"
      },
      {
        title: "Dietary Guidelines for Americans",
        organization: "U.S. Departments of Agriculture and Health and Human Services",
        year: 2020,
        url: "https://www.dietaryguidelines.gov/"
      }
    ],
    quiz: {
      question: "For fat loss, what must happen over time?",
      options: ["Only carbs must be removed", "A sustained calorie deficit", "Only supplements must be used"],
      correctIndex: 1,
      explanation: "A sustained energy deficit is required for fat loss."
    }
  },
  {
    id: "diet_protein_distribution",
    category: "diet",
    title: "Protein Distribution Through The Day",
    readMinutes: 5,
    summary: "Distributing protein across meals helps support muscle protein synthesis and satiety.",
    goalTags: ["gain_muscle", "lose_weight", "maintain"],
    keyPoints: [
      "A practical target is spreading protein across 3-5 feedings per day.",
      "Each meal can include a meaningful protein dose based on body size and goals.",
      "High-protein diets often improve satiety and support lean mass retention in deficits."
    ],
    actionSteps: [
      "Build each meal around a protein anchor first.",
      "Plan protein-rich snacks when daily targets are hard to reach.",
      "Monitor hunger and recovery to refine meal timing."
    ],
    mythFact: {
      myth: "The body can only absorb 30 g protein per meal.",
      fact: "Absorption occurs broadly; distribution supports muscle outcomes and satiety."
    },
    evidenceLevel: "moderate",
    lastReviewed: "2026-02-17",
    sources: [
      {
        title: "Protein Timing and Distribution",
        organization: "Journal of Nutrition",
        year: 2018,
        url: "https://academic.oup.com/jn/article/148/11/1760/5153344"
      },
      {
        title: "Protein Intake and Lean Mass in Energy Restriction",
        organization: "American Journal of Clinical Nutrition",
        year: 2021,
        url: "https://academic.oup.com/ajcn/article/113/2/303/5993489"
      }
    ],
    quiz: {
      question: "What is a practical reason to distribute protein across meals?",
      options: ["Only to reduce food cost", "Support satiety and muscle-related outcomes", "To avoid all carbs"],
      correctIndex: 1,
      explanation: "Protein distribution helps appetite control and muscle-supportive signaling."
    }
  },
  {
    id: "diet_sustainable_fat_loss",
    category: "diet",
    title: "Sustainable Fat Loss Strategy",
    readMinutes: 6,
    summary: "The best fat-loss diet is the one you can adhere to while preserving training performance and recovery.",
    goalTags: ["lose_weight", "maintain", "gain_muscle"],
    keyPoints: [
      "Moderate deficits are usually more sustainable than aggressive cuts.",
      "Resistance training and adequate protein improve lean mass retention.",
      "Diet breaks and maintenance phases can support long-term adherence."
    ],
    actionSteps: [
      "Set weekly weight-change targets rather than daily perfection.",
      "Keep 2-3 repeatable meal templates for busy days.",
      "Review sleep, stress, and hunger before changing calories."
    ],
    mythFact: {
      myth: "The fastest cut is always the best cut.",
      fact: "Overly aggressive deficits often reduce adherence and training quality."
    },
    evidenceLevel: "moderate",
    lastReviewed: "2026-02-17",
    sources: [
      {
        title: "Weight Loss and Long-Term Adherence",
        organization: "The Lancet",
        year: 2019,
        url: "https://www.thelancet.com/journals/landia/article/PIIS2213-8587(19)30020-8/fulltext"
      },
      {
        title: "Resistance Training During Energy Restriction",
        organization: "Sports Medicine",
        year: 2021,
        url: "https://link.springer.com/article/10.1007/s40279-021-01558-y"
      }
    ],
    quiz: {
      question: "What is the main advantage of a moderate calorie deficit?",
      options: ["Better long-term adherence and training quality", "No need for protein intake", "No need for sleep"],
      correctIndex: 0,
      explanation: "Moderate deficits are often more sustainable with better performance retention."
    }
  },
  {
    id: "train_hypertrophy_landmarks",
    category: "training",
    title: "Hypertrophy Volume Landmarks",
    readMinutes: 6,
    summary: "Most people build muscle well with moderate weekly hard-set volumes and consistent progression.",
    goalTags: ["gain_muscle", "maintain", "lose_weight"],
    keyPoints: [
      "Typical productive ranges are often around 10-20 hard sets per muscle group weekly.",
      "Volume tolerance differs by training age, sleep, and stress.",
      "Start near the lower end and add volume only when recovery supports it."
    ],
    actionSteps: [
      "Track weekly sets by muscle group.",
      "Increase sets gradually only if performance and recovery are stable.",
      "Deload when fatigue accumulates and performance stalls."
    ],
    mythFact: {
      myth: "More sets are always better for growth.",
      fact: "Volume has diminishing returns and can reduce progress when recovery is insufficient."
    },
    evidenceLevel: "strong",
    lastReviewed: "2026-02-17",
    sources: [
      {
        title: "Dose-Response Relationship Between Weekly Resistance Training Volume and Muscle Hypertrophy",
        organization: "Journal of Sports Sciences",
        year: 2019,
        url: "https://pubmed.ncbi.nlm.nih.gov/30335456/"
      },
      {
        title: "Training Volume and Muscle Growth Meta-Analysis",
        organization: "Sports Medicine",
        year: 2022,
        url: "https://link.springer.com/article/10.1007/s40279-022-01692-5"
      }
    ],
    quiz: {
      question: "What is a practical first step for hypertrophy volume?",
      options: ["Start very high immediately", "Start moderate and progress based on recovery", "Never track sets"],
      correctIndex: 1,
      explanation: "Progressive and recoverable volume generally outperforms abrupt high volume."
    }
  },
  {
    id: "train_progressive_overload",
    category: "training",
    title: "Progressive Overload That Lasts",
    readMinutes: 5,
    summary: "Double progression and RPE control can drive consistent gains without burning out.",
    goalTags: ["gain_muscle", "maintain", "lose_weight"],
    keyPoints: [
      "Progress by reps first, then add load in small increments.",
      "Most hard sets should live around RPE 7-9.",
      "Near-failure work can be strategic, not constant."
    ],
    actionSteps: [
      "Set rep ranges for key lifts and track each session.",
      "Increase load once top reps are repeatable with clean technique.",
      "Use easier sessions when fatigue signs increase."
    ],
    mythFact: {
      myth: "Every set must go to failure to grow muscle.",
      fact: "Most growth can occur without maximal fatigue on every set."
    },
    evidenceLevel: "strong",
    lastReviewed: "2026-02-17",
    sources: [
      {
        title: "Training to Failure and Muscle Hypertrophy",
        organization: "Sports Medicine",
        year: 2021,
        url: "https://link.springer.com/article/10.1007/s40279-021-01507-9"
      },
      {
        title: "RPE-Based Load Prescription",
        organization: "National Strength and Conditioning Association",
        year: 2020,
        url: "https://www.nsca.com/education/articles/kinetic-select/rpe-and-autoregulation/"
      }
    ],
    quiz: {
      question: "What is double progression?",
      options: ["Increase reps at same load, then raise load", "Only increase load each session", "Never repeat an exercise"],
      correctIndex: 0,
      explanation: "Double progression improves skill and performance before adding load stress."
    }
  },
  {
    id: "train_cardio_integration",
    category: "training",
    title: "Cardio Without Killing Strength",
    readMinutes: 4,
    summary: "Cardio can improve health and work capacity when volume and scheduling are managed intelligently.",
    goalTags: ["lose_weight", "maintain", "gain_muscle"],
    keyPoints: [
      "Zone-2 work supports recovery and cardiovascular health.",
      "High-intensity intervals are useful but should be dosed conservatively.",
      "Separate hard cardio and hard leg sessions when possible."
    ],
    actionSteps: [
      "Use 2-3 cardio sessions weekly aligned with your goal.",
      "Place intervals away from heavy lower-body lifting when possible.",
      "Adjust cardio volume if lifting performance drops consistently."
    ],
    mythFact: {
      myth: "Any cardio will automatically ruin muscle gains.",
      fact: "Interference is mostly a programming and recovery management issue."
    },
    evidenceLevel: "moderate",
    lastReviewed: "2026-02-17",
    sources: [
      {
        title: "Concurrent Training and Adaptations",
        organization: "Sports Medicine",
        year: 2018,
        url: "https://link.springer.com/article/10.1007/s40279-018-0907-6"
      },
      {
        title: "Physical Activity Guidelines",
        organization: "CDC",
        year: 2025,
        url: "https://www.cdc.gov/physicalactivity/basics/index.htm"
      }
    ],
    quiz: {
      question: "How can you reduce cardio-strength interference?",
      options: ["Do all hard cardio before heavy leg sessions", "Schedule hard cardio and heavy lower sessions apart", "Avoid all cardio forever"],
      correctIndex: 1,
      explanation: "Programming spacing helps preserve lifting quality and recovery."
    }
  }
];

export function getKnowledgeLessons(): KnowledgeLesson[] {
  return LESSONS;
}

export function getGoalCategoryPriority(goal: FitnessGoal): KnowledgeCategory[] {
  if (goal === "gain_muscle") {
    return ["training", "diet", "supplements", "industry"];
  }
  if (goal === "lose_weight") {
    return ["diet", "training", "supplements", "industry"];
  }
  return ["training", "diet", "industry", "supplements"];
}
