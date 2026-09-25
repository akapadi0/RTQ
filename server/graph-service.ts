/**
 * Microsoft Graph API — reused from the Wealth IQ OS meeting-sync project's
 * existing Azure app registration (same client_id/tenant, delegated
 * Files.ReadWrite already granted). This is a *delegated* refresh token, not
 * app-only/client-credentials — it acts as Aditi herself against her own
 * OneDrive.
 *
 * Refresh tokens rotate on every use. Since serverless invocations share no
 * local disk, the current token is kept in-memory for this warm process
 * (covers the common case of consecutive requests reusing the same
 * instance) and best-effort persisted to a file in OneDrive itself after
 * every exchange, both as a recovery point and as a way to see the current
 * value without a separate secrets store. If cold starts ever cause
 * `AZURE_REFRESH_TOKEN_SEED` to go stale, copy the latest value from that
 * file back into the env var.
 */
import { Buffer } from "node:buffer";

const TOKEN_ENDPOINT = (tenantId: string) => `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
// Kept separate from the compliance folder tree — this is an internal
// technical artifact, not a suitability document.
const TOKEN_FILE_PATH = "Wealth IQ/Wealth IQ OS/.auth/graph-token.json";
const GRAPH_SCOPES = [
  "https://graph.microsoft.com/Files.ReadWrite",
  "https://graph.microsoft.com/Mail.Read",
  "offline_access",
].join(" ");

let currentRefreshToken: string | undefined = process.env.AZURE_REFRESH_TOKEN_SEED;
let cachedAccessToken: { token: string; expiresAt: number } | undefined;

interface TokenExchangeResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

async function exchangeRefreshToken(refreshToken: string): Promise<TokenExchangeResponse> {
  const clientId = process.env.AZURE_CLIENT_ID;
  const tenantId = process.env.AZURE_TENANT_ID;
  if (!clientId || !tenantId) throw new Error("AZURE_CLIENT_ID / AZURE_TENANT_ID are not set.");

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: GRAPH_SCOPES,
  });

  const res = await fetch(TOKEN_ENDPOINT(tenantId), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Microsoft Graph token refresh failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<TokenExchangeResponse>;
}

async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 30_000) {
    return cachedAccessToken.token;
  }
  if (!currentRefreshToken) {
    throw new Error("No Microsoft Graph refresh token available — set AZURE_REFRESH_TOKEN_SEED.");
  }

  const result = await exchangeRefreshToken(currentRefreshToken);
  currentRefreshToken = result.refresh_token;
  cachedAccessToken = { token: result.access_token, expiresAt: Date.now() + result.expires_in * 1000 };

  // Best-effort persistence of the rotated token — recovery/visibility only, never blocks the caller.
  persistCurrentRefreshToken().catch((err) => console.error("[graph] failed to persist rotated refresh token:", err));

  return result.access_token;
}

async function persistCurrentRefreshToken(): Promise<void> {
  if (!currentRefreshToken) return;
  await writeFileBuffer(
    TOKEN_FILE_PATH,
    Buffer.from(JSON.stringify({ refresh_token: currentRefreshToken, updatedAt: new Date().toISOString() }, null, 2)),
    "application/json"
  );
}

function encodePath(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export async function readFileBuffer(path: string): Promise<Buffer | null> {
  const token = await getAccessToken();
  const res = await fetch(`${GRAPH_BASE}/me/drive/root:/${encodePath(path)}:/content`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`OneDrive file read failed (${res.status}) for ${path}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function writeFileBuffer(path: string, buffer: Buffer, contentType: string): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(`${GRAPH_BASE}/me/drive/root:/${encodePath(path)}:/content`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": contentType },
    body: buffer,
  });
  if (!res.ok) throw new Error(`OneDrive file write failed (${res.status}) for ${path}`);
}

/**
 * Resolves a OneDrive/SharePoint sharing link (e.g. one Aditi copies from
 * "Copy link" on a folder) to its actual driveItem — lets the app target an
 * exact existing folder without guessing its path/name. Per Microsoft's
 * documented shares API: base64url-encode the URL, prefix with "u!".
 */
