import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { CashNeedsEditor } from "@/components/rtq/CashNeedsEditor";
import type { CashNeedEntry } from "@shared/answer-types";
import { createRtqResponse } from "@/lib/api";
import { clearIntake, loadIntake, loadPart1, loadPart2, saveResult } from "@/lib/rtq-intake";

export default function Part3() {
  const [, navigate] = useLocation();

  const [cashNeeds, setCashNeeds] = useState<CashNeedEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loadIntake() || !loadPart1() || !loadPart2()) navigate("/");
  }, [navigate]);

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const intake = loadIntake();
      const part1 = loadPart1();
      const part2 = loadPart2();
      if (!intake || !part1 || !part2) {
        navigate("/");
        return;
      }

      const response = await createRtqResponse({
        clientName: intake.clientName,
        clientEmail: intake.clientEmail,
        part1,
        part2,
        clientTimeHorizon: { cashNeeds },
      });
      saveResult(response);
      clearIntake();
      navigate(`/results/${response.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen p-6 flex flex-col items-center">
      <div className="w-full max-w-xl pt-8 space-y-1">
        <Progress value={90} />
        <p className="text-xs text-muted-foreground">Part 3 of 3 — Near-term cash needs</p>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-xl mt-8">
        <Card>
          <CardContent className="p-8 space-y-6">
            <div className="space-y-1.5">
              <h2 className="text-2xl">
                Any near-term cash <span className="text-sage">needs</span>?
              </h2>
              <p className="text-muted-foreground">
                This doesn't affect your risk score above — it helps your advisor make sure money you'll
                need soon stays somewhere it can't take a hit.
              </p>
            </div>

            <div className="space-y-3">
              <Label>Near-term cash needs (1–3 years) — will you need money from this account for any of these?</Label>
              <CashNeedsEditor onChange={(entries, isReady) => { setCashNeeds(entries); setReady(isReady); }} />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button size="lg" className="w-full gap-2" onClick={submit} disabled={!ready || submitting}>
              {submitting ? "Submitting..." : "See my results"}
              {!submitting && <ArrowRight className="h-4 w-4" />}
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
