/**
 * Scoring — per "Wealth IQ RTQ — Build Spec" (Aditi, 2026-09-24).
 *
 * Part 2 is a 7-question point-sum instrument (range 7–104) mapped to one of
 * six tiers via SCORE_BANDS. Deterministic, no LLM in this path. The band
 * cutoffs are explicitly placeholders — the spec calls for real submissions
 * to inform a recalibration, so they're a plain config array, not inlined
 * if/else, and are the first thing expected to change.
 */
import type { Part1Answers, Part2Answers, CashNeedEntry, CapacityInputs } from "./answer-types";
import { PART2_QUESTIONS, LIFE_RISK_CATEGORIES, type TimingBucket } from "./rtq-content";

export type RiskTier = "preservation" | "conservative" | "stability" | "growth" | "aggressive" | "opportunity";

export interface ScoreBand {
  tier: RiskTier;
  label: string;
  description: string;
  /** Deliberately broad/narrative, not a specific % or ticker — for IPS use. */
  allocationNarrative: string;
  min: number;
  max: number;
}

/** Provisional equal-width bands — recalibrate after the first 20–30 real submissions cluster. */
export const SCORE_BANDS: ScoreBand[] = [
  { tier: "preservation", label: "Preservation", description: "Protecting what you have comes first, even if it means growth stays modest.", allocationNarrative: "Capital preservation, income-focused", min: 7, max: 23 },
  { tier: "conservative", label: "Conservative", description: "You're open to some growth, but only with a light touch of risk.", allocationNarrative: "Conservative, income-tilted with modest growth", min: 24, max: 40 },
  { tier: "stability", label: "Stability", description: "You want steady progress and can tolerate some ups and downs to get it.", allocationNarrative: "Balanced, stability-focused", min: 41, max: 57 },
  { tier: "growth", label: "Growth", description: "You're comfortable riding out volatility in pursuit of stronger long-term growth.", allocationNarrative: "Growth-oriented, moderate volatility", min: 58, max: 74 },
  { tier: "aggressive", label: "Aggressive", description: "You're focused on maximizing growth and can handle significant swings.", allocationNarrative: "Aggressive growth, higher volatility", min: 75, max: 91 },
  { tier: "opportunity", label: "Opportunity", description: "You actively welcome volatility as part of pursuing the highest growth potential.", allocationNarrative: "Opportunity-seeking, maximum growth", min: 92, max: 104 },
];

export function totalScore(answers: Part2Answers): number {
  return answers.q1 + answers.q2 + answers.q3 + answers.q4 + answers.q5 + answers.q6 + answers.q7;
}

export function scoreToTier(score: number): ScoreBand {
  const band = SCORE_BANDS.find((b) => score >= b.min && score <= b.max);
  if (band) return band;
  // Defensive fallback if a future question-set changes the total range without updating bands.
  return score < SCORE_BANDS[0].min ? SCORE_BANDS[0] : SCORE_BANDS[SCORE_BANDS.length - 1];
}

// ─── Part 1 — unscored, just organizes what was submitted ──────────────────

export function summarizePart1(answers: Part1Answers) {
  const [top, second] = answers.categoryRank;
  return {
    topCategory: top,
    secondCategory: second,
    orderedCategories: answers.categoryRank,
    selectedConcerns: answers.selectedConcerns,
  };
}

export const categoryLabel = (id: string) => LIFE_RISK_CATEGORIES.find((c) => c.id === id)?.label ?? id;

export const concernLabel = (categoryId: string, concernId: string) =>
  LIFE_RISK_CATEGORIES.find((c) => c.id === categoryId)?.concerns.find((x) => x.id === concernId)?.label ?? concernId;

// ─── Non-scoring flags — advisor-facing report only ────────────────────────

const q2Points = () => PART2_QUESTIONS.find((q) => q.id === "q2")!.options;

/**
 * gap = q2 - q7, both on the same points scale (Q7 deliberately mirrors Q2's
 * scale for direct comparison). Any non-zero gap gets a message — no
 * threshold, per spec: "any mismatch is a real conversation starter."
 */
