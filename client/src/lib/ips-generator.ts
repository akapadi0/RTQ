/**
 * Populates a .pptx IPS from an RTQ response and triggers a browser
 * download — runs entirely client-side (pptxgenjs supports both Node and
 * browser output), which is what makes this app backend-free on
 * PlannerXchange. Same distribution format as Wealth IQ's existing Proposal
 * Generator (branded PPTX, manually reviewed before sending), deliberately
 * not a PDF — the firm already tried an HTML/browser-print-to-PDF pipeline
 * for the Proposal Generator and abandoned it as unreliable.
 *
 * Section structure and language mirror the firm's own template
 * (WealthIQKnowledgeBase/Investment process/IPS template.pptx) and the real
 * filled example (Wealth IQ/CLIENT FILES/Linda Sun/IPS_Linda Sun.pptx).
 */
import PptxGenJS from "pptxgenjs";
import type { RtqResponse } from "./px-data";
import { summarizePart1, totalScore, scoreToTier, scoreCapacity, computeDivergence, predictedActualGap, cashNeedsRollup } from "@shared/scoring";
import { LIFE_RISK_CATEGORIES } from "@shared/rtq-content";

const NAVY = "1B2A47";
const GOLD = "C99A3E";
const INK = "1A2332";

function titleSlide(pptx: PptxGenJS, clientName: string) {
  const slide = pptx.addSlide();
  slide.background = { color: NAVY };
  slide.addText(`INVESTMENT POLICY STATEMENT — ${clientName.toUpperCase()}`, {
    x: 0.6, y: 2.2, w: 9, h: 1.2, fontSize: 28, bold: true, color: "FFFFFF", fontFace: "Inter",
  });
  slide.addText(new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), {
    x: 0.6, y: 3.3, w: 9, h: 0.5, fontSize: 14, color: GOLD, fontFace: "Inter",
  });
}

function contentSlide(pptx: PptxGenJS, title: string, bullets: string[]) {
  const slide = pptx.addSlide();
  slide.addText(title, { x: 0.5, y: 0.4, w: 9, h: 0.6, fontSize: 22, bold: true, color: NAVY, fontFace: "Inter" });
  slide.addText(
    bullets.map((b) => ({ text: b, options: { bullet: true, breakLine: true, color: INK, fontSize: 14 } })),
    { x: 0.6, y: 1.2, w: 8.8, h: 5.5, fontFace: "Inter" }
  );
  return slide;
}

const categoryLabel = (id: string) => LIFE_RISK_CATEGORIES.find((c) => c.id === id)?.label ?? id;

