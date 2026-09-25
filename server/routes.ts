import { Router, type Request, type Response, type NextFunction, type RequestHandler } from "express";
import { z } from "zod";
import { part1AnswersSchema, part2AnswersSchema, capacityInputsSchema } from "@shared/answer-types";
import * as store from "./rtq-store";
import { sendRtqReport, sendIpsEmail } from "./email";
import { generateIpsPdf, ipsFileName } from "./pdf-generator";
import { scoreOutOf100, scoreToTier } from "@shared/scoring";
import { writeFileBufferToParent, ensureChildFolder } from "./graph-service";

export const router = Router();

// Express 4 doesn't forward a rejected async handler's error to `next` on its
// own — without this, a thrown error (e.g. the OneDrive lookup below timing
// out) leaves the request hanging instead of producing a response.
function asyncHandler(handler: (req: Request, res: Response) => Promise<unknown>): RequestHandler {
  return (req, res, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}

// A row created moments ago can briefly appear missing — this OneDrive
// drive's file lookup has been observed to lag real writes by well over a
// minute under load. Surfaced as 503 (retry shortly) rather than 404 (does
// not exist), so the client can show "still syncing" instead of an error.
const SYNC_LAG_MESSAGE = "This record may still be syncing from OneDrive — try again in a minute.";

// Client fills Part 1 and Part 2 in the browser (answers carried forward
// client-side, not persisted mid-flow) and submits everything here in one
// shot, written as a single new record file addressed by its own id — no
// search/lookup involved in creating it.
router.post("/api/rtq", asyncHandler(async (req, res) => {
  const schema = z.object({
    clientName: z.string().min(1),
    clientEmail: z.string().email(),
    part1: part1AnswersSchema,
    part2: part2AnswersSchema,
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const score = scoreOutOf100(parsed.data.part2);
  const band = scoreToTier(score);
  const resultSnapshot = {
    score,
    tierLabel: band.label,
    tierDescription: band.description,
    allocationNarrative: band.allocationNarrative,
    computedAt: new Date().toISOString(),
  };

  const row = await store.createRtqResponse({ ...parsed.data, resultSnapshot });
  await sendRtqReport({
    clientName: row.clientName,
    clientEmail: row.clientEmail,
    part1: row.part1,
    part2: row.part2,
    resultSnapshot: row.resultSnapshot,
  });
  res.json(row);
}));

router.post("/api/rtq/:id/capacity", asyncHandler(async (req, res) => {
  const bodySchema = z.object({ capacity: capacityInputsSchema, advisorNotes: z.string().optional() });
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.flatten() });
  try {
    const row = await store.setCapacityInputs(req.params.id, parsed.data.capacity, parsed.data.advisorNotes);
    res.json({ ok: true, status: row.status });
  } catch {
    res.status(503).json({ error: SYNC_LAG_MESSAGE });
  }
}));

// Generates the IPS PDF, emails it (client + advisor), saves a copy to the
// OneDrive Suitability folder, and streams the PDF back so the advisor also
// gets it immediately in the browser.
router.get("/api/rtq/:id/ips", asyncHandler(async (req, res) => {
  const row = await store.getRtqResponse(req.params.id);
  if (!row) return void res.status(503).json({ error: SYNC_LAG_MESSAGE });

  try {
    const pdfBuffer = await generateIpsPdf(row);
    const fileName = ipsFileName(row.clientName);

    const suitabilityFolderId = process.env.SUITABILITY_FOLDER_ID;
    if (!suitabilityFolderId) throw new Error("SUITABILITY_FOLDER_ID is not set.");
    const clientFolderId = await ensureChildFolder(suitabilityFolderId, row.clientName);
    await writeFileBufferToParent(clientFolderId, fileName, pdfBuffer, "application/pdf");
    await store.markIpsGenerated(row.id, fileName);
    await sendIpsEmail({
      clientName: row.clientName,
      clientEmail: row.clientEmail,
      resultSnapshot: row.resultSnapshot,
      pdfBuffer,
      pdfFileName: fileName,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(pdfBuffer);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to generate IPS" });
  }
}));

// Rebuilds the audit-ready Excel workbook from every record file, saves it
// into the Suitability folder (overwriting the previous compiled copy — the
// record files underneath are never overwritten), and streams it back so
// the advisor can also save/open it immediately. Registered before
// "/api/rtq/:id" so "export" isn't swallowed as an :id.
router.get("/api/rtq/export", asyncHandler(async (_req, res) => {
  const buffer = await store.compileWorkbook();
  await store.saveCompiledWorkbookToOneDrive();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="RTQ Suitability Log.xlsx"`);
  res.send(buffer);
}));

router.get("/api/rtq/:id", asyncHandler(async (req, res) => {
  const row = await store.getRtqResponse(req.params.id);
  if (!row) return void res.status(503).json({ error: SYNC_LAG_MESSAGE });
  res.json(row);
}));

router.get("/api/rtq", asyncHandler(async (_req, res) => {
  res.json(await store.listRtqResponses());
}));