export function predictedActualGap(answers: Part2Answers): { gap: number; message: string | null } {
  const gap = answers.q2 - answers.q7;
  if (gap === 0) return { gap, message: null };

  const points = q2Points();
  const describe = (value: number) => points.find((o) => o.points === value)?.label.toLowerCase() ?? `${value} pts`;

  // Higher points = bolder/more risk-tolerant option, on both q2 and q7.
  const message =
    gap > 0
      ? `Client predicted they'd react more boldly ("${describe(answers.q2)}") than what they actually did in a real downturn ("${describe(answers.q7)}") — worth exploring why, e.g. predicted they'd ride it out, but sold during the last one they lived through.`
      : `Client's actual behavior in a real downturn ("${describe(answers.q7)}") was bolder than their predicted reaction ("${describe(answers.q2)}") — worth exploring what made the real experience easier than expected.`;

  return { gap, message };
}

// ─── Near-term cash needs — advisor-facing talking point only ─────────────

const TIMING_ORDER: TimingBucket[] = ["under_1yr", "1_2yrs", "3_5yrs"];
const TIMING_LABEL: Record<TimingBucket, string> = { under_1yr: "<1 yr", "1_2yrs": "1–2 yrs", "3_5yrs": "3–5 yrs" };

/**
 * `investableAssets` is optional and, per Aditi (2026-09-24), often genuinely
 * unknown at the point cash needs are entered — a new prospect's Time
 * Horizon screen may get filled in before their account balances are ever
 * seen. So `pctOfAssets` doesn't require it: per entry, a directly-entered
 * `pctOfPortfolio` (spec: "Approx. amount or % of portfolio") is used as-is;
 * only entries given as a dollar `amount` fall back to dividing by
 * `investableAssets`, and only when it happens to be available. Mixing is
 * fine — each entry resolves independently, then sums.
 */
export function cashNeedsRollup(
  cashNeeds: CashNeedEntry[],
  investableAssets?: number
): { totalAmount: number; earliestTiming: TimingBucket | null; pctOfAssets: number | null; message: string | null } {
  if (cashNeeds.length === 0) return { totalAmount: 0, earliestTiming: null, pctOfAssets: null, message: null };

  const totalAmount = cashNeeds.reduce((sum, c) => sum + (c.amount ?? 0), 0);
  const earliestTiming = cashNeeds
    .map((c) => c.timing)
    .sort((a, b) => TIMING_ORDER.indexOf(a) - TIMING_ORDER.indexOf(b))[0];

  let pctOfAssets: number | null = null;
  for (const c of cashNeeds) {
    const entryPct = c.pctOfPortfolio ?? (c.amount && investableAssets && investableAssets > 0 ? (c.amount / investableAssets) * 100 : null);
    if (entryPct !== null) pctOfAssets = (pctOfAssets ?? 0) + entryPct;
  }

  const amountText = totalAmount > 0 ? `~$${totalAmount.toLocaleString()}` : "an unspecified amount";
  const pctText = pctOfAssets !== null ? ` (~${pctOfAssets.toFixed(0)}% of portfolio)` : "";
  const message = `Flagged ${amountText}${pctText} in near-term needs, earliest in ${TIMING_LABEL[earliestTiming]} — worth discussing what stays liquid.`;

  return { totalAmount, earliestTiming, pctOfAssets, message };
}

// ─── Capacity ("ability to take risk") — advisor-entered, for IPS use ──────
// Not part of the RTQ Build Spec (2026-09-24); pre-existing, kept for the
// separate IPS-generation flow, which the spec doesn't touch.

const INCOME_STABILITY_POINTS: Record<CapacityInputs["incomeStability"], number> = {
  stable_employment: 70,
  variable_business_income: 45,
  fixed_income_retired: 30,
};

const GOAL_COVERAGE_POINTS: Record<CapacityInputs["goalCoverage"], number> = {
  comfortable: 100,
  on_track: 70,
  tight: 40,
  stretched: 15,
};

