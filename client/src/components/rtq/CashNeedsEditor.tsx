import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CASH_NEED_ITEMS, TIMING_BUCKETS, type CashNeedItemId, type TimingBucket } from "@shared/rtq-content";
import type { CashNeedEntry } from "@shared/answer-types";
import { cn } from "@/lib/utils";

const PRESET_ITEMS = CASH_NEED_ITEMS.filter((i) => i.id !== "other");

interface PresetDetail {
  amount: string;
  pct: string;
  timing: TimingBucket | undefined;
}
const EMPTY_PRESET_DETAIL: PresetDetail = { amount: "", pct: "", timing: undefined };

interface CustomNeed {
  id: string;
  description: string;
  amount: string;
  pct: string;
  timing: TimingBucket | undefined;
}

function newCustomNeed(): CustomNeed {
  return { id: crypto.randomUUID(), description: "", amount: "", pct: "", timing: undefined };
}

/**
 * Shared between Part3.tsx (client-facing) and AdvisorCapacity.tsx (advisor
 * confirms/edits) — a fixed preset list of near-term cash needs, plus a
 * repeatable "+ Add a need" section for anything not on the list. Per Aditi
 * (2026-09-25): clients should be able to describe more than one thing not
 * covered by the presets, not just a single "Other" slot.
 */
