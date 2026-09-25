/**
 * RTQ content — per "Wealth IQ RTQ — Build Spec" (Aditi, 2026-09-24).
 *
 * Part 2 question wording is rewritten from scratch to avoid reproducing
 * Morningstar Advisor Workstation RTQ's proprietary text — do not restore
 * any earlier draft. See spec's Sources section.
 */

export type LifeRiskCategoryId = "investment" | "career" | "health" | "lifeChanges" | "behavioral";

export interface Concern {
  id: string;
  label: string;
}

export interface LifeRiskCategory {
  id: LifeRiskCategoryId;
  label: string;
  concerns: Concern[];
}

export const LIFE_RISK_CATEGORIES: LifeRiskCategory[] = [
  {
    id: "investment",
    label: "Investment risk",
    concerns: [
      { id: "market-crash", label: "Market crash" },
      { id: "outliving-assets", label: "Outliving my assets" },
    ],
  },
  {
    id: "career",
    label: "Career & income",
    concerns: [
      { id: "job-loss", label: "Job loss" },
      { id: "burnout", label: "Burnout" },
      { id: "income-stagnation", label: "Income stagnation" },
      { id: "business-failure", label: "My business or income source failing" },
      { id: "skill-obsolescence", label: "My skills becoming outdated" },
    ],
  },
  {
    id: "health",
    label: "Health & protection",
    concerns: [
      { id: "illness", label: "Illness" },
      { id: "disability", label: "Disability" },
      { id: "insurance-gaps", label: "Insurance gaps" },
      { id: "losing-a-spouse", label: "Losing a spouse" },
      { id: "caring-for-aging-parents", label: "Caring for aging parents" },
      { id: "caring-for-sick-family", label: "Caring for a sick family member" },
    ],
  },
  {
    id: "lifeChanges",
    label: "Life changes",
    concerns: [
      { id: "education-costs", label: "Kids' education costs" },
      { id: "major-life-change", label: "A major life change" },
      { id: "global-instability", label: "Global instability" },
      { id: "early-retirement", label: "Planning for early retirement" },
      { id: "inheritance-planning", label: "Inheritance planning" },
    ],
  },
  {
    id: "behavioral",
    label: "Behavioral",
    concerns: [
      { id: "panic-selling", label: "Panic-selling" },
      { id: "not-saving-enough", label: "Not saving enough" },
      { id: "procrastinating", label: "Procrastinating on financial planning" },
      { id: "family-misalignment", label: "Lack of alignment within the family on how to spend" },
      { id: "lifestyle-funding-gap", label: "Not having enough money to fund my lifestyle" },
    ],
  },
];

export const PART1_FREE_RESPONSE_PROMPTS = [
  {
    id: "freeText1",
    prompt: "Is there anything in your personal or family financial history that shapes how you think about risk?",
  },
  {
    id: "freeText2",
    prompt: "Anything else about risk or money you'd want your advisor to know before your next meeting?",
  },
] as const;

// ─── Part 2 — 7-question scored instrument ─────────────────────────────────

export interface Part2Option {
  points: number;
  label: string;
}

export interface Part2Question {
  id: "q1" | "q2" | "q3" | "q4" | "q5" | "q6" | "q7";
  prompt: string;
  options: Part2Option[];
}

