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

export type RtqStatus = "part1_complete" | "submitted" | "ips_ready";

export interface RtqResponse {
  id: string;
  clientName: string;
  clientEmail: string;
  status: RtqStatus;
  part1?: Part1Answers;
  part2?: Part2Answers;
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

export async function createRtqResponse(input: { clientName: string; clientEmail: string; part1: Part1Answers }): Promise<RtqResponse> {
  const context = getPlannerXchangeContext();
  const record: RtqResponse = {
    id: crypto.randomUUID(),
    clientName: input.clientName,
    clientEmail: input.clientEmail,
    status: "part1_complete",
    part1: input.part1,
    createdAt: new Date().toISOString(),
  };

  if (isPublicDemo(context) || !isShellHosted(context)) {
    mockStore.set(record.id, record);
    return record;
  }

  const created = await requestJson<AppDataRecord>("/app-data", {
    method: "POST",
    headers: { "content-type": "application/json" },
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

async function findRecord(id: string): Promise<AppDataRecord | undefined> {
  const page = await requestJson<ListPage<AppDataRecord>>(`/app-data?recordType=${RECORD_TYPE}&limit=200`);
  return page.items.find((r) => r.payload.id === id || r.recordId === id);
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
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ payload: next }),
  });
  return next;
}

export async function submitPart2(id: string, part2: Part2Answers): Promise<RtqResponse> {
  return patchPayload(id, { part2, status: "submitted", submittedAt: new Date().toISOString() });
}

export async function setCapacityInputs(id: string, capacityInputs: CapacityInputs, advisorNotes?: string): Promise<RtqResponse> {
  return patchPayload(id, { capacityInputs, advisorNotes, status: "ips_ready" });
}

export async function listRtqResponses(): Promise<RtqResponse[]> {
  const context = getPlannerXchangeContext();
  if (isPublicDemo(context) || !isShellHosted(context)) {
    return Array.from(mockStore.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const page = await requestJson<ListPage<AppDataRecord>>(`/app-data?recordType=${RECORD_TYPE}&limit=200`);
  return page.items.map((r) => r.payload).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
