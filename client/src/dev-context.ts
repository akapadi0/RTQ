// Synthetic ShellRuntimeContext for local preview only (main.tsx). Gives
// getPlannerXchangeContext() something to return so px-data.ts/px-email.ts
// don't throw — isShellHosted() still correctly evaluates false here (no
// authenticatedFetch), so all data/email calls fall back to their in-memory
// mock behavior, same pattern as the sibling PX apps' dev-context.ts.
import type { ShellRuntimeContext } from "./plannerxchange";

export const mockRuntimeContext: ShellRuntimeContext = {
  idToken: "synthetic-dev-token",
  apiBaseUrl: "",
  tenantId: "synthetic-marketplace-tenant",
  enterpriseId: "synthetic-enterprise",
  firmId: "synthetic-demo-firm",
  userId: "synthetic-advisor-user-001",
  userType: "firm_user",
  role: "advisor_user",
  appId: "wealthiq-rtq-ips",
  appInstallationId: "synthetic-installation-context",
  publicationEnvironment: "dev",
  visibility: "private",
  dataPortabilityMode: "plannerxchange_portable",
  permissions: ["branding.read", "app_data.read", "app_data.write", "email.send"],
  branding: {
    tenantId: "synthetic-marketplace-tenant",
    primaryColor: "#1b2a47",
    secondaryColor: "#c99a3e",
    fontColor: "#1a2332",
  },
  legal: {
    tenantId: "synthetic-marketplace-tenant",
    disclosureText: "Synthetic local preview data only.",
  },
  appBasename: "/",
  shellAppBasename: "/apps/wealthiq-rtq-ips",
  initialPath: "/",
  navigate: () => undefined,
};
