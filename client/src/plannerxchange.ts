export type UserType = "firm_user" | "client_user";
export type KnownFrontendFramework = "react" | "vue" | "nextjs" | "html-js";
export type FrontendFramework = KnownFrontendFramework | (string & {});
export type AppVisibility =
  | "private"
  | "shared_with_specific_users"
  | "marketplace_listed";
export type AppDataPortabilityMode =
  | "plannerxchange_portable"
  | "app_managed_nonportable";
export type AppDataIngressSource =
  | "csv_upload"
  | "file_upload"
  | "third_party_api"
  | "manual_paste"
  | "browser_file_parse"
  | "other";
export type AppDataClass =
  | "public"
  | "internal"
  | "confidential"
  | "restricted_pii"
  | "firm_data"
  | "client_summary"
  | "client_sensitive"
  | "crm_activity"
  | "account_data"
  | "portfolio_positions"
  | "transactions"
  | "cost_basis"
  | "security_reference"
  | "model_portfolios"
  | "app_work_product";
export type AppDataIngressTarget =
  | "px_import_session"
  | "px_app_data_upload"
  | "browser_ephemeral_app_data"
  | "enterprise_external_exception";
export type AppDataImportSessionMode = "canonical_store";
export type AppDataImportCanonicalEntity =
  | "household"
  | "client"
  | "account"
  | "position"
  | "transaction"
  | "cost_basis"
  | "security"
  | "model"
  | "model_holding"
  | "sleeve"
  | "sleeve_allocation";
export interface AppDataIngressDeclaration {
  id?: string;
  source: AppDataIngressSource;
  purpose: string;
  dataClasses: AppDataClass[];
  target: AppDataIngressTarget;
  supportedModes?: AppDataImportSessionMode[];
  canonicalEntityHints?: AppDataImportCanonicalEntity[];
  sourceFormatHints?: string[];
  canonicalMutation?: boolean;
  retention?: string;
  notes?: string;
}
export type AppCanonicalDataCategory =
  | "households"
  | "clients"
  | "accounts"
  | "positions"
  | "transactions"
  | "cost_basis"
  | "securities"
  | "models"
  | "sleeves";
export type AppCanonicalDataSelectionEntity =
  | "household"
  | "client"
  | "account"
  | "firm"
  | "model"
  | "sleeve";
export interface AppCanonicalDataAccessDeclaration {
  id?: string;
  category: AppCanonicalDataCategory;
  required: boolean;
  purpose: string;
  scopes: Array<"read" | "write">;
  selectionEntity: AppCanonicalDataSelectionEntity;
  notes?: string;
}
export type AppCanonicalDemoDataCategory =
  | AppCanonicalDataCategory
  | "crm_notes"
  | "crm_tasks";
export type AppCanonicalDemoDataObject =
  | "household"
  | "client_summary"
  | "client_detail"
  | "account"
  | "position"
  | "transaction"
  | "cost_basis"
  | "security"
  | "merged_security"
  | "model"
  | "model_holding"
  | "sleeve"
  | "sleeve_allocation"
  | "crm_note"
  | "crm_task";
export type AppCanonicalDataFieldUsageKind =
  | "display"
  | "calculation"
  | "filter"
  | "sort"
  | "selection";
