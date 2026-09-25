import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChoiceButtons } from "@/components/rtq/ChoiceButtons";
import type { CapacityInputs, CashNeedEntry } from "@shared/answer-types";
import { CASH_NEED_ITEMS, TIMING_BUCKETS, TIME_HORIZON_BUCKETS, type CashNeedItemId, type TimingBucket, type TimeHorizonBucket } from "@shared/rtq-content";
import { submitCapacity, generateAndDownloadIps, getRtqResponse } from "@/lib/api";
import { scoreCapacity } from "@shared/scoring";
import { cn } from "@/lib/utils";

const INCOME_STABILITY_OPTIONS: { value: CapacityInputs["incomeStability"]; label: string }[] = [
  { value: "stable_employment", label: "Stable employment" },
  { value: "variable_business_income", label: "Variable / business income" },
  { value: "fixed_income_retired", label: "Fixed income / retired" },
];

const GOAL_COVERAGE_OPTIONS: { value: CapacityInputs["goalCoverage"]; label: string }[] = [
  { value: "comfortable", label: "Comfortably ahead of goals" },
  { value: "on_track", label: "On track" },
  { value: "tight", label: "Tight — little margin" },
  { value: "stretched", label: "Stretched — behind goals" },
];

export default function AdvisorCapacity() {
  const { id } = useParams<{ id: string }>();
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [age, setAge] = useState("");
  const [targetRetirementAge, setTargetRetirementAge] = useState("");
  const [career, setCareer] = useState("");
  const [investableAssets, setInvestableAssets] = useState("");
  const [incomeStability, setIncomeStability] = useState<CapacityInputs["incomeStability"]>();
  const [goalCoverage, setGoalCoverage] = useState<CapacityInputs["goalCoverage"]>();
  const [cashItems, setCashItems] = useState<Set<CashNeedItemId>>(new Set());
  const [cashDetails, setCashDetails] = useState<Record<string, { amount: string; pct: string; timing: TimingBucket | undefined }>>({});
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientHorizonBucket, setClientHorizonBucket] = useState<TimeHorizonBucket>();

  useEffect(() => {
    getRtqResponse(id)
      .then((r) => {
        setClientName(r.clientName);
        setClientEmail(r.clientEmail);
        // Pre-fill from what the client already reported in Part 3 — still
        // editable/overridable here before saving, same as everything else
        // on this screen.
        if (r.clientTimeHorizon) {
          setClientHorizonBucket(r.clientTimeHorizon.horizonBucket);
          const items = new Set<CashNeedItemId>(r.clientTimeHorizon.cashNeeds.map((c) => c.item));
          if (items.size > 0) {
            setCashItems(items);
            const details: Record<string, { amount: string; pct: string; timing: TimingBucket | undefined }> = {};
            for (const c of r.clientTimeHorizon.cashNeeds) {
              details[c.item] = { amount: c.amount?.toString() ?? "", pct: c.pctOfPortfolio?.toString() ?? "", timing: c.timing };
            }
            setCashDetails(details);
          } else {
            setCashItems(new Set(["none"]));
          }
        }
      })
      .catch(() => undefined);
  }, [id]);

  const ready = age && incomeStability && goalCoverage;
  const selectedCashItems = Array.from(cashItems).filter((i) => i !== "none");
  const cashDetailsComplete = selectedCashItems.every((i) => cashDetails[i]?.timing);

  const livePreview = ready
    ? scoreCapacity({
        age: Number(age),
        targetRetirementAge: targetRetirementAge ? Number(targetRetirementAge) : undefined,
        career,
        investableAssets: investableAssets ? Number(investableAssets) : undefined,
        incomeStability: incomeStability!,
        goalCoverage: goalCoverage!,
        cashNeeds: selectedCashItems
          .filter((i) => cashDetails[i]?.timing)
          .map((item) => ({
            item,
            amount: cashDetails[item]?.amount ? Number(cashDetails[item].amount) : undefined,
            pctOfPortfolio: cashDetails[item]?.pct ? Number(cashDetails[item].pct) : undefined,
            timing: cashDetails[item]!.timing!,
          })),
        notes: "",
      })
    : null;

  function toggleCashItem(itemId: CashNeedItemId) {
    setCashItems((prev) => {
      const next = new Set(prev);
      if (itemId === "none") return next.has("none") ? new Set() : new Set(["none"]);
      next.delete("none");
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
      return next;
    });
  }

  async function save() {
    setError(null);
    if (selectedCashItems.length > 0 && !cashDetailsComplete) {
      setError("Add a timing for each near-term cash need before saving.");
      return;
    }
    const cashNeeds: CashNeedEntry[] = selectedCashItems.map((item) => ({
      item,
      amount: cashDetails[item]?.amount ? Number(cashDetails[item].amount) : undefined,
      pctOfPortfolio: cashDetails[item]?.pct ? Number(cashDetails[item].pct) : undefined,
      timing: cashDetails[item]!.timing!,
    }));
    try {
      await submitCapacity(
        id,
        {
          age: Number(age),
          targetRetirementAge: targetRetirementAge ? Number(targetRetirementAge) : undefined,
          career,
          investableAssets: investableAssets ? Number(investableAssets) : undefined,
          incomeStability: incomeStability!,
          goalCoverage: goalCoverage!,
          cashNeeds,
          notes,
        },
        notes
      );
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  async function downloadIps() {
    setError(null);
    setGenerating(true);
    try {
      // Server generates the PDF, emails it (client + advisor), and saves a
      // copy to the OneDrive Suitability folder — this just also downloads it.
      await generateAndDownloadIps(id, clientName);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate IPS.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="min-h-screen p-6 flex flex-col items-center">
      <div className="w-full max-w-xl mt-8 space-y-6">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Advisor only — not shown to clients</p>
          <h1 className="text-2xl mt-1">Time Horizon & Background</h1>
          {clientName && (
            <p className="text-sm font-medium mt-1">
              {clientName} <span className="text-muted-foreground font-normal">— {clientEmail}</span>
            </p>
          )}
          <p className="text-muted-foreground mt-1">
            Fill this in from what you already know — capacity (ability to take risk) is meant to be
            an objective read on age, income stability, and goal coverage, separate from the reported
            comfort captured in Part 2.
          </p>
          {clientHorizonBucket && (
            <p className="text-sm mt-2 rounded-md bg-muted/50 border border-border px-3 py-2">
              <span className="text-muted-foreground">Client-reported time horizon: </span>
              <span className="font-medium">{TIME_HORIZON_BUCKETS.find((b) => b.id === clientHorizonBucket)?.label}</span>
              <span className="text-muted-foreground"> — cash needs below are pre-filled from Part 3, edit as needed.</span>
            </p>
          )}
        </div>

        <Card>
          <CardContent className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="age">Age</Label>
                <Input id="age" type="number" value={age} onChange={(e) => setAge(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tra">Target retirement age (optional)</Label>
                <Input id="tra" type="number" value={targetRetirementAge} onChange={(e) => setTargetRetirementAge(e.target.value)} placeholder="65" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="career">Career</Label>
                <Input id="career" value={career} onChange={(e) => setCareer(e.target.value)} placeholder="e.g. Director, Federal Programs" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="assets">Investable assets ($)</Label>
                <Input id="assets" type="number" min={0} value={investableAssets} onChange={(e) => setInvestableAssets(e.target.value)} placeholder="e.g. 850000" />
              </div>
            </div>

            <div>
              <Label>Income stability</Label>
              <div className="mt-2"><ChoiceButtons options={INCOME_STABILITY_OPTIONS} value={incomeStability} onChange={setIncomeStability} /></div>
            </div>

            <div>
              <Label>Goal coverage — how comfortably do their assets/savings cover their plan?</Label>
              <div className="mt-2"><ChoiceButtons options={GOAL_COVERAGE_OPTIONS} value={goalCoverage} onChange={setGoalCoverage} /></div>
            </div>

            <div className="space-y-3 border-t border-border pt-6">
              <Label>Near-term cash needs (3–5 yrs) — does the client expect to need money from their investments for any of these?</Label>
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
                    Enter whichever you actually know — a dollar amount, a rough % of portfolio, or both. Neither
                    requires investable assets to be filled in above.
                  </p>
                  {selectedCashItems.map((item) => {
                    const label = CASH_NEED_ITEMS.find((c) => c.id === item)!.label;
                    const detail = cashDetails[item] ?? { amount: "", pct: "", timing: undefined };
                    return (
                      <div key={item} className="space-y-2 border-t border-border pt-3 first:border-t-0 first:pt-0">
                        <p className="font-medium text-sm">{label}</p>
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

            <div className="space-y-1.5">
              <Label htmlFor="notes">Advisor notes (background discussed in meetings, etc.)</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            {livePreview && (
              <div className="rounded-lg bg-muted/50 border border-border p-4 text-sm space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Ability to take risk (capacity)</p>
                <p>
                  Initial: <strong>{livePreview.initialScore}/100</strong> ({livePreview.initialTier.label})
                  {livePreview.liquidityPenalty > 0 && (
                    <>
                      {" "}→ Adjusted: <strong>{livePreview.adjustedScore}/100</strong> ({livePreview.tier.label})
                      <span className="text-accent"> (−{livePreview.liquidityPenalty} pts for near-term liquidity)</span>
                    </>
                  )}
                </p>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            {!saved ? (
              <Button size="lg" className="w-full" onClick={save} disabled={!ready}>
                Save capacity inputs
              </Button>
            ) : (
              <Button size="lg" variant="accent" className="w-full" onClick={downloadIps} disabled={generating}>
                {generating ? "Generating..." : "Download IPS (.pdf)"}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
