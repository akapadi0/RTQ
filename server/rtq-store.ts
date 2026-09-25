/**
 * Persistence: one JSON file per response in OneDrive
 * ("Wealth IQ/COMPLIANCE/Suitability/records/<id>.json"), addressed directly
 * by a deterministic filename — never a search/$filter lookup.
 *
 * This replaces an earlier design that kept everything in one shared,
 * continually-modified Excel workbook. Under the rapid repeated
 * modification that design produced, that workbook's content reads started
 * lagging real writes by well over a minute on this SharePoint-backed drive
 * — confirmed directly, including on a fresh test row waited on for 90+
 * seconds. A low-write-count file (created once, updated at most once more)
 * round-trips reliably by exact id, confirmed directly against this same
 * drive (immediate through +20s). Individual record reads/writes now never
 * search for the file at all — they address it by the id-derived filename
 * directly under a known parent folder id.
 *
 * The audit-ready Excel workbook Aditi wants is still produced —
 * compileWorkbook() rebuilds it fresh from every record file, on demand
 * (the advisor list's "Refresh Suitability Log") rather than on every
 * write. Per Aditi (2026-09-24): fine for this to be something she pulls on
 * a recurring basis rather than something that updates live.
 */
import ExcelJS from "exceljs";
import { readFileBufferByPath, writeFileBufferToParent, ensureChildFolder, listChildren } from "./graph-service";
import type { RtqResponse, ResultSnapshot } from "@shared/rtq-store-types";
import type { Part1Answers, Part2Answers, ClientTimeHorizon, CapacityInputs } from "@shared/answer-types";
import { categoryLabel, predictedActualGap, cashNeedsRollup, scoreCapacity } from "@shared/scoring";

const RECORDS_SUBFOLDER = "records";
const WORKBOOK_NAME = "RTQ Suitability Log.xlsx";
const SHEET_NAME = "Suitability Log";

function suitabilityFolderId(): string {
  const id = process.env.SUITABILITY_FOLDER_ID;
  if (!id) throw new Error("SUITABILITY_FOLDER_ID is not set — resolve Aditi's Suitability folder share link once and set this env var.");
  return id;
}

let cachedRecordsFolderId: string | undefined;

/** Resolves once per warm process (or immediately, if RECORDS_FOLDER_ID is set) — never on the per-record read/write path. */
async function recordsFolderId(): Promise<string> {
  if (process.env.RECORDS_FOLDER_ID) return process.env.RECORDS_FOLDER_ID;
  if (cachedRecordsFolderId) return cachedRecordsFolderId;
  cachedRecordsFolderId = await ensureChildFolder(suitabilityFolderId(), RECORDS_SUBFOLDER);
  return cachedRecordsFolderId;
}

function recordFileName(id: string): string {
  return `${id}.json`;
}

async function readRecord(id: string): Promise<RtqResponse | undefined> {
  const folderId = await recordsFolderId();
  const buf = await readFileBufferByPath(folderId, recordFileName(id));
  return buf ? (JSON.parse(buf.toString("utf8")) as RtqResponse) : undefined;
}

async function writeRecord(response: RtqResponse): Promise<void> {
  const folderId = await recordsFolderId();
  await writeFileBufferToParent(
    folderId,
    recordFileName(response.id),
    Buffer.from(JSON.stringify(response, null, 2)),
    "application/json"
  );
}

/** Creates the complete record in one write — Part 1 + Part 2 + computed score, all in a single new file. */
export async function createRtqResponse(input: {
  clientName: string;
  clientEmail: string;
  part1: Part1Answers;
  part2: Part2Answers;
  clientTimeHorizon: ClientTimeHorizon;
  resultSnapshot: ResultSnapshot;
}): Promise<RtqResponse> {
  const now = new Date().toISOString();
  const response: RtqResponse = {
    id: crypto.randomUUID(),
    clientName: input.clientName,
    clientEmail: input.clientEmail,
    status: "submitted",
    createdAt: now,
    submittedAt: now,
    part1: input.part1,
    part2: input.part2,
    clientTimeHorizon: input.clientTimeHorizon,
    resultSnapshot: input.resultSnapshot,
  };
  await writeRecord(response);
  return response;
}

export async function getRtqResponse(id: string): Promise<RtqResponse | undefined> {
  return readRecord(id);
}

async function patchResponse(id: string, patch: Partial<RtqResponse>): Promise<RtqResponse> {
  const current = await readRecord(id);
  if (!current) throw new Error(`RTQ response ${id} not found`);
  const next: RtqResponse = { ...current, ...patch };
  await writeRecord(next);
  return next;
}

export async function setCapacityInputs(id: string, capacityInputs: CapacityInputs, advisorNotes?: string): Promise<RtqResponse> {
  return patchResponse(id, { capacityInputs, advisorNotes, status: "ips_ready" });
}