export const PART2_QUESTIONS: Part2Question[] = [
  {
    id: "q1",
    prompt: "When you think about protecting your money against inflation, which fits best?",
    options: [
      { points: 1, label: "Protecting what I have matters more than growing it, even if I only keep pace with rising costs" },
      { points: 6, label: "Modest growth above inflation, only a little risk to get it" },
      { points: 9, label: "Growing my portfolio matters — I can handle short-term dips, just not wild swings" },
      { points: 14, label: "I want to maximize growth and I'm fine with big swings either direction" },
    ],
  },
  {
    id: "q2",
    prompt: "The market drops and your portfolio loses 20% in a month — $10,000 becomes $8,000. Gut reaction?",
    options: [
      { points: 1, label: "Pull everything to cash" },
      { points: 5, label: "Shift to something safer immediately" },
      { points: 8, label: "Wait a few months before deciding" },
      { points: 12, label: "Leave it alone, ride it out" },
      { points: 15, label: "Add more — feels like a buying opportunity" },
    ],
  },
  {
    id: "q3",
    prompt: "How much do day-to-day market swings actually affect your mood?",
    options: [
      { points: 1, label: "Constantly" },
      { points: 5, label: "Often" },
      { points: 8, label: "Sometimes" },
      { points: 12, label: "Rarely" },
      { points: 15, label: "Never" },
    ],
  },
  {
    id: "q4",
    prompt: 'First word that comes to mind when you hear "risk"?',
    options: [
      { points: 1, label: "Anxiety" },
      { points: 5, label: "Loss" },
      { points: 8, label: "Uncertainty" },
      { points: 12, label: "Opportunity" },
      { points: 15, label: "Thrill" },
    ],
  },
  {
    id: "q5",
    prompt: "How much do you trust markets to recover after a downturn?",
    options: [
      { points: 1, label: "Not at all" },
      { points: 5, label: "A little" },
      { points: 8, label: "Somewhat" },
      { points: 12, label: "Fairly confident" },
      { points: 15, label: "Extremely confident" },
    ],
  },
  {
    id: "q6",
    prompt: "You're handed $100,000 to invest for a year. Five possible outcome ranges — which are you most comfortable with?",
    options: [
      { points: 1, label: "Grow to $109.5K / shrink to $85K, expected ~$105K" },
      { points: 5, label: "Grow to $114.5K / shrink to $81K, expected ~$107K" },
      { points: 8, label: "Grow to $121.5K / shrink to $72.5K, expected ~$108.5K" },
      { points: 12, label: "Grow to $130K / shrink to $65K, expected ~$110K" },
      { points: 15, label: "Grow to $133K / shrink to $62K, expected ~$111K" },
    ],
  },
  {
    id: "q7",
    prompt: "Think back to a downturn you actually lived through — 2020, 2022, 2008, whichever hit hardest. What did you actually do?",
    options: [
      { points: 1, label: "Pulled everything to cash" },
      { points: 5, label: "Moved to something more conservative" },
      { points: 8, label: "Waited months before deciding" },
      { points: 12, label: "Didn't touch it" },
      { points: 15, label: "Bought more while it was down" },
    ],
  },
];

// ─── Near-term cash needs (non-scoring) ────────────────────────────────────

export type CashNeedItemId =
  | "home_purchase"
  | "remodel"
  | "major_purchase"
  | "business_investment"
  | "education"
  | "family_medical"
  | "sabbatical"
  | "other"
  | "none";

export const CASH_NEED_ITEMS: { id: CashNeedItemId; label: string; exclusive?: boolean }[] = [
  { id: "home_purchase", label: "Home purchase/down payment" },
  { id: "remodel", label: "Remodel or major repair" },
  { id: "major_purchase", label: "Major purchase (car, wedding, etc.)" },
  { id: "business_investment", label: "Business investment/start-up capital" },
  { id: "education", label: "Education costs" },
  { id: "family_medical", label: "Family/medical obligation" },
  { id: "sabbatical", label: "Planned sabbatical or career break" },
  { id: "other", label: "Other one-time expense" },
  { id: "none", label: "None of these", exclusive: true },
];

export type TimingBucket = "under_1yr" | "1_2yrs" | "3_5yrs";

export const TIMING_BUCKETS: { id: TimingBucket; label: string }[] = [
  { id: "under_1yr", label: "<1 yr" },
  { id: "1_2yrs", label: "1–2 yrs" },
  { id: "3_5yrs", label: "3–5 yrs" },
];