export function CashNeedsEditor({
  initialCashNeeds,
  onChange,
  idPrefix = "",
}: {
  /** Seeds the editor once on mount (e.g. what the client already reported) — not re-applied on later prop changes. */
  initialCashNeeds?: CashNeedEntry[];
  onChange: (entries: CashNeedEntry[], ready: boolean) => void;
  /** Disambiguates input ids when this component appears more than once on a page (it doesn't here, but keeps ids unique if that ever changes). */
  idPrefix?: string;
}) {
  const [noneSelected, setNoneSelected] = useState(false);
  const [presetItems, setPresetItems] = useState<Set<CashNeedItemId>>(new Set());
  const [presetDetails, setPresetDetails] = useState<Record<string, PresetDetail>>({});
  const [customNeeds, setCustomNeeds] = useState<CustomNeed[]>([]);

  // Seed from initialCashNeeds exactly once — deliberately not reactive to
  // later prop changes, since this is "pre-fill on load," not a controlled value.
  useEffect(() => {
    if (!initialCashNeeds) return;
    if (initialCashNeeds.length === 0) {
      setNoneSelected(true);
      return;
    }
    const presets = new Set<CashNeedItemId>();
    const details: Record<string, PresetDetail> = {};
    const customs: CustomNeed[] = [];
    for (const c of initialCashNeeds) {
      if (c.item === "other") {
        customs.push({ id: crypto.randomUUID(), description: c.description ?? "", amount: c.amount?.toString() ?? "", pct: c.pctOfPortfolio?.toString() ?? "", timing: c.timing });
      } else {
        presets.add(c.item);
        details[c.item] = { amount: c.amount?.toString() ?? "", pct: c.pctOfPortfolio?.toString() ?? "", timing: c.timing };
      }
    }
    setPresetItems(presets);
    setPresetDetails(details);
    setCustomNeeds(customs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const presetDetailsComplete = Array.from(presetItems).every((i) => presetDetails[i]?.timing);
  const customNeedsComplete = customNeeds.every((c) => c.description.trim() && c.timing);
  const hasSelection = noneSelected || presetItems.size > 0 || customNeeds.length > 0;
  const ready = hasSelection && presetDetailsComplete && customNeedsComplete;

  // Report the current entries + readiness on every change.
  useEffect(() => {
    const presetEntries: CashNeedEntry[] = Array.from(presetItems)
      .filter((i) => presetDetails[i]?.timing)
      .map((item) => ({
        item,
        amount: presetDetails[item]?.amount ? Number(presetDetails[item].amount) : undefined,
        pctOfPortfolio: presetDetails[item]?.pct ? Number(presetDetails[item].pct) : undefined,
        timing: presetDetails[item].timing!,
      }));
    const customEntries: CashNeedEntry[] = customNeeds
      .filter((c) => c.timing)
      .map((c) => ({
        item: "other",
        description: c.description || undefined,
        amount: c.amount ? Number(c.amount) : undefined,
        pctOfPortfolio: c.pct ? Number(c.pct) : undefined,
        timing: c.timing!,
      }));
    onChange([...presetEntries, ...customEntries], ready);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetItems, presetDetails, customNeeds, ready]);

  function togglePreset(itemId: CashNeedItemId) {
    if (itemId === "none") {
      setNoneSelected((prev) => !prev);
      if (!noneSelected) {
        setPresetItems(new Set());
        setCustomNeeds([]);
      }
      return;
    }
    setNoneSelected(false);
    setPresetItems((prev) => {
      const next = new Set(prev);
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
      return next;
    });
  }

  function addCustomNeed() {
    setNoneSelected(false);
    setCustomNeeds((prev) => [...prev, newCustomNeed()]);
  }

  function updateCustomNeed(id: string, patch: Partial<CustomNeed>) {
    setCustomNeeds((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function removeCustomNeed(id: string) {
    setCustomNeeds((prev) => prev.filter((c) => c.id !== id));
  }

  const selectedPresetItems = Array.from(presetItems);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {PRESET_ITEMS.map((item) => {
          const selected = item.id === "none" ? noneSelected : presetItems.has(item.id);
          return (
            <button
              type="button"
              key={item.id}
              onClick={() => togglePreset(item.id)}
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

      {selectedPresetItems.length > 0 && (
        <div className="space-y-4 pt-2">
          <p className="text-xs text-muted-foreground -mb-1">
            Enter whichever you actually know — a dollar amount, a rough % of portfolio, or both.
          </p>
          {selectedPresetItems.map((item) => {
            const label = PRESET_ITEMS.find((c) => c.id === item)!.label;
            const detail = presetDetails[item] ?? EMPTY_PRESET_DETAIL;
            return (
              <div key={item} className="space-y-2 border-t border-border pt-3 first:border-t-0 first:pt-0">
                <p className="font-medium text-sm">{label}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor={`${idPrefix}amt-${item}`}>Approx. amount</Label>
                    <Input
                      id={`${idPrefix}amt-${item}`}
                      type="number"
                      min={0}
                      placeholder="$"
                      value={detail.amount}
                      onChange={(e) => setPresetDetails((prev) => ({ ...prev, [item]: { ...detail, amount: e.target.value } }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${idPrefix}pct-${item}`}>or % of portfolio</Label>
                    <Input
                      id={`${idPrefix}pct-${item}`}
                      type="number"
                      min={0}
                      max={100}
                      placeholder="%"
                      value={detail.pct}
                      onChange={(e) => setPresetDetails((prev) => ({ ...prev, [item]: { ...detail, pct: e.target.value } }))}
                    />
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {TIMING_BUCKETS.map((t) => (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => setPresetDetails((prev) => ({ ...prev, [item]: { ...detail, timing: t.id } }))}
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

      <div className="space-y-3 border-t border-border pt-4">
        <div className="flex items-center justify-between">
          <Label>Anything else not listed above?</Label>
          <button type="button" onClick={addCustomNeed} className="text-sm text-accent font-medium hover:underline">
            + Add a need
          </button>
        </div>

        {customNeeds.map((c) => (
          <div key={c.id} className="space-y-2 border border-border rounded-lg p-3 relative">
            <button
              type="button"
              onClick={() => removeCustomNeed(c.id)}
              aria-label="Remove this need"
              className="absolute top-2.5 right-2.5 text-muted-foreground hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="space-y-1.5 pr-8">
              <Label htmlFor={`${idPrefix}custom-desc-${c.id}`}>What is it?</Label>
              <Textarea
                id={`${idPrefix}custom-desc-${c.id}`}
                placeholder="Briefly describe the expense"
                value={c.description}
                onChange={(e) => updateCustomNeed(c.id, { description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}custom-amt-${c.id}`}>Approx. amount</Label>
                <Input
                  id={`${idPrefix}custom-amt-${c.id}`}
                  type="number"
                  min={0}
                  placeholder="$"
                  value={c.amount}
                  onChange={(e) => updateCustomNeed(c.id, { amount: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}custom-pct-${c.id}`}>or % of portfolio</Label>
                <Input
                  id={`${idPrefix}custom-pct-${c.id}`}
                  type="number"
                  min={0}
                  max={100}
                  placeholder="%"
                  value={c.pct}
                  onChange={(e) => updateCustomNeed(c.id, { pct: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-1.5">
              {TIMING_BUCKETS.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => updateCustomNeed(c.id, { timing: t.id })}
                  className={cn(
                    "flex-1 rounded-md border px-2 py-2.5 text-xs font-medium transition-colors",
                    c.timing === t.id ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted/50"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
