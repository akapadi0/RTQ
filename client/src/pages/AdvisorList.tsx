import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listRtqResponses, exportSuitabilityLog } from "@/lib/api";
import type { RtqResponse } from "@shared/rtq-store-types";

const STATUS_LABEL: Record<RtqResponse["status"], string> = {
  submitted: "Submitted — needs your capacity inputs",
  ips_ready: "Ready — IPS can be downloaded",
};

export default function AdvisorList() {
  const [responses, setResponses] = useState<RtqResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    listRtqResponses()
      .then(setResponses)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load responses."));
  }, []);

  async function refreshLog() {
    setExporting(true);
    setError(null);
    try {
      await exportSuitabilityLog();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to refresh the suitability log.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="min-h-screen p-6 flex flex-col items-center">
      <div className="w-full max-w-2xl mt-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Advisor only</p>
            <h1 className="text-2xl mt-1">RTQ responses</h1>
          </div>
          <Button variant="outline" size="sm" onClick={refreshLog} disabled={exporting} className="shrink-0">
            {exporting ? "Refreshing..." : "Refresh Suitability Log"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground -mt-4">
          Every response is saved individually as it comes in. This rebuilds the single audit-ready
          Excel log in your Suitability folder from all of them — run it whenever you want an updated copy.
        </p>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {!responses && !error && <p className="text-muted-foreground">Loading...</p>}
        {responses && responses.length === 0 && (
          <p className="text-muted-foreground">No responses yet — they'll show up here once a client submits Part 2.</p>
        )}

        <div className="space-y-3">
          {responses?.map((r) => (
            <Link key={r.id} href={`/advisor/${r.id}`}>
              <Card className="cursor-pointer hover:border-primary/40 transition-colors">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{r.clientName}</p>
                    <p className="text-sm text-muted-foreground">{r.clientEmail}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">{STATUS_LABEL[r.status]}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
