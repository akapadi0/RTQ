import { z } from "zod";
import type { LifeRiskCategoryId, CashNeedItemId, TimingBucket, TimeHorizonBucket } from "./rtq-content";

export const part1AnswersSchema = z.object({
  /** index 0 = rank 1 (most weighs on client). Independent of selectedConcerns. */
  categoryRank: z.array(z.string()).length(5) as z.ZodType<LifeRiskCategoryId[]>,
  /** categoryId -> concern ids selected within it. Independent of rank. */
  selectedConcerns: z.record(z.array(z.string())),
  freeText1: z.string().max(2000).optional().default(""),
  freeText2: z.string().max(2000).optional().default(""),
});
export type Part1Answers = z.infer<typeof part1AnswersSchema>;

const cashNeedEntrySchema = z.object({
  item: z.custom<CashNeedItemId>(),
  /** Either works, per spec: "Approx. amount or % of portfolio." Advisor enters whichever they actually know — a dollar figure needs investable assets to convert to %, but a direct % doesn't. */
  amount: z.number().min(0).optional(),
  pctOfPortfolio: z.number().min(0).max(100).optional(),
  timing: z.custom<TimingBucket>(),
});
export type CashNeedEntry = z.infer<typeof cashNeedEntrySchema>;

export const part2AnswersSchema = z.object({
  q1: z.number(),
  q2: z.number(),
  q3: z.number(),
  q4: z.number(),
  q5: z.number(),
  q6: z.number(),
  q7: z.number(),
});
export type Part2Answers = z.infer<typeof part2AnswersSchema>;

/**
 * Part 3 — client-reported, non-scoring. Per Aditi (2026-09-25): clients
 * should complete time horizon and near-term cash needs themselves, same
 * shape as the cash-needs entries the advisor separately confirms in
 * CapacityInputs below (the advisor's capacity screen pre-fills from this).
 */
export const clientTimeHorizonSchema = z.object({
  horizonBucket: z.custom<TimeHorizonBucket>(),
  cashNeeds: z.array(cashNeedEntrySchema).default([]),
});
export type ClientTimeHorizon = z.infer<typeof clientTimeHorizonSchema>;

/**
 * Advisor-entered — the "Time Horizon & Client Specifics" step, filled in
 * after the client submits. Includes near-term cash needs: per Aditi
 * (2026-09-24), that belongs here as a Time Horizon/liquidity concept she
 * fills in herself, not a client-facing question in Part 2.
 */
export const capacityInputsSchema = z.object({
  age: z.number().min(0).max(120),
  targetRetirementAge: z.number().min(0).max(120).optional(),
  career: z.string().max(200).optional().default(""),
  investableAssets: z.number().min(0).optional(),
  incomeStability: z.enum(["stable_employment", "variable_business_income", "fixed_income_retired"]),
  goalCoverage: z.enum(["comfortable", "on_track", "tight", "stretched"]),
  /** empty array if "None of these" applies. */
  cashNeeds: z.array(cashNeedEntrySchema).default([]),
  notes: z.string().max(2000).optional().default(""),
});
export type CapacityInputs = z.infer<typeof capacityInputsSchema>;
