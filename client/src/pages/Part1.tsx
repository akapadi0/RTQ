import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Reorder, useDragControls } from "framer-motion";
import { GripVertical, ChevronDown, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { LIFE_RISK_CATEGORIES, PART1_FREE_RESPONSE_PROMPTS, type LifeRiskCategoryId } from "@shared/rtq-content";
import { loadIntake, savePart1 } from "@/lib/rtq-intake";
import { cn } from "@/lib/utils";

const ALL_IDS = LIFE_RISK_CATEGORIES.map((c) => c.id);

function CategoryItem({
  id,
  rank,
  expanded,
  onToggleExpand,
  selected,
  onToggleConcern,
}: {
  id: LifeRiskCategoryId;
  rank: number;
  expanded: boolean;
  onToggleExpand: () => void;
  selected: string[];
  onToggleConcern: (concernId: string) => void;
}) {
  const category = LIFE_RISK_CATEGORIES.find((c) => c.id === id)!;
  const controls = useDragControls();

  return (
    <Reorder.Item value={id} dragListener={false} dragControls={controls} className="list-none">
      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 p-4">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
            {rank}
          </span>
          <button
            type="button"
            onPointerDown={(e) => controls.start(e)}
            className="shrink-0 touch-none cursor-grab text-muted-foreground active:cursor-grabbing"
            aria-label={`Drag to reorder ${category.label}`}
          >
            <GripVertical className="h-5 w-5" />
          </button>
          <button type="button" onClick={onToggleExpand} className="flex flex-1 items-center justify-between text-left">
            <div>
              <div className="font-medium">{category.label}</div>
              {selected.length > 0 && (
                <div className="text-xs text-accent mt-0.5">{selected.length} selected</div>
              )}
            </div>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", expanded && "rotate-180")} />
          </button>
        </div>

        {expanded && (
          <div className="border-t border-border bg-muted/40 p-4 flex flex-wrap gap-2">
            {category.concerns.map((concern) => {
              const isSelected = selected.includes(concern.id);
              return (
                <button
                  type="button"
                  key={concern.id}
                  onClick={() => onToggleConcern(concern.id)}
                  className={cn(
                    "rounded-full border px-3.5 py-2 text-sm transition-colors",
                    isSelected
                      ? "border-accent bg-accent text-accent-foreground font-medium"
                      : "border-border bg-background hover:border-accent/40"
                  )}
                >
                  {concern.label}
                </button>
              );
            })}
          </div>
        )}
      </Card>
    </Reorder.Item>
  );
}

export default function Part1() {
  const [, navigate] = useLocation();
  const [categoryRank, setCategoryRank] = useState<LifeRiskCategoryId[]>(ALL_IDS);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(ALL_IDS));
  const [selectedConcerns, setSelectedConcerns] = useState<Record<string, string[]>>({});
  const [responses, setResponses] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!loadIntake()) navigate("/");
  }, [navigate]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleConcern(categoryId: string, concernId: string) {
    setSelectedConcerns((prev) => {
      const current = prev[categoryId] ?? [];
      const next = current.includes(concernId) ? current.filter((c) => c !== concernId) : [...current, concernId];
      return { ...prev, [categoryId]: next };
    });
  }

  function submit() {
    savePart1({
      categoryRank,
      selectedConcerns,
      freeText1: responses.freeText1 ?? "",
      freeText2: responses.freeText2 ?? "",
    });
    navigate("/part2");
  }

  return (
    <div className="min-h-screen p-6 flex flex-col items-center">
      <div className="w-full max-w-2xl pt-8 space-y-1">
        <Progress value={22} />
        <p className="text-xs text-muted-foreground">Part 1 of 3 — What's on your mind</p>
      </div>

      <div className="w-full max-w-2xl mt-8 space-y-6">
        <div className="space-y-1.5">
          <h2 className="text-2xl">
            Rank what weighs on you <span className="text-sage">most</span>
          </h2>
          <p className="text-muted-foreground">
            Drag to reorder, starting with what concerns you the most. Tap a category to pick which
            specific things about it are on your mind — that part is independent of the order.
          </p>
        </div>

        <Reorder.Group axis="y" values={categoryRank} onReorder={setCategoryRank} className="space-y-3">
          {categoryRank.map((id, i) => (
            <CategoryItem
              key={id}
              id={id}
              rank={i + 1}
              expanded={expanded.has(id)}
              onToggleExpand={() => toggleExpand(id)}
              selected={selectedConcerns[id] ?? []}
              onToggleConcern={(concernId) => toggleConcern(id, concernId)}
            />
          ))}
        </Reorder.Group>

        <Card>
          <CardContent className="p-8 space-y-6">
            {PART1_FREE_RESPONSE_PROMPTS.map((p) => (
              <div key={p.id} className="space-y-1.5">
                <Label htmlFor={p.id}>{p.prompt}</Label>
                <Textarea
                  id={p.id}
                  value={responses[p.id] ?? ""}
                  onChange={(e) => setResponses((r) => ({ ...r, [p.id]: e.target.value }))}
                  placeholder="Optional — as much or as little as you'd like."
                />
              </div>
            ))}

            <Button size="lg" className="w-full gap-2" onClick={submit}>
              Continue to Part 2
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
