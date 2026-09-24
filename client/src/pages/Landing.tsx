import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight } from "lucide-react";
import { createRtqResponse } from "@/lib/px-data";

export default function Landing() {
  const [, navigate] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setStarting(true);
    setError(null);
    try {
      const created = await createRtqResponse({ clientName: name, clientEmail: email });
      navigate(`/part1/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setStarting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="w-full max-w-xl">
        <Card>
          <CardContent className="p-8 space-y-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-accent">Wealth IQ</p>
              <h1 className="text-3xl">
                Risk Tolerance <span className="text-sage">Questionnaire</span>
              </h1>
              <p className="text-muted-foreground">
                Two short parts. Part 1 is about what's actually on your mind when you hear the word
                "risk" — it's often not just the market. Part 2 is seven quick questions about how you
                think about risk and money, including one about a downturn you actually lived through.
                Takes about 10 minutes.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Your name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Client" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Your email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button size="lg" className="w-full gap-2" disabled={!name || !email || starting} onClick={start}>
              {starting ? "Starting..." : "Start Part 1"}
              {!starting && <ArrowRight className="h-4 w-4" />}
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