function ageToHorizonPoints(age: number, targetRetirementAge: number | undefined): number {
  const horizon = (targetRetirementAge ?? 65) - age;
  if (horizon >= 25) return 100;
  if (horizon >= 15) return 75;
  if (horizon >= 5) return 45;
  return 20;
}

const CAPACITY_WEIGHTS = { horizon: 0.45, incomeStability: 0.25, goalCoverage: 0.3 } as const;

/**
 * Near-term cash needs reduce ability to take risk — per Aditi (2026-09-24),
 * this is a Risk Tolerance/Ability input, not a side-note elsewhere. Money
 * needed soon can't be meaningfully exposed to volatility, so a bigger
 * near-term draw (and a sooner one) pulls the capacity score down. Capped so
 * it can dent but not zero out an otherwise-strong capacity picture.
 */
const LIQUIDITY_TIMING_WEIGHT: Record<TimingBucket, number> = { under_1yr: 1.5, "1_2yrs": 1.0, "3_5yrs": 0.6 };
const MAX_LIQUIDITY_PENALTY = 30;

function liquidityPenalty(inputs: CapacityInputs): number {
  const rollup = cashNeedsRollup(inputs.cashNeeds, inputs.investableAssets);
  if (rollup.pctOfAssets === null || !rollup.earliestTiming) return 0;
  const weight = LIQUIDITY_TIMING_WEIGHT[rollup.earliestTiming];
  return Math.min(MAX_LIQUIDITY_PENALTY, rollup.pctOfAssets * weight * 0.6);
}

function scoreToCapacityTier(score: number): { label: string } {
  // Reuse the six RTQ tier labels on a 0-100 scale so capacity and the RTQ
  // tier read on the same vocabulary in the IPS, even though they're computed
  // on different scales (0-100 vs. the 7-104 point-sum).
  const idx = Math.min(5, Math.floor(Math.max(0, Math.min(100, score)) / (100 / 6)));
  return { label: SCORE_BANDS[idx].label };
}

export interface CapacityScore {
  /** Age/horizon + income stability + goal coverage only — what's known before liquidity is factored in. */
  initialScore: number;
  initialTier: { label: string };
  /** initialScore minus the liquidity penalty — the operative capacity figure for the IPS. */
  adjustedScore: number;
  tier: { label: string };
  liquidityPenalty: number;
}

export function scoreCapacity(inputs: CapacityInputs): CapacityScore {
  const initialScore = Math.round(
    ageToHorizonPoints(inputs.age, inputs.targetRetirementAge) * CAPACITY_WEIGHTS.horizon +
      INCOME_STABILITY_POINTS[inputs.incomeStability] * CAPACITY_WEIGHTS.incomeStability +
      GOAL_COVERAGE_POINTS[inputs.goalCoverage] * CAPACITY_WEIGHTS.goalCoverage
  );
  const penalty = liquidityPenalty(inputs);
  const adjustedScore = Math.round(Math.max(0, Math.min(100, initialScore - penalty)));
  return {
    initialScore,
    initialTier: scoreToCapacityTier(initialScore),
    adjustedScore,
    tier: scoreToCapacityTier(adjustedScore),
    liquidityPenalty: Math.round(penalty),
  };
}

/** Flags a meaningful gap between capacity tier and the RTQ's own tier (band index distance ≥ 2). */
export function computeDivergence(capacityScore: number, rtqTotalScore: number) {
  const capacityIdx = Math.min(5, Math.floor(Math.max(0, Math.min(100, capacityScore)) / (100 / 6)));
  const rtqIdx = SCORE_BANDS.findIndex((b) => b.tier === scoreToTier(rtqTotalScore).tier);
  const gap = capacityIdx - rtqIdx;
  return {
    gap,
    flagged: Math.abs(gap) >= 2,
    direction: gap >= 2 ? "capacity_exceeds_desire" : gap <= -2 ? "desire_exceeds_capacity" : "aligned",
  } as const;
}