export async function markIpsGenerated(id: string, ipsFileName: string): Promise<RtqResponse> {
  return patchResponse(id, { ipsGeneratedAt: new Date().toISOString(), ipsFileName });
}

export async function listRtqResponses(): Promise<RtqResponse[]> {
  const folderId = await recordsFolderId();
  const children = await listChildren(folderId);
  const records = await Promise.all(
    children
      .filter((c) => c.name.endsWith(".json"))
      .map(async (c) => {
        const buf = await readFileBufferByPath(folderId, c.name);
        return buf ? (JSON.parse(buf.toString("utf8")) as RtqResponse) : undefined;
      })
  );
  return records.filter((r): r is RtqResponse => !!r).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ---- Audit-ready Excel export --------------------------------------------
// Rebuilt fresh from the record files above, on demand — see the file-level
// comment for why this is no longer a live-updated store.

const COLUMNS = [
  { header: "ID", key: "id", width: 24 },
  { header: "Client Name", key: "clientName", width: 22 },
  { header: "Client Email", key: "clientEmail", width: 26 },
  { header: "Status", key: "status", width: 16 },
  { header: "Created", key: "createdAt", width: 20 },
  { header: "Submitted", key: "submittedAt", width: 20 },
  { header: "IPS Generated", key: "ipsGeneratedAt", width: 20 },
  { header: "RTQ Score (/100)", key: "riskScore", width: 16 },
  { header: "Risk Tier", key: "riskTier", width: 14 },
  { header: "Ability (Initial)", key: "abilityInitial", width: 16 },
  { header: "Ability (Adjusted)", key: "abilityAdjusted", width: 18 },
  { header: "Capacity/Desire Divergence", key: "divergence", width: 24 },
  { header: "Predicted-vs-Actual Gap", key: "gapFlag", width: 40 },
  { header: "Near-Term Cash Needs", key: "cashNeedsFlag", width: 40 },
  { header: "Top Life-Risk Concern", key: "topConcern", width: 20 },
  { header: "IPS File", key: "ipsFileName", width: 30 },
  { header: "Advisor Notes", key: "advisorNotes", width: 30 },
] as const;

function deriveSummaryFields(r: RtqResponse) {
  const topConcern = categoryLabel(r.part1.categoryRank[0]);
  let abilityInitial = "";
  let abilityAdjusted = "";
  let divergence = "";
  if (r.capacityInputs) {
    const capacity = scoreCapacity(r.capacityInputs);
    abilityInitial = `${capacity.initialScore}/100 (${capacity.initialTier.label})`;
    abilityAdjusted = `${capacity.adjustedScore}/100 (${capacity.tier.label})`;
    const gapPts = capacity.adjustedScore - r.resultSnapshot.score;
    divergence = Math.abs(gapPts) >= 25 ? (gapPts > 0 ? "Capacity exceeds desire" : "Desire exceeds capacity") : "Aligned";
  }
  const gapFlag = predictedActualGap(r.part2).message ?? "";
  const cashNeedsFlag = r.capacityInputs ? cashNeedsRollup(r.capacityInputs.cashNeeds, r.capacityInputs.investableAssets).message ?? "" : "";
  return { topConcern, abilityInitial, abilityAdjusted, divergence, gapFlag, cashNeedsFlag };
}

function responseToRowValues(r: RtqResponse): Record<string, unknown> {
  const derived = deriveSummaryFields(r);
  return {
    id: r.id,
    clientName: r.clientName,
    clientEmail: r.clientEmail,
    status: r.status,
    createdAt: r.createdAt,
    submittedAt: r.submittedAt,
    ipsGeneratedAt: r.ipsGeneratedAt ?? "",
    riskScore: r.resultSnapshot.score,
    riskTier: r.resultSnapshot.tierLabel,
    abilityInitial: derived.abilityInitial,
    abilityAdjusted: derived.abilityAdjusted,
    divergence: derived.divergence,
    gapFlag: derived.gapFlag,
    cashNeedsFlag: derived.cashNeedsFlag,
    topConcern: derived.topConcern,
    ipsFileName: r.ipsFileName ?? "",
    advisorNotes: r.advisorNotes ?? "",
  };
}

export async function compileWorkbook(): Promise<Buffer> {
  const responses = await listRtqResponses();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(SHEET_NAME);
  sheet.columns = COLUMNS as unknown as Partial<ExcelJS.Column>[];
  sheet.getRow(1).font = { bold: true };
  for (const r of responses.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    sheet.addRow(responseToRowValues(r));
  }
  return (await workbook.xlsx.writeBuffer()) as Buffer;
}

/** Rebuilds the audit-ready workbook and saves it into the Suitability folder, overwriting the previous compiled copy (the record files, never overwritten, remain the source of truth). */
export async function saveCompiledWorkbookToOneDrive(): Promise<void> {
  const buffer = await compileWorkbook();
  await writeFileBufferToParent(
    suitabilityFolderId(),
    WORKBOOK_NAME,
    buffer,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}
