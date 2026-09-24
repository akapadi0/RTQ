/**
 * Persistence via PlannerXchange's own app-data store — no builder-owned
 * database. Records are scoped to this app's installation by the shell
 * (via the authenticated fetch's installation header), so a plain
 * `recordType` filter is enough; no tenant/household scoping needed since
 * an RTQ response isn't tied to an existing canonical client yet.
 *
 * Same fallback shape as the sibling PX apps: outside the shell (local dev,
 * public demo) everything lives in an in-memory Map so `npm run dev` works
 * with no PlannerXchange connection at all.
 */
import { getPlannerXchangeContext, isPublicDemo, isShellHosted } from "@/plannerxchange";
import type { PlannerXchangeApiRequestInit } from "@/plannerxchange";
import type { Part1Answers, Part2Answers, CapacityInputs } from "@shared/answer-types";
import { totalScore, scoreToTier } from "@shared/scoring";

export type RtqStatus = "started" | "part1_complete" | "submitted" | "ips_ready";

/**
 * Frozen at the moment of submission — score bands are explicitly provisional
 * (see shared/scoring.ts) and expected to get recalibrated once real
 * submissions come in. Without this snapshot, a client's result would
 * silently change if you retune the bands later; this keeps it matching
 * what was actually shown/emailed to them at the time.
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
  part1?: Part1Answers;
  part2?: Part2Answers;
  resultSnapshot?: ResultSnapshot;
  capacityInputs?: CapacityInputs;
  advisorNotes?: string;
  createdAt: string;
  submittedAt?: string;
}

const RECORD_TYPE = "rtq_response";

interface AppDataRecord {
  recordId: string;
  recordType: string;
  status: "draft" | "final" | "archived";
  schemaVersion: number;
  payload: RtqResponse;
}

interface ListPage<T> {
  items: T[];
}

const mockStore = new Map<string, RtqResponse>();

function apiUrl(path: string): string {
  const base = getPlannerXchangeContext().apiBaseUrl.replace(/\/$/, "");
  return `${base}${path}`;
}

async function requestJson<T>(path: string, init?: PlannerXchangeApiRequestInit): Promise<T> {
  const context = getPlannerXchangeContext();
  const authenticatedFetch = context.authenticatedFetch;
  if (!authenticatedFetch) throw new Error("PlannerXchange authenticated data access is unavailable.");
  const response = await authenticatedFetch(apiUrl(path), init);
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(payload.message || `PlannerXchange app-data request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

export async function createRtqResponse(input: { clientName: string; clientEmail: string }): Promise<RtqResponse> {
  const context = getPlannerXchangeContext();
  const record: RtqResponse = {
    id: crypto.randomUUID(),
    clientName: input.clientName,
    clientEmail: input.clientEmail,
    status: "started",
    createdAt: new Date().toISOString(),
  };

  if (isPublicDemo(context) || !isShellHosted(context)) {
    mockStore.set(record.id, record);
    return record;
  }

  const created = await requestJson<AppDataRecord>("/app-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recordType: RECORD_TYPE,
      title: `RTQ — ${input.clientName}`,
      status: "draft",
      schemaVersion: 1,
      payload: record,
    }),
  });
  // The shell assigns the durable recordId — that's what future reads/writes key on.
  return { ...record, id: created.recordId };
}

/** Mirrors the PX SDK's `listAppData`/`getAppData` shape — one resolvable GET-collection call. */
async function listAppDataRecords(recordType: string): Promise<AppDataRecord[]> {
  const page = await requestJson<ListPage<AppDataRecord>>(`/app-data?recordType=${encodeURIComponent(recordType)}`);
  return page.items;
}

async function findRecord(id: string): Promise<AppDataRecord | undefined> {
  const items = await listAppDataRecords(RECORD_TYPE);
  return items.find((r) => r.payload.id === id || r.recordId === id);
}

export async function getRtqResponse(id: string): Promise<RtqResponse | undefined> {
  const context = getPlannerXchangeContext();
  if (isPublicDemo(context) || !isShellHosted(context)) return mockStore.get(id);
  const record = await findRecord(id);
  return record?.payload;
}

async function patchPayload(id: string, patch: Partial<RtqResponse>): Promise<RtqResponse> {
  const context = getPlannerXchangeContext();
  if (isPublicDemo(context) || !isShellHosted(context)) {
    const existing = mockStore.get(id);
    if (!existing) throw new Error(`RTQ response ${id} not found`);
    const next = { ...existing, ...patch };
    mockStore.set(id, next);
    return next;
  }

  const record = await findRecord(id);
  if (!record) throw new Error(`RTQ response ${id} not found`);
  const next = { ...record.payload, ...patch };
  await requestJson<AppDataRecord>(`/app-data/${encodeURIComponent(record.recordId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload: next }),
  });
  return next;
}

export async function submitPart1(id: string, part1: Part1Answers): Promise<RtqResponse> {
  return patchPayload(id, { part1, status: "part1_complete" });
}

export async function submitPart2(id: string, part2: Part2Answers): Promise<RtqResponse> {
  const score = totalScore(part2);
  const band = scoreToTier(score);
  const resultSnapshot: ResultSnapshot = {
    score,
    tierLabel: band.label,
    tierDescription: band.description,
    allocationNarrative: band.allocationNarrative,
    computedAt: new Date().toISOString(),
  };
  return patchPayload(id, { part2, resultSnapshot, status: "submitted", submittedAt: new Date().toISOString() });
}

export async function setCapacityInputs(id: string, capacityInputs: CapacityInputs, advisorNotes?: string): Promise<RtqResponse> {
  return patchPayload(id, { capacityInputs, advisorNotes, status: "ips_ready" });
}

export async function listRtqResponses(): Promise<RtqResponse[]> {
  const context = getPlannerXchangeContext();
  if (isPublicDemo(context) || !isShellHosted(context)) {
    return Array.from(mockStore.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const items = await listAppDataRecords(RECORD_TYPE);
  return items.map((r) => r.payload).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