export async function generateIps(response: RtqResponse): Promise<void> {
  if (!response.part1 || !response.part2 || !response.capacityInputs) {
    throw new Error("Cannot generate IPS: RTQ is missing Part 1, Part 2, or advisor capacity inputs.");
  }

  const pptx = new PptxGenJS();
  const part1 = summarizePart1(response.part1);
  const score = totalScore(response.part2);
  const band = scoreToTier(score);
  const capacity = scoreCapacity(response.capacityInputs);
  const divergence = computeDivergence(capacity.adjustedScore, score);
  const gap = predictedActualGap(response.part2);
  const cashRollup = cashNeedsRollup(response.capacityInputs.cashNeeds, response.capacityInputs.investableAssets);
  const { career, investableAssets, age, targetRetirementAge } = response.capacityInputs;
  const yearsToRetirement = targetRetirementAge ? targetRetirementAge - age : undefined;

  titleSlide(pptx, response.clientName);

  contentSlide(pptx, "Background", [
    `This IPS document is created for ${response.clientName}, age ${age}${career ? `, ${career}` : ""}.`,
    `Primary concern weighing on the client: ${categoryLabel(part1.topCategory)} (secondary: ${categoryLabel(part1.secondCategory)}).`,
    response.part1.freeText1 ? `Client-shared context: "${response.part1.freeText1}"` : "No additional context shared in the questionnaire.",
    "[Advisor: add background discussed in the planning meeting — family, goals, charitable intent.]",
  ]);

  contentSlide(pptx, "Financial Snapshot", [
    investableAssets ? `Investable assets: ~$${investableAssets.toLocaleString()}.` : "[Advisor: investable assets]",
    yearsToRetirement !== undefined ? `Time horizon: ${yearsToRetirement} years to target retirement age ${targetRetirementAge}.` : "[Advisor: target retirement age / time horizon]",
  ]);

  contentSlide(pptx, "Return Objectives", [
    "[Advisor: state required rate of return and volatility objective based on the client's financial plan.]",
    "[Advisor: note any goal-based objective agnostic to returns.]",
  ]);

  contentSlide(pptx, "Risk Tolerance", [
    `Initial ability score: ${capacity.initialScore}/100 (${capacity.initialTier.label}) — based on age/time horizon, income stability, and goal coverage.`,
    cashRollup.message ? `Near-term cash needs: ${cashRollup.message}` : "No near-term cash needs flagged.",
    capacity.liquidityPenalty > 0
      ? `Adjusted ability score: ${capacity.adjustedScore}/100 (${capacity.tier.label}) — reduced ${capacity.liquidityPenalty} pts for the near-term liquidity needs above.`
      : `Adjusted ability score: ${capacity.adjustedScore}/100 (${capacity.tier.label}) — no adjustment; no near-term liquidity needs flagged.`,
    `Desire to take risk (RTQ result): ${band.label} — score ${score}/104. ${band.description}`,
    divergence.flagged
      ? `Capacity and desire diverge meaningfully (${divergence.direction === "capacity_exceeds_desire" ? "capacity exceeds desire" : "desire exceeds capacity"}) — flagged for a deeper conversation about markets and time horizon before finalizing allocation.`
      : "Capacity and desire are broadly aligned.",
    gap.message ?? "No gap between predicted and actual downturn behavior.",
    `Client completed the RTQ on ${response.submittedAt ? new Date(response.submittedAt).toLocaleDateString() : "[date]"}.`,
  ]);

  contentSlide(pptx, "Constraints", [
    yearsToRetirement !== undefined ? `Time horizon: ${yearsToRetirement} years.` : "[Advisor: time horizon]",
    "[Advisor: liquidity needs beyond the near-term draws already factored into Risk Tolerance/Ability, above]",
    "[Advisor: tax bracket / considerations]",
    "[Advisor: legal and regulatory]",
    "[Advisor: unique circumstances]",
    "[Advisor: ESG / SRI preferences]",
  ]);

  contentSlide(pptx, "Asset allocation", [
    `Based on the above, ${response.clientName} is suited for a "${band.label}" allocation: ${band.allocationNarrative}.`,
    "[Advisor: translate this band into the firm's model portfolio — kept as a narrative category here, not a fixed %, to preserve flexibility.]",
    "Allocation will be reviewed annually; rebalanced on a 5% strategic drift / 15% tactical band, or ad hoc during severe volatility (per Wealth IQ Investment Philosophy & Process).",
  ]);

  contentSlide(pptx, "Investment Monitoring", [
    "[Advisor: statement/reporting cadence]",
    "Client will inform the advisor of any change in circumstances that would warrant a reallocation; Wealth IQ will proactively reach out if a change is needed.",
  ]);

  contentSlide(pptx, "Methodology & AI-Use Disclosure", [
    "Risk scoring in this IPS is produced by deterministic, rules-based logic — a 7-question point-sum mapped to a fixed set of score bands, with capacity additionally adjusted for near-term liquidity needs. No AI model makes or influences the risk-tolerance or suitability determination at runtime.",
    "AI tooling (Claude) was used only to help build and draft this application's code and document templates — the same 'administrative and drafting support' category described in the firm's AI policy reference materials (see Two Trails AI Tools Data Handling Policy / ADV Disclosure Language templates on file), not to perform investment analysis or suitability determination.",
    `Capacity: initial ${capacity.initialScore}/100 (${capacity.initialTier.label}) → adjusted ${capacity.adjustedScore}/100 (${capacity.tier.label}). RTQ score: ${score}/104 (${band.label}).`,
    "Score bands are provisional — recalibrate after the first 20–30 real submissions cluster.",
    "[Advisor / compliance: review this section and the firm's own ADV Item 4 / Item 8 language before treating this IPS as exam-ready — do not file without that review.]",
  ]);

  await pptx.writeFile({ fileName: `IPS_${response.clientName.replace(/\s+/g, "_")}.pptx` });
}
