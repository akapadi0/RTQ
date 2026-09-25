/**
 * Generates the IPS as an actual PDF (pdfkit — pure Node, deterministic,
 * no headless-browser rendering) instead of the earlier client-side .pptx
 * download. The firm's own Proposal Generator already tried an HTML/
 * browser-print-to-PDF pipeline and abandoned it as unreliable; pdfkit
 * avoids that failure mode entirely since it never involves a browser.
 *
 * Section structure mirrors the firm's own template
 * (WealthIQKnowledgeBase/Investment process/IPS template.pptx) and the real
 * filled example (Wealth IQ/CLIENT FILES/Linda Sun/IPS_Linda Sun.pptx).
 */
import PDFDocument from "pdfkit";
import type { RtqResponse } from "@shared/rtq-store-types";
import { summarizePart1, scoreCapacity, computeDivergence, predictedActualGap, cashNeedsRollup, categoryLabel } from "@shared/scoring";

const NAVY = "#1B2A47";
const GOLD = "#C99A3E";
const INK = "#1A2332";

function heading(doc: PDFKit.PDFDocument, text: string) {
  doc.moveDown(1.2);
  doc.fillColor(NAVY).fontSize(16).font("Helvetica-Bold").text(text);
  doc.moveDown(0.3);
  doc.fillColor(INK).fontSize(11).font("Helvetica");
}

function bullets(doc: PDFKit.PDFDocument, items: string[]) {
  for (const item of items) {
    doc.circle(doc.x + 2, doc.y + 6, 1.5).fill(INK);
    doc.fillColor(INK).text(`  ${item}`, doc.x + 8, doc.y - 2, { indent: 0 });
    doc.moveDown(0.4);
  }
}

/** Filename includes a date so re-generating an IPS never overwrites a prior version — each is its own retained record. */
export function ipsFileName(clientName: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `IPS_${clientName.replace(/\s+/g, "_")}_${date}.pdf`;
}

