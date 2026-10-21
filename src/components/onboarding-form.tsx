"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { completeOnboarding } from "@/app/actions";
import { Button, Card, Input, Label, Select } from "@/components/ui";

export function OnboardingForm({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const topics = String(f.get("topics") ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
    setError(null);
    start(async () => {
      const r = await completeOnboarding({
        profile: { name: f.get("name"), studyHoursPerDay: f.get("hours"), sessionMinutes: f.get("session") },
        subject: { name: f.get("subject"), examDate: f.get("exam") ? String(f.get("exam")) : null },
        topics,
        difficulty: f.get("difficulty"),
      });
      if (!r.ok) { setError(r.error); return; }
      toast.success("You're set up");
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <h1 className="font-display text-3xl text-white">Set up your study profile</h1>
      <p className="mt-2 text-slate-400">You can change all of this later in Settings and Subjects.</p>
      <Card className="mt-6">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div><Label htmlFor="name">Your name</Label><Input id="name" name="name" defaultValue={defaultName} required /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label htmlFor="hours">Study hours per day</Label><Input id="hours" name="hours" type="number" step="0.5" min="0.5" max="16" defaultValue="2" required /></div>
            <div><Label htmlFor="session">Session length (minutes)</Label><Input id="session" name="session" type="number" step="5" min="15" max="180" defaultValue="45" required /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label htmlFor="subject">First subject</Label><Input id="subject" name="subject" required /></div>
            <div><Label htmlFor="exam">Exam date</Label><Input id="exam" name="exam" type="date" /></div>
          </div>
          <div><Label htmlFor="topics">Topics (one per line, optional)</Label>
            <textarea id="topics" name="topics" rows={4} className="w-full rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400" /></div>
          <div><Label htmlFor="difficulty">Typical topic difficulty</Label>
            <Select id="difficulty" name="difficulty" defaultValue="3">{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} of 5</option>)}</Select></div>
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          <Button type="submit" disabled={pending} className="w-full">{pending ? "Saving…" : "Save and continue"}</Button>
        </form>
      </Card>
    </main>
  );
}
