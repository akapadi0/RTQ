import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { listRtqResponses, type RtqResponse } from "@/lib/px-data";

const STATUS_LABEL: Record<RtqResponse["status"], string> = {
  started: "Started — waiting on Part 1",
  part1_complete: "Part 1 only — waiting on client",
  submitted: "Submitted — needs your capacity inputs",
  ips_ready: "Ready — IPS can be downloaded",
};

export default function AdvisorList() {
  const [responses, setResponses] = useState<RtqResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listRtqResponses()
      .then(setResponses)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load responses."));
  }, []);

  return (
    <div className="min-h-screen p-6 flex flex-col items-center">
      <div className="w-full max-w-2xl mt-8 space-y-6">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Advisor only</p>
          <h1 className="text-2xl mt-1">RTQ responses</h1>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {!responses && !error && <p className="text-muted-foreground">Loading...</p>}
        {responses && responses.length === 0 && (
          <p className="text-muted-foreground">No responses yet — they'll show up here once a client starts Part 1.</p>
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