export interface AppCanonicalDataUsageDeclaration {
  id: string;
  catalogVersion: "px_canonical_demo_v1";
  category: AppCanonicalDemoDataCategory;
  object: AppCanonicalDemoDataObject;
  fields: Array<{
    path: string;
    uses: AppCanonicalDataFieldUsageKind[];
  }>;
}
export interface AppDataImportSessionRequest {
  declarationId: string;
  mode?: AppDataImportSessionMode;
  entityType?: AppDataImportCanonicalEntity;
}
export interface AppDataImportSessionCanonicalStoreResult {
  mode: "canonical_store";
  /**
   * Current hosted behavior is launch-only. The shell opens the
   * PlannerXchange-owned import wizard and returns after the handoff starts.
   * Apps should refresh approved canonical reads after the user returns.
   */
  status: "launched";
}
export type AppDataImportSessionResult = AppDataImportSessionCanonicalStoreResult;
export type PlannerXchangeOpenDataImportSession = (
  request: AppDataImportSessionRequest
) => Promise<AppDataImportSessionResult>;
// Legacy summary-safe client-user routes and current canonical entity routes
// use different scope families. Student apps should prefer the `canonical.*`
// scopes when targeting `/canonical/*` APIs.
export type AppPermissionScope =
  | "tenant.read"
  | "user.read"
  | "household.read"
  | "client.summary.read"
  | "client.sensitive.read"
  | "canonical.household.read"
  | "canonical.household.write"
  | "canonical.client.summary.read"
  | "canonical.client.sensitive.read"
  | "canonical.client.write"
  | "canonical.account.read"
  | "canonical.account.write"
  | "canonical.tax.summary.read"
  | "canonical.tax.detail.read"
  | "canonical.tax.write"
  | "canonical.integration_link.write"
  | "canonical.position.read"
  | "canonical.transaction.read"
  | "canonical.cost_basis.read"
  | "canonical.security.read"
  | "canonical.security.firm_override"
  | "canonical.asset_class.write"
  | "canonical.custom_field.write"
  | "canonical.model.read"
  | "canonical.model.write"
  | "canonical.sleeve.read"
  | "canonical.crm_note.read"
  | "canonical.crm_task.read"
  | "canonical.import.read"
  | "canonical.import.write"
  | "account.read"
  | "position.read"
  | "transaction.read"
  | "cost_basis.read"
  | "security.read"
  | "model.read"
  | "app_access.read"
  | "feature_entitlements.read"
  | "branding.read"
  | "legal.read"
  | "app_data.read"
  | "app_data.write"
  | "email.send";

export interface BrandingProfile {
  tenantId: string;
  enterpriseId?: string;
  firmId?: string;
  primaryColor: string;
  secondaryColor?: string;
  fontColor?: string;
  logoUrl?: string;
  faviconUrl?: string;
  supportEmail?: string;
}

export interface LegalProfile {
  tenantId: string;
  enterpriseId?: string;
  firmId?: string;
  appId?: string;
  disclosureText: string;
  privacyPolicyUrl?: string;
  termsUrl?: string;
}

export interface PlannerXchangeManifest {
  slug: string;
  name: string;
  version: string;
  summary?: string;
  description?: string;
  priceLabel?: string;
  thumbnailUrl?: string;
  previewVideoUrl?: string;
  framework: FrontendFramework;
  /**
   * Repo-relative app source folder. Defaults to "." for simple repos.
   * entryPoint is interpreted relative to this folder.
   */
  appRoot?: string;
  /**
   * Repo-relative committed build output folder. Defaults to "dist" when
   * appRoot is ".", or "<appRoot>/dist" for nested apps.
   */
  distRoot?: string;
  workspacePackage?: string | null;
  entryPoint: string;
  permissions: AppPermissionScope[];
  configSchemaVersion: number;
  visibility: AppVisibility;
  dataPortabilityMode: AppDataPortabilityMode;
  categories: string[];
  dataIngressDeclarations?: AppDataIngressDeclaration[];
  canonicalDataAccessDeclarations?: AppCanonicalDataAccessDeclaration[];
  canonicalDataUsageDeclarations?: AppCanonicalDataUsageDeclaration[];
}

export interface PlannerXchangeApiRequestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface PlannerXchangeFetchResponseLike {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text?: () => Promise<string>;
}

export type PlannerXchangeFetchLike = (
  url: string,
  init?: PlannerXchangeApiRequestInit
) => Promise<PlannerXchangeFetchResponseLike>;

