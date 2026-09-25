import type { Part1Answers, Part2Answers } from "@shared/answer-types";
import type { RtqResponse } from "@shared/rtq-store-types";

/**
 * Carries the client's answers across Landing -> Part 1 -> Part 2 -> Part 3
 * in sessionStorage, so the server only sees one combined write at the end
 * of Part 3 instead of a create-then-patch sequence a few seconds apart.
 */
const INTAKE_KEY = "rtq:intake";
const PART1_KEY = "rtq:part1";
const PART2_KEY = "rtq:part2";

export interface RtqIntake {
  clientName: string;
  clientEmail: string;
}

export function saveIntake(intake: RtqIntake): void {
  sessionStorage.setItem(INTAKE_KEY, JSON.stringify(intake));
}

export function loadIntake(): RtqIntake | undefined {
  const raw = sessionStorage.getItem(INTAKE_KEY);
  return raw ? (JSON.parse(raw) as RtqIntake) : undefined;
}

export function savePart1(part1: Part1Answers): void {
  sessionStorage.setItem(PART1_KEY, JSON.stringify(part1));
}

export function loadPart1(): Part1Answers | undefined {
  const raw = sessionStorage.getItem(PART1_KEY);
  return raw ? (JSON.parse(raw) as Part1Answers) : undefined;
}

export function savePart2(part2: Part2Answers): void {
  sessionStorage.setItem(PART2_KEY, JSON.stringify(part2));
}

export function loadPart2(): Part2Answers | undefined {
  const raw = sessionStorage.getItem(PART2_KEY);
  return raw ? (JSON.parse(raw) as Part2Answers) : undefined;
}

export function clearIntake(): void {
  sessionStorage.removeItem(INTAKE_KEY);
  sessionStorage.removeItem(PART1_KEY);
  sessionStorage.removeItem(PART2_KEY);
}

// Results.tsx reads this first so the client's own results page never has to
// re-fetch the row it just created (the same near-real-time OneDrive lookup
// gap this whole module exists to avoid). A page refresh or a link opened
// later falls back to the network fetch, which is fine by then.
const RESULT_KEY = "rtq:result";

export function saveResult(response: RtqResponse): void {
  sessionStorage.setItem(RESULT_KEY, JSON.stringify(response));
}

export function loadResult(id: string): RtqResponse | undefined {
  const raw = sessionStorage.getItem(RESULT_KEY);
  if (!raw) return undefined;
  const response = JSON.parse(raw) as RtqResponse;
  return response.id === id ? response : undefined;
}