export async function generateIpsPdf(response: RtqResponse): Promise<Buffer> {
  if (!response.part1 || !response.part2 || !response.resultSnapshot || !response.capacityInputs) {
    throw new Error("Cannot generate IPS: RTQ is missing Part 1, Part 2, or advisor capacity inputs.");
  }

  const part1 = summarizePart1(response.part1);
  const { score, tierLabel, tierDescription, allocationNarrative } = response.resultSnapshot;
  const capacity = scoreCapacity(response.capacityInputs);
  const divergence = computeDivergence(capacity.adjustedScore, score);
  const gap = predictedActualGap(response.part2);
  const cashRollup = cashNeedsRollup(response.capacityInputs.cashNeeds, response.capacityInputs.investableAssets);
  const { career, investableAssets, age, targetRetirementAge } = response.capacityInputs;
  const yearsToRetirement = targetRetirementAge ? targetRetirementAge - age : undefined;

  const chunks: Buffer[] = [];
  const doc = new PDFDocument({ size: "LETTER", margins: { top: 60, bottom: 60, left: 64, right: 64 } });
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  // Title
  doc.rect(0, 0, doc.page.width, 180).fill(NAVY);
  doc.fillColor("#FFFFFF").fontSize(24).font("Helvetica-Bold").text(`INVESTMENT POLICY STATEMENT`, 64, 70, { width: doc.page.width - 128 });
  doc.fontSize(18).text(response.clientName.toUpperCase(), 64, 104);
  doc.fillColor(GOLD).fontSize(11).font("Helvetica").text(new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), 64, 140);
  doc.y = 200;

  heading(doc, "Background");
  bullets(doc, [
    `This IPS document is created for ${response.clientName}, age ${age}${career ? `, ${career}` : ""}.`,
    `Primary concern weighing on the client: ${categoryLabel(part1.topCategory)} (secondary: ${categoryLabel(part1.secondCategory)}).`,
    response.part1.freeText1 ? `Client-shared context: "${response.part1.freeText1}"` : "No additional context shared in the questionnaire.",
    "[Advisor: add background discussed in the planning meeting — family, goals, charitable intent.]",
  ]);

  heading(doc, "Financial Snapshot");
  bullets(doc, [
    investableAssets ? `Investable assets: ~$${investableAssets.toLocaleString()}.` : "[Advisor: investable assets]",
    yearsToRetirement !== undefined ? `Time horizon: ${yearsToRetirement} years to target retirement age ${targetRetirementAge}.` : "[Advisor: target retirement age / time horizon]",
  ]);

  heading(doc, "Return Objectives");
  bullets(doc, [
    "[Advisor: state required rate of return and volatility objective based on the client's financial plan.]",
    "[Advisor: note any goal-based objective agnostic to returns.]",
  ]);

  heading(doc, "Risk Tolerance");
  bullets(doc, [
    `Initial ability score: ${capacity.initialScore}/100 (${capacity.initialTier.label}) — based on age/time horizon, income stability, and goal coverage.`,
    cashRollup.message ? `Near-term cash needs: ${cashRollup.message}` : "No near-term cash needs flagged.",
    capacity.liquidityPenalty > 0
      ? `Adjusted ability score: ${capacity.adjustedScore}/100 (${capacity.tier.label}) — reduced ${capacity.liquidityPenalty} pts for the near-term liquidity needs above.`
      : `Adjusted ability score: ${capacity.adjustedScore}/100 (${capacity.tier.label}) — no adjustment; no near-term liquidity needs flagged.`,
    `Desire to take risk (RTQ result): ${tierLabel} — score ${score}/100. ${tierDescription}`,
    divergence.flagged
      ? `Capacity and desire diverge meaningfully (${divergence.direction === "capacity_exceeds_desire" ? "capacity exceeds desire" : "desire exceeds capacity"}) — flagged for a deeper conversation about markets and time horizon before finalizing allocation.`
      : "Capacity and desire are broadly aligned.",
    gap.message ?? "No gap between predicted and actual downturn behavior.",
    `Client completed the RTQ on ${response.submittedAt ? new Date(response.submittedAt).toLocaleDateString() : "[date]"}.`,
  ]);

  heading(doc, "Constraints");
  bullets(doc, [
    yearsToRetirement !== undefined ? `Time horizon: ${yearsToRetirement} years.` : "[Advisor: time horizon]",
    "[Advisor: liquidity needs beyond the near-term draws already factored into Risk Tolerance/Ability, above]",
    "[Advisor: tax bracket / considerations]",
    "[Advisor: legal and regulatory]",
    "[Advisor: unique circumstances]",
    "[Advisor: ESG / SRI preferences]",
  ]);

  heading(doc, "Asset Allocation");
  bullets(doc, [
    `Based on the above, ${response.clientName} is suited for a "${tierLabel}" allocation: ${allocationNarrative}.`,
    "[Advisor: translate this band into the firm's model portfolio — kept as a narrative category here, not a fixed %, to preserve flexibility.]",
    "Allocation will be reviewed annually; rebalanced on a 5% strategic drift / 15% tactical band, or ad hoc during severe volatility (per Wealth IQ Investment Philosophy & Process).",
  ]);

  heading(doc, "Investment Monitoring");
  bullets(doc, [
    "[Advisor: statement/reporting cadence]",
    "Client will inform the advisor of any change in circumstances that would warrant a reallocation; Wealth IQ will proactively reach out if a change is needed.",
  ]);

  doc.addPage();
  heading(doc, "Methodology & AI-Use Disclosure");
  bullets(doc, [
    "Risk scoring in this IPS is produced by deterministic, rules-based logic — a 7-question point-sum mapped to a fixed set of score bands, with capacity additionally adjusted for near-term liquidity needs. No AI model makes or influences the risk-tolerance or suitability determination at runtime.",
    "AI tooling (Claude) was used only to help build and draft this application's code and document templates — the same 'administrative and drafting support' category described in the firm's AI policy reference materials (see Two Trails AI Tools Data Handling Policy / ADV Disclosure Language templates on file), not to perform investment analysis or suitability determination.",
    `Capacity: initial ${capacity.initialScore}/100 (${capacity.initialTier.label}) → adjusted ${capacity.adjustedScore}/100 (${capacity.tier.label}). RTQ score: ${score}/100 (${tierLabel}).`,
    "Score bands are provisional — recalibrate after the first 20–30 real submissions cluster.",
    "[Advisor / compliance: review this section and the firm's own ADV Item 4 / Item 8 language before treating this IPS as exam-ready — do not file without that review.]",
  ]);

  heading(doc, "Recordkeeping");
  bullets(doc, [
    "This document and its underlying questionnaire responses constitute written suitability information supporting the recommendations above.",
    "Retain per applicable state suitability recordkeeping rules — e.g. Colorado requires a minimum of 5 years from the end of the fiscal year in which the last entry was made (Rule 51-4.6(IA)(E)(4)). Confirm retention requirements for every state where the firm is registered.",
    "This record is preserved as a dated, non-overwritten entry in the firm's Suitability Log; re-running this questionnaire for the same client creates a new dated record rather than replacing this one.",
  ]);

  doc.end();
  return done;
}