export interface PlannerXchangeNavigationOptions {
  replace?: boolean;
}

export type PlannerXchangeNavigate = (
  path: string,
  options?: PlannerXchangeNavigationOptions
) => void;

export interface ShellRuntimeContext {
  runtimeMode?: "authenticated" | "public_demo";
  isDemoMode?: boolean;
  demoDataMode?: "synthetic";
  /**
   * Deprecated for hosted apps. The PlannerXchange shell does not expose raw
   * user bearer tokens to installed app code. Use `authenticatedFetch` for
   * PlannerXchange API calls. Local mock contexts may still include a synthetic
   * placeholder string.
   */
  idToken: string;
  /**
   * Shell-managed fetch for authenticated PlannerXchange API calls. The shell
   * attaches user auth and `x-plannerxchange-app-installation-id`, and rejects
   * shell-only endpoints such as custodian integrations.
   */
  authenticatedFetch?: PlannerXchangeFetchLike;
  /**
   * Requests a shell URL update for an app-relative route such as
   * "/households/abc123". The shell validates the path and keeps navigation
   * scoped under this app's shell-owned route prefix.
   */
  navigate?: PlannerXchangeNavigate;
  /**
   * Opens a PlannerXchange-owned CSV/file import session over the app.
   * Builder apps declare the matching dataIngressDeclarations entry and pass
   * its id as declarationId. The shell owns upload, parsing, mapping,
   * validation, audit, raw-file expiry, and canonical write decisions.
   * This is a launch-only handoff and returns status "launched"; do not wait
   * for completed import statuses, importJobId, canonicalRefs, or mappingSummary.
   */
  openDataImportSession?: PlannerXchangeOpenDataImportSession;
  /**
   * The base URL for PlannerXchange API calls in the current environment.
   * Apps should use this instead of hardcoding API URLs so they work across
   * dev/staging/prod environments.
   */
  apiBaseUrl: string;
  tenantId: string;
  enterpriseId: string;
  firmId: string;
  userId: string;
  userType: UserType;
  role: string;
  appId: string;
  appInstallationId: string;
  publicationEnvironment: "dev" | "prod";
  visibility: AppVisibility;
  dataPortabilityMode: AppDataPortabilityMode;
  permissions: AppPermissionScope[];
  branding: BrandingProfile;
  legal: LegalProfile;
  /**
   * The runtime-document path prefix for this app.
   * Use this as the `basename` for your client-side router so in-app
   * navigation stays within the current PlannerXchange runtime.
   */
  appBasename: string;
  /**
   * The shell-owned path prefix for this app.
   * In isolated iframe runtimes, `appBasename` can be iframe-local
   * (for example "/plugin-runner.html"). Use this field only when building shell-level
   * deep links or copyable URLs outside the embedded app runtime.
   */
  shellAppBasename?: string;
  /**
   * The current in-app path relative to `appBasename`, e.g. "/households/abc123".
   * Initialize your router at this path so deep links render the correct view.
   * Defaults to "/" when the user navigates to the app root.
   */
  initialPath: string;
}

export interface PlannerXchangePluginModule {
  manifest: PlannerXchangeManifest;
  mount: (context: ShellRuntimeContext) => Promise<void> | void;
}

let runtimeContext: ShellRuntimeContext | null = null;

export function configurePlannerXchange(context: ShellRuntimeContext): void {
  runtimeContext = context;
}

export function getPlannerXchangeContext(): ShellRuntimeContext {
  if (!runtimeContext) {
    throw new Error("PlannerXchange runtime context is unavailable.");
  }
  return runtimeContext;
}

export function isPublicDemo(ctx: ShellRuntimeContext): boolean {
  return ctx.runtimeMode === "public_demo" || ctx.isDemoMode === true;
}

export function isShellHosted(ctx: ShellRuntimeContext): boolean {
  return !isPublicDemo(ctx) && typeof ctx.authenticatedFetch === "function";
}
