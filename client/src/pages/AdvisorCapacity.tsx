import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChoiceButtons } from "@/components/rtq/ChoiceButtons";
import { CashNeedsEditor } from "@/components/rtq/CashNeedsEditor";
import type { CapacityInputs, CashNeedEntry } from "@shared/answer-types";
import { submitCapacity, generateAndDownloadIps, getRtqResponse } from "@/lib/api";
import { scoreCapacity } from "@shared/scoring";

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
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [responseLoaded, setResponseLoaded] = useState(false);
  const [initialCashNeeds, setInitialCashNeeds] = useState<CashNeedEntry[]>([]);
  const [cashNeeds, setCashNeeds] = useState<CashNeedEntry[]>([]);
  const [cashNeedsReady, setCashNeedsReady] = useState(true);

  useEffect(() => {
    getRtqResponse(id)
      .then((r) => {
        setClientName(r.clientName);
        setClientEmail(r.clientEmail);
        // Pre-fill from what the client already reported in Part 3 — still
        // editable/overridable here before saving, same as everything else
        // on this screen.
        setInitialCashNeeds(r.clientTimeHorizon?.cashNeeds ?? []);
      })
      .catch(() => undefined)
      .finally(() => setResponseLoaded(true));
  }, [id]);

  const ready = age && incomeStability && goalCoverage;

  const livePreview = ready
    ? scoreCapacity({
        age: Number(age),
        targetRetirementAge: targetRetirementAge ? Number(targetRetirementAge) : undefined,
        career,
        investableAssets: investableAssets ? Number(investableAssets) : undefined,
        incomeStability: incomeStability!,
        goalCoverage: goalCoverage!,
        cashNeeds,
        notes: "",
      })
    : null;

  async function save() {
    setError(null);
    if (!cashNeedsReady) {
      setError("Add a timing for each near-term cash need before saving.");
      return;
    }
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
          {initialCashNeeds.length > 0 && (
            <p className="text-sm mt-2 rounded-md bg-muted/50 border border-border px-3 py-2 text-muted-foreground">
              Cash needs below are pre-filled from what the client reported in Part 3 — edit as needed.
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
              <Label>Near-term cash needs (1–3 years) — does the client expect to need money from their investments for any of these?</Label>
              {responseLoaded && (
                <CashNeedsEditor
                  initialCashNeeds={initialCashNeeds}
                  idPrefix="advisor-"
                  onChange={(entries, isReady) => {
                    setCashNeeds(entries);
                    setCashNeedsReady(isReady);
                  }}
                />
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