export async function resolveShareLink(shareUrl: string): Promise<{ id: string; name: string; webUrl: string }> {
  const token = await getAccessToken();
  const encoded = "u!" + Buffer.from(shareUrl, "utf8").toString("base64url").replace(/=+$/, "");
  const res = await fetch(`${GRAPH_BASE}/shares/${encoded}/driveItem`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Failed to resolve shared folder (${res.status}): ${await res.text()}`);
  const item = (await res.json()) as { id: string; name: string; webUrl: string };
  return item;
}

export async function readFileBufferById(itemId: string): Promise<Buffer | null> {
  const token = await getAccessToken();
  const res = await fetch(`${GRAPH_BASE}/me/drive/items/${itemId}/content`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`OneDrive file read failed (${res.status}) for item ${itemId}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function writeFileBufferToParent(parentItemId: string, fileName: string, buffer: Buffer, contentType: string): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(`${GRAPH_BASE}/me/drive/items/${parentItemId}:/${encodeURIComponent(fileName)}:/content`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": contentType },
    body: buffer,
  });
  if (!res.ok) throw new Error(`OneDrive file write failed (${res.status}) for ${fileName}`);
}

/**
 * Reads a file's content by exact name directly under a known parent item id
 * — pure path addressing, no search/$filter involved. Confirmed reliable
 * (immediate + up to 20s later) even on this drive, unlike a $filter-based
 * children lookup. Returns null if the file doesn't exist yet.
 */
export async function readFileBufferByPath(parentItemId: string, fileName: string): Promise<Buffer | null> {
  const token = await getAccessToken();
  const res = await fetch(`${GRAPH_BASE}/me/drive/items/${parentItemId}:/${encodeURIComponent(fileName)}:/content`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`OneDrive file read failed (${res.status}) for ${fileName}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Lists every child of a folder (no $filter — a plain listing, used for the occasional/periodic audit-log rebuild rather than any per-request lookup). */
export async function listChildren(parentItemId: string): Promise<{ id: string; name: string }[]> {
  const token = await getAccessToken();
  const items: { id: string; name: string }[] = [];
  let url: string | undefined = `${GRAPH_BASE}/me/drive/items/${parentItemId}/children?$select=id,name`;
  while (url) {
    const res: globalThis.Response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`OneDrive folder listing failed (${res.status}): ${await res.text()}`);
    const data = (await res.json()) as { value: { id: string; name: string }[]; "@odata.nextLink"?: string };
    items.push(...data.value);
    url = data["@odata.nextLink"];
  }
  return items;
}

/** Looks up a child item (file or folder) by exact name directly under a known parent item id. Returns undefined if not found. */
export async function findChildItem(parentItemId: string, name: string): Promise<{ id: string } | undefined> {
  const token = await getAccessToken();
  const listUrl = `${GRAPH_BASE}/me/drive/items/${parentItemId}/children?$filter=${encodeURIComponent(`name eq '${name.replace(/'/g, "''")}'`)}&$select=id,name`;
  const res = await fetch(listUrl, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`OneDrive child lookup failed (${res.status}): ${await res.text()}`);
  const items = ((await res.json()).value ?? []) as { id: string }[];
  return items[0];
}

/**
 * Finds (or creates) a child folder by name directly under a known parent
 * item id. Returns the child folder's item id.
 *
 * Filters on just `name eq '...'` (no `and folder ne null`) — this
 * SharePoint-backed drive rejects that compound filter with a 400
 * "notSupported" error, even though the simpler name-only filter (as used by
 * findChildItem) works fine. Folder-ness is checked client-side instead.
 */
export async function ensureChildFolder(parentItemId: string, name: string): Promise<string> {
  const token = await getAccessToken();
  const listUrl = `${GRAPH_BASE}/me/drive/items/${parentItemId}/children?$filter=${encodeURIComponent(`name eq '${name.replace(/'/g, "''")}'`)}&$select=id,name,folder`;
  const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${token}` } });
  if (!listRes.ok) throw new Error(`OneDrive folder lookup failed (${listRes.status}): ${await listRes.text()}`);
  const items = ((await listRes.json()).value ?? []) as { id: string; folder?: unknown }[];
  const existingFolder = items.find((item) => item.folder);
  if (existingFolder) return existingFolder.id;

  const createRes = await fetch(`${GRAPH_BASE}/me/drive/items/${parentItemId}/children`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, folder: {}, "@microsoft.graph.conflictBehavior": "rename" }),
  });
  if (!createRes.ok) throw new Error(`OneDrive folder create failed (${createRes.status}): ${await createRes.text()}`);
  return (await createRes.json()).id;
}
