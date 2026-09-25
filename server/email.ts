/**
 * Outbound email — Microsoft Graph app-only sendMail, same credentials and
 * flow as WealthIQ-Money-Assessment-Product ("Money Mindset"): a
 * client-credentials token (CLIENT_ID/CLIENT_SECRET/TENANT_ID) calling
 * POST /users/{OUTLOOK_USER}/sendMail. Per Aditi (2026-09-25): reuse that
 * app's exact email setup rather than SMTP basic auth (OUTLOOK_PASS), which
 * this tenant doesn't have enabled.
 *
 * This is a separate Azure app registration/token flow from the one in
 * graph-service.ts (that one is a delegated, refresh-token-based public
 * client scoped to Files.ReadWrite for OneDrive; this one is an app-only
 * confidential client scoped to Mail.Send).
 *
 * Per Aditi (2026-09-24): both the client and the advisor get the results
 * email, and both get the final IPS + PDF, matching Money Mindset's
 * dual-recipient pattern.
 */
import type { Part1Answers, Part2Answers } from "@shared/answer-types";
import type { ResultSnapshot } from "@shared/rtq-store-types";
import { categoryLabel, concernLabel, predictedActualGap } from "@shared/scoring";

const ADVISOR_EMAIL = process.env.ADVISOR_EMAIL || "aditi@wealthiqco.com";

async function getGraphAccessToken(): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.CLIENT_ID!,
    client_secret: process.env.CLIENT_SECRET!,
    scope: "https://graph.microsoft.com/.default",
  });
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!response.ok) {
    throw new Error(`Microsoft Graph token request failed (${response.status}): ${await response.text()}`);
  }
  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

interface EmailAttachment {
  filename: string;
  contentBytes: Buffer;
  contentType: string;
}

async function sendEmail(toEmail: string, subject: string, htmlBody: string, attachments?: EmailAttachment[]): Promise<void> {
  if (!process.env.OUTLOOK_USER || !process.env.CLIENT_ID || !process.env.CLIENT_SECRET || !process.env.TENANT_ID) {
    console.warn("Email credentials not configured (OUTLOOK_USER / CLIENT_ID / CLIENT_SECRET / TENANT_ID) — skipping send.");
    return;
  }
  const accessToken = await getGraphAccessToken();
  const response = await fetch(`https://graph.microsoft.com/v1.0/users/${process.env.OUTLOOK_USER}/sendMail`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: "HTML", content: htmlBody },
        toRecipients: [{ emailAddress: { address: toEmail } }],
        attachments: attachments?.map((a) => ({
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: a.filename,
          contentType: a.contentType,
          contentBytes: a.contentBytes.toString("base64"),
        })),
      },
    }),
  });
  if (!response.ok) {
    throw new Error(`Graph API sendMail failed (${response.status}): ${await response.text()}`);
  }
}

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

function tierHtml(snapshot: ResultSnapshot): string {
  return `
    <h3>Risk profile</h3>
    <p><strong>${snapshot.tierLabel}</strong> (score ${snapshot.score}/100) — ${snapshot.tierDescription}</p>
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

export async function sendRtqReport(opts: {
  clientName: string;
  clientEmail: string;
  part1: Part1Answers;
  part2: Part2Answers;
  resultSnapshot: ResultSnapshot;
}) {
  const subject = `Risk Tolerance Questionnaire results — ${opts.clientName}`;

  const clientHtml = wrap(
    opts.clientName,
    `
      ${part1Html(opts.part1)}
      ${tierHtml(opts.resultSnapshot)}
      <p style="color: #667085; font-size: 13px; margin-top: 32px;">
        This is a summary of your questionnaire responses, generated automatically.
        Your advisor will follow up to discuss these results and how they inform your plan.
      </p>
    `
  );

  // Advisor copy adds the predicted-vs-actual gap flag — advisor-facing
  // only, never shown to the client. Near-term cash needs isn't in this
  // email: it's entered later by the advisor, so there's nothing to report
  // yet at submit-time — it surfaces in the IPS once that's filled in.
  const gap = predictedActualGap(opts.part2);
  const flagsHtml = gap.message ? `<p><strong>Predicted-vs-actual gap:</strong> ${gap.message}</p>` : "<p><em>No flags raised.</em></p>";
  const advisorHtml = wrap(opts.clientName, `${part1Html(opts.part1)}${tierHtml(opts.resultSnapshot)}${flagsHtml}`);

  await sendEmail(opts.clientEmail, subject, clientHtml);
  await sendEmail(ADVISOR_EMAIL, `${subject} (advisor copy)`, advisorHtml);
}

export async function sendIpsEmail(opts: {
  clientName: string;
  clientEmail: string;
  resultSnapshot: ResultSnapshot;
  pdfBuffer: Buffer;
  pdfFileName: string;
}) {
  const subject = `Investment Policy Statement — ${opts.clientName}`;
  const html = wrap(
    opts.clientName,
    `
      ${tierHtml(opts.resultSnapshot)}
      <p>Your Investment Policy Statement is attached.</p>
    `
  );
  const attachments: EmailAttachment[] = [{ filename: opts.pdfFileName, contentBytes: opts.pdfBuffer, contentType: "application/pdf" }];

  await sendEmail(opts.clientEmail, subject, html, attachments);
  await sendEmail(ADVISOR_EMAIL, `${subject} (advisor copy)`, html, attachments);
}
