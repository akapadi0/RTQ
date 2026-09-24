import type { Part1Answers, Part2Answers } from "@shared/answer-types";
import { totalScore, scoreToTier, categoryLabel, concernLabel, predictedActualGap } from "@shared/scoring";
import { sendPlannerXchangeEmail } from "./px-email";

// The advisor inbox that gets a copy of every RTQ report. This is Aditi's own
// private tool (manifest visibility: "private"), so a fixed recipient is
// simpler than plumbing an advisor-lookup through the shell — revisit if this
// ever opens up to other advisors in the practice.
const ADVISOR_EMAIL = "aditi@wealthiqco.com";

function part1Html(part1: Part1Answers): string {
  const [top, second] = part1.categoryRank;
  const concerns = (cat: string) => part1.selectedConcerns[cat]?.map((c) => concernLabel(cat, c)).join(", ") || "";
  return `
    <h3>What's weighing on them most</h3>
    <p><strong>#1:</strong> ${categoryLabel(top)}${concerns(top) ? ` — ${concerns(top)}` : ""}<br/>
       <strong>#2:</strong> ${categoryLabel(second)}${concerns(second) ? ` — ${concerns(second)}` : ""}</p>
    ${part1.freeText1 ? `<p><strong>Financial history context:</strong> ${part1.freeText1}</p>` : ""}
    ${part1.freeText2 ? `<p><strong>Anything else:</strong> ${part1.freeText2}</p>` : ""}
  `;
}

function tierHtml(part2: Part2Answers): string {
  const score = totalScore(part2);
  const band = scoreToTier(score);
  return `
    <h3>Risk profile</h3>
    <p><strong>${band.label}</strong> (score ${score}/104) — ${band.description}</p>
  `;
}

function wrap(clientName: string, bodyHtml: string): string {
  return `
    <div style="font-family: 'Inter', Arial, sans-serif; color: #152F21; max-width: 640px;">
      <h2>Risk Tolerance Questionnaire — ${clientName}</h2>
      ${bodyHtml}
    </div>
  `;
}

export async function sendRtqReport(opts: { clientName: string; clientEmail: string; part1: Part1Answers; part2: Part2Answers }) {
  const subject = `Risk Tolerance Questionnaire results — ${opts.clientName}`;

  const clientHtml = wrap(
    opts.clientName,
    `
      ${part1Html(opts.part1)}
      ${tierHtml(opts.part2)}
      <p style="color: #667085; font-size: 13px; margin-top: 32px;">
        This is a summary of your questionnaire responses, generated automatically.
        Your advisor will follow up to discuss these results and how they inform your plan.
      </p>
    `
  );

  // Advisor copy adds the predicted-vs-actual gap flag — per spec, advisor-
  // facing only, never shown to the client. Near-term cash needs isn't in
  // this email: it's entered later, by the advisor, in the Time Horizon &
  // Client Specifics step, so there's nothing to report yet at submit-time —
  // it surfaces in the IPS once that step is filled in.
  const gap = predictedActualGap(opts.part2);
  const flagsHtml = gap.message ? `<p><strong>Predicted-vs-actual gap:</strong> ${gap.message}</p>` : "<p><em>No flags raised.</em></p>";
  const advisorHtml = wrap(
    opts.clientName,
    `
      ${part1Html(opts.part1)}
      ${tierHtml(opts.part2)}
      ${flagsHtml}
    `
  );

  await sendPlannerXchangeEmail({ to: opts.clientEmail, subject, htmlBody: clientHtml });
  await sendPlannerXchangeEmail({ to: ADVISOR_EMAIL, subject: `${subject} (advisor copy)`, htmlBody: advisorHtml });
}
