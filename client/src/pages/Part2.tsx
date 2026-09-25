import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PART2_QUESTIONS, type Part2Question } from "@shared/rtq-content";
import type { Part2Answers } from "@shared/answer-types";
import { createRtqResponse } from "@/lib/api";
import { clearIntake, loadIntake, loadPart1, saveResult } from "@/lib/rtq-intake";
import { cn } from "@/lib/utils";

const TOTAL_QUESTIONS = PART2_QUESTIONS.length;

export default function Part2() {
  const [, navigate] = useLocation();

  const [index, setIndex] = useState(0);
  const [points, setPoints] = useState<Partial<Record<keyof Part2Answers, number>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loadIntake() || !loadPart1()) navigate("/");
  }, [navigate]);

  async function selectAnswer(questionId: Part2Question["id"], value: number) {
    const nextPoints = { ...points, [questionId]: value };
    setPoints(nextPoints);

    if (index < TOTAL_QUESTIONS - 1) {
      setTimeout(() => setIndex((i) => i + 1), 260);
      return;
    }

    // Last question — submit after the same brief highlight delay. This is
    // the one and only server write for the whole client-facing flow: it
    // creates the complete row (Part 1 + Part 2 + computed score) in a
    // single append, and computes/freezes the score+tier and sends the
    // results email (client + advisor) as part of this same request.
    setTimeout(async () => {
      setSubmitting(true);
      setError(null);
      try {
        const intake = loadIntake();
        const part1 = loadPart1();
        if (!intake || !part1) {
          navigate("/");
          return;
        }
        const response = await createRtqResponse({
          clientName: intake.clientName,
          clientEmail: intake.clientEmail,
          part1,
          part2: nextPoints as Part2Answers,
        });
        saveResult(response);
        clearIntake();
        navigate(`/results/${response.id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
        setSubmitting(false);
      }
    }, 260);
  }

  const question = PART2_QUESTIONS[index];

  return (
    <div className="min-h-screen p-6 flex flex-col items-center">
      <div className="w-full max-w-xl pt-8 space-y-1">
        <Progress value={((index + 1) / TOTAL_QUESTIONS) * 100} />
        <p className="text-xs text-muted-foreground">Question {index + 1} of {TOTAL_QUESTIONS}</p>
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
                        disabled={submitting}
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
                {error && <p className="text-sm text-destructive">{error}</p>}
                {submitting && <p className="text-sm text-muted-foreground">Submitting...</p>}
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>

        {index > 0 && !submitting && (
          <button type="button" onClick={() => setIndex((i) => i - 1)} className="mt-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
        )}
      </div>
    </div>
  );
}
