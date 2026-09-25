import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PART2_QUESTIONS, type Part2Question } from "@shared/rtq-content";
import type { Part2Answers } from "@shared/answer-types";
import { loadIntake, loadPart1, savePart2 } from "@/lib/rtq-intake";
import { cn } from "@/lib/utils";

const TOTAL_QUESTIONS = PART2_QUESTIONS.length;

export default function Part2() {
  const [, navigate] = useLocation();

  const [index, setIndex] = useState(0);
  const [points, setPoints] = useState<Partial<Record<keyof Part2Answers, number>>>({});

  useEffect(() => {
    if (!loadIntake() || !loadPart1()) navigate("/");
  }, [navigate]);

  function selectAnswer(questionId: Part2Question["id"], value: number) {
    const nextPoints = { ...points, [questionId]: value };
    setPoints(nextPoints);

    if (index < TOTAL_QUESTIONS - 1) {
      setTimeout(() => setIndex((i) => i + 1), 260);
      return;
    }

    // Last question — hand off to Part 3 (time horizon) after the same
    // brief highlight delay. The actual server submission happens once, at
    // the end of Part 3.
    setTimeout(() => {
      savePart2(nextPoints as Part2Answers);
      navigate("/part3");
    }, 260);
  }

  const question = PART2_QUESTIONS[index];

  return (
    <div className="min-h-screen p-6 flex flex-col items-center">
      <div className="w-full max-w-xl pt-8 space-y-1">
        <Progress value={33 + ((index + 1) / TOTAL_QUESTIONS) * 33} />
        <p className="text-xs text-muted-foreground">Part 2 of 3 — Question {index + 1} of {TOTAL_QUESTIONS}</p>
      </div>

      <div className="w-full max-w-xl mt-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={`q-${index}`}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2 }}
          >
            <Card>
              <CardContent className="p-8 space-y-6">
                <h2 className="text-xl leading-snug">{question.prompt}</h2>
                <div className="space-y-2.5">
                  {question.options.map((opt) => {
                    const selected = points[question.id] === opt.points;
                    return (
                      <button
                        type="button"
                        key={opt.label}
                        onClick={() => selectAnswer(question.id, opt.points)}
                        className={cn(
                          "w-full text-left rounded-xl border px-5 py-3.5 text-sm transition-colors",
                          selected ? "border-primary bg-primary text-primary-foreground font-medium" : "border-border hover:border-primary/40 hover:bg-muted/50"
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>

        {index > 0 && (
          <button type="button" onClick={() => setIndex((i) => i - 1)} className="mt-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
        )}
      </div>
    </div>
  );
}
