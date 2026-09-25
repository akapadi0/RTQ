import type { Part1Answers, Part2Answers, CapacityInputs, ClientTimeHorizon } from "./answer-types";

export type RtqStatus = "submitted" | "ips_ready";

/**
 * Frozen at Part 2 submission — score bands are provisional (shared/scoring.ts)
 * and expected to get recalibrated. Without this snapshot, a client's result
 * would silently change if the bands are retuned later; this keeps it
 * matching what was actually shown/emailed to them at the time.
 */
export interface ResultSnapshot {
  score: number;
  tierLabel: string;
  tierDescription: string;
  allocationNarrative: string;
  computedAt: string;
}

export interface RtqResponse {
  id: string;
  clientName: string;
  clientEmail: string;
  status: RtqStatus;
  part1: Part1Answers;
  part2: Part2Answers;
  /** Client-reported (Part 3) — the advisor's own capacity screen pre-fills its cash-needs section from this. */
  clientTimeHorizon: ClientTimeHorizon;
  resultSnapshot: ResultSnapshot;
  capacityInputs?: CapacityInputs;
  advisorNotes?: string;
  createdAt: string;
  submittedAt: string;
  ipsGeneratedAt?: string;
  /** Filename of the generated PDF inside the OneDrive Suitability folder — the audit trail's link to the actual document. */
  ipsFileName?: string;
}
