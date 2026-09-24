import type { PlannerXchangeFetchLike, ShellRuntimeContext } from "../plannerxchange";

export interface PlannerXchangeEmailMessage {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
}

export interface PlannerXchangeEmailAvailability {
  available: boolean;
  message: string;
}

export interface PlannerXchangeEmailAcceptance {
  messageId: string;
  sentAt: string;
  sendingIdentity: string;
  status: "queued";
}

type EmailRuntimeContext = Pick<
  ShellRuntimeContext,
  "apiBaseUrl" | "permissions" | "runtimeMode" | "isDemoMode" | "authenticatedFetch"
>;

let runtimeContext: EmailRuntimeContext | null = null;

export function configurePlannerXchangeEmail(context?: EmailRuntimeContext): void {
  runtimeContext = context ?? null;
}

export function canSendPlannerXchangeEmail(): boolean {
  return getPlannerXchangeEmailAvailability().available;
}

export function getPlannerXchangeEmailAvailability(): PlannerXchangeEmailAvailability {
  if (!runtimeContext || !runtimeContext.authenticatedFetch) {
    return {
      available: false,
      message: "Open the installed app inside PlannerXchange to send email.",
    };
  }
  if (runtimeContext.runtimeMode === "public_demo" || runtimeContext.isDemoMode === true) {
    return {
      available: false,
      message: "Email is unavailable in the public demo. Install the app to send results.",
    };
  }
  if (!runtimeContext.permissions.includes("email.send")) {
    return {
      available: false,
      message: "This installation needs email permission. In PX My Apps, choose Review update permissions and approve email.send, then reopen the app.",
    };
  }
  return { available: true, message: "Email is ready." };
}

function isEmailAcceptance(value: unknown): value is PlannerXchangeEmailAcceptance {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<PlannerXchangeEmailAcceptance>;
  return result.status === "queued"
    && typeof result.messageId === "string"
    && result.messageId.length > 0
    && typeof result.sentAt === "string"
    && result.sentAt.length > 0
    && typeof result.sendingIdentity === "string"
    && result.sendingIdentity.length > 0;
}

function emailFailureMessage(status: number): string {
  if (status === 400) return "Check the recipient email address and try again.";
  if (status === 403) return "Email permission is not active. In PX My Apps, review this app's update permissions.";
  if (status === 404) return "This app installation is not active. Reopen it from PX My Apps.";
  return "PlannerXchange could not confirm whether the email was accepted. Do not resend yet.";
}

export async function sendPlannerXchangeEmail(message: PlannerXchangeEmailMessage): Promise<PlannerXchangeEmailAcceptance> {
  const context = runtimeContext;
  if (!context || context.runtimeMode === "public_demo" || context.isDemoMode === true) {
    throw new Error("Email is unavailable in public demo mode.");
  }
  if (!context.permissions.includes("email.send")) {
    throw new Error("This installation has not granted permission to send email.");
  }
  if (!context.authenticatedFetch) {
    throw new Error("Email is available when this app is opened in PlannerXchange.");
  }

  const base = context.apiBaseUrl.replace(/\/$/, "");
  let response;
  try {
    response = await (context.authenticatedFetch as PlannerXchangeFetchLike)(
      `${base}/app-email/send`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          to: message.to,
          subject: message.subject,
          htmlBody: message.htmlBody,
          ...(message.textBody === undefined ? {} : { textBody: message.textBody }),
        }),
      },
    );
  } catch {
    throw new Error("PlannerXchange could not confirm whether the email was accepted. Do not resend yet.");
  }

  if (!response.ok) {
    await response.json().catch(() => ({}));
    throw new Error(emailFailureMessage(response.status));
  }

  const payload = await response.json().catch(() => null);
  if (!isEmailAcceptance(payload)) {
    throw new Error("PlannerXchange returned an unconfirmed email result. Do not resend yet.");
  }
  return payload;
}
