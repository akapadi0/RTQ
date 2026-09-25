import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { getRtqResponse } from "@/lib/api";
import { loadResult } from "@/lib/rtq-intake";
import type { RtqResponse } from "@shared/rtq-store-types";
import { categoryLabel, concernLabel } from "@shared/scoring";

// Client-facing — per spec, the two non-scoring flags (predicted-vs-actual
// gap, near-term cash needs) surface in the advisor-facing report only, not
// here.
export default function Results() {
  const { id } = useParams<{ id: string }>();
  const [response, setResponse] = useState<RtqResponse | null | undefined>(undefined);

  useEffect(() => {
    // Prefer the copy handed back from the create call — checking straight
    // back with OneDrive right after that same write is the exact gap this
    // whole flow is designed to avoid. Only hit the network (e.g. a page
    // refresh, or a link opened later) as a fallback.
    const cached = loadResult(id);
    if (cached) {
      setResponse(cached);
      return;
    }
    getRtqResponse(id)
      .then(setResponse)
      .catch(() => setResponse(null));
  }, [id]);

  if (response === undefined) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
  }
  if (!response || !response.part1 || !response.part2 || !response.resultSnapshot) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">We couldn't find this response.</div>;
  }

  // Uses the snapshot frozen at submission time, not a live recompute — the
  // score bands are provisional and expected to get recalibrated, and a
  // client's result shouldn't silently shift after the fact.
  const { tierLabel, tierDescription } = response.resultSnapshot;
  const [topCategory, secondCategory] = response.part1.categoryRank;

  return (
    <div className="min-h-screen p-6 flex flex-col items-center">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-xl mt-10 space-y-6">
        <Card>
          <CardContent className="p-8 space-y-6 text-center">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Your risk profile</p>
              <h1 className="text-3xl mt-1">
                <span className="text-sage">{tierLabel}</span>
              </h1>
              <p className="text-muted-foreground mt-2 max-w-sm mx-auto">{tierDescription}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-8 space-y-4 text-left">
            <h2 className="text-lg font-semibold">What's on your mind</h2>
            <p className="text-sm text-muted-foreground">
              Ranked #1: <span className="font-medium text-foreground">{categoryLabel(topCategory)}</span>
              {response.part1.selectedConcerns[topCategory]?.length ? (
                <> — {response.part1.selectedConcerns[topCategory].map((c) => concernLabel(topCategory, c)).join(", ")}</>
              ) : null}
            </p>
            <p className="text-sm text-muted-foreground">
              Ranked #2: <span className="font-medium text-foreground">{categoryLabel(secondCategory)}</span>
              {response.part1.selectedConcerns[secondCategory]?.length ? (
                <> — {response.part1.selectedConcerns[secondCategory].map((c) => concernLabel(secondCategory, c)).join(", ")}</>
              ) : null}
            </p>
          </CardContent>
        </Card>

        <p className="text-sm text-muted-foreground text-center">
          A full summary is on its way to your inbox. Your advisor has a copy too, and will follow up
          to talk through what it means for your plan.
        </p>
      </motion.div>
    </div>
  );
}
