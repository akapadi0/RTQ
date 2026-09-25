import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { CASH_NEED_ITEMS, TIMING_BUCKETS, type CashNeedItemId, type TimingBucket } from "@shared/rtq-content";
import type { CashNeedEntry } from "@shared/answer-types";
import { createRtqResponse } from "@/lib/api";
import { clearIntake, loadIntake, loadPart1, loadPart2, saveResult } from "@/lib/rtq-intake";
import { cn } from "@/lib/utils";

interface CashDetail {
  amount: string;
  pct: string;
  timing: TimingBucket | undefined;
  /** Only used for item "other" — what the client typed in for a need not in the list. */
  description: string;
}

const EMPTY_DETAIL: CashDetail = { amount: "", pct: "", timing: undefined, description: "" };

export default function Part3() {
  const [, navigate] = useLocation();

  const [cashItems, setCashItems] = useState<Set<CashNeedItemId>>(new Set());
  const [cashDetails, setCashDetails] = useState<Record<string, CashDetail>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loadIntake() || !loadPart1() || !loadPart2()) navigate("/");
  }, [navigate]);

  const selectedCashItems = Array.from(cashItems).filter((i) => i !== "none");
  const cashDetailsComplete = selectedCashItems.every((i) => cashDetails[i]?.timing);
  const ready = cashItems.size > 0 && cashDetailsComplete;

  function toggleCashItem(itemId: CashNeedItemId) {
    setCashItems((prev) => {
      const next = new Set(prev);
      if (itemId === "none") return next.has("none") ? new Set() : new Set(["none"]);
      next.delete("none");
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
      return next;
    });
  }

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
      const cashNeeds: CashNeedEntry[] = selectedCashItems.map((item) => ({
        item,
        description: item === "other" ? cashDetails[item]?.description || undefined : undefined,
        amount: cashDetails[item]?.amount ? Number(cashDetails[item].amount) : undefined,
        pctOfPortfolio: cashDetails[item]?.pct ? Number(cashDetails[item].pct) : undefined,
        timing: cashDetails[item]!.timing!,
      }));

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
              <div className="flex flex-wrap gap-2">
                {CASH_NEED_ITEMS.map((item) => {
                  const selected = cashItems.has(item.id);
                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => toggleCashItem(item.id)}
                      className={cn(
                        "rounded-full border px-3.5 py-2 text-sm transition-colors",
                        selected ? "border-accent bg-accent text-accent-foreground font-medium" : "border-border hover:border-accent/40"
                      )}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {selectedCashItems.length > 0 && (
                <div className="space-y-4 pt-2">
                  <p className="text-xs text-muted-foreground -mb-1">
                    Enter whichever you actually know — a dollar amount, a rough % of your portfolio, or both.
                  </p>
                  {selectedCashItems.map((item) => {
                    const label = CASH_NEED_ITEMS.find((c) => c.id === item)!.label;
                    const detail = cashDetails[item] ?? EMPTY_DETAIL;
                    return (
                      <div key={item} className="space-y-2 border-t border-border pt-3 first:border-t-0 first:pt-0">
                        <p className="font-medium text-sm">{label}</p>
                        {item === "other" && (
                          <div className="space-y-1.5">
                            <Label htmlFor="other-description">What is it?</Label>
                            <Textarea
                              id="other-description"
                              placeholder="Briefly describe the expense"
                              value={detail.description}
                              onChange={(e) => setCashDetails((prev) => ({ ...prev, [item]: { ...detail, description: e.target.value } }))}
                            />
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label htmlFor={`amt-${item}`}>Approx. amount</Label>
                            <Input
                              id={`amt-${item}`}
                              type="number"
                              min={0}
                              placeholder="$"
                              value={detail.amount}
                              onChange={(e) => setCashDetails((prev) => ({ ...prev, [item]: { ...detail, amount: e.target.value } }))}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`pct-${item}`}>or % of portfolio</Label>
                            <Input
                              id={`pct-${item}`}
                              type="number"
                              min={0}
                              max={100}
                              placeholder="%"
                              value={detail.pct}
                              onChange={(e) => setCashDetails((prev) => ({ ...prev, [item]: { ...detail, pct: e.target.value } }))}
                            />
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          {TIMING_BUCKETS.map((t) => (
                            <button
                              type="button"
                              key={t.id}
                              onClick={() => setCashDetails((prev) => ({ ...prev, [item]: { ...detail, timing: t.id } }))}
                              className={cn(
                                "flex-1 rounded-md border px-2 py-2.5 text-xs font-medium transition-colors",
                                detail.timing === t.id ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted/50"
                              )}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
