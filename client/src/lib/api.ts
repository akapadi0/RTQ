import type { Part1Answers, Part2Answers, CapacityInputs } from "@shared/answer-types";
import type { RtqResponse } from "@shared/rtq-store-types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: unknown };
    throw new Error(typeof payload.error === "string" ? payload.error : `Request failed (${res.status}).`);
  }
  return res.json() as Promise<T>;
}

/** Single combined submission — Part 1 and Part 2 answers are carried in the browser and posted together. */
export async function createRtqResponse(input: {
  clientName: string;
  clientEmail: string;
  part1: Part1Answers;
  part2: Part2Answers;
}): Promise<RtqResponse> {
  return request("/api/rtq", { method: "POST", body: JSON.stringify(input) });
}

export async function submitCapacity(id: string, capacity: CapacityInputs, advisorNotes?: string): Promise<{ ok: true }> {
  return request(`/api/rtq/${id}/capacity`, { method: "POST", body: JSON.stringify({ capacity, advisorNotes }) });
}

export async function getRtqResponse(id: string): Promise<RtqResponse> {
  return request(`/api/rtq/${id}`);
}

export async function listRtqResponses(): Promise<RtqResponse[]> {
  return request("/api/rtq");
}

async function downloadFile(path: string, downloadName: string, failureMessage: string): Promise<void> {
  const res = await fetch(path);
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || `${failureMessage} (${res.status}).`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = downloadName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Triggers server-side PDF generation + email (client & advisor) + OneDrive save, and downloads the PDF too. */
export async function generateAndDownloadIps(id: string, clientName: string): Promise<void> {
  await downloadFile(`/api/rtq/${id}/ips`, `IPS_${clientName.replace(/\s+/g, "_")}.pdf`, "Failed to generate IPS");
}

/** Rebuilds the audit-ready Excel workbook from every record and re-saves it to the Suitability folder, and downloads a copy too. */
export async function exportSuitabilityLog(): Promise<void> {
  await downloadFile("/api/rtq/export", "RTQ Suitability Log.xlsx", "Failed to refresh the suitability log");
}
