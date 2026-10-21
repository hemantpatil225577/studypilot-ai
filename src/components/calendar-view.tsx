"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteSession, rescheduleSession, setSessionStatus, type Result } from "@/app/actions";
import { Badge, Button, Card, ConfirmButton, EmptyState, Input, Select } from "@/components/ui";
import { localToday } from "@/lib/dates";
import type { StudySession } from "@/lib/types";

export function CalendarView({ sessions, topics }: { sessions: StudySession[]; topics: { id: string; title: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const [start0, setStart0] = useState("");
  const [days, setDays] = useState(7);
  const [fallback, setFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resched, setResched] = useState<string | null>(null);
  useEffect(() => setStart0(localToday()), []);

  const title = (id: string) => topics.find((t) => t.id === id)?.title ?? "Topic";

  async function generate(mode: "ai" | "rules") {
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode, startDate: start0, days }) });
      const j = await r.json();
      if (r.status === 401) { router.push("/login"); return; }
      if (!r.ok) {
        setError([j.error, ...(j.details ?? [])].join(" "));
        setFallback(j.code === "AI_UNAVAILABLE" || j.code === "AI_INVALID");
        return;
      }
      setFallback(false);
      toast.success(`${j.count} sessions saved (${j.source === "ai" ? "AI-generated" : "rules-based"})`);
      router.refresh();
    } catch { setError("Network error. Check your connection and retry."); }
    finally { setBusy(false); }
  }

  function act(p: Promise<Result>, ok: string, after?: () => void) {
    start(async () => { const r = await p; if (r.ok) { toast.success(ok); after?.(); } else toast.error(r.error); });
  }

  const dates = Array.from(new Set(sessions.map((s) => s.session_date)));

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="font-display text-lg text-white">Generate a plan</h2>
        <p className="text-sm text-slate-400">Planned sessions in the chosen window are replaced. Completed and skipped sessions are kept.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[auto_auto_1fr]">
          <Input type="date" value={start0} onChange={(e) => setStart0(e.target.value)} aria-label="Start date" />
          <Select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Number of days">{[3, 7, 10, 14].map((d) => <option key={d} value={d}>{d} days</option>)}</Select>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || !start0} onClick={() => generate("ai")}>{busy ? "Generating…" : "Generate with AI"}</Button>
            <Button variant="ghost" disabled={busy || !start0} onClick={() => generate("rules")}>Use rules-based planner</Button>
          </div>
        </div>
        {error && (
          <div role="alert" className="mt-3 rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
            {fallback && <div className="mt-2"><Button variant="ghost" onClick={() => generate("rules")} disabled={busy}>Create a rules-based plan instead</Button></div>}
          </div>
        )}
      </Card>

      {sessions.length === 0 ? (
        <EmptyState title="No sessions yet" body="Generate a plan above. Sessions are saved to your account and survive a reload." />
      ) : (
        dates.map((d) => (
          <Card key={d}>
            <h3 className="font-display text-lg text-white">{d}</h3>
            <ul className="mt-3 space-y-3">
              {sessions.filter((s) => s.session_date === d).map((s) => (
                <li key={s.id} className="rounded-lg bg-white/5 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-white">{s.start_time.slice(0, 5)} · {title(s.topic_id)}</span>
                    <span className="text-sm text-slate-400">{s.duration_minutes} min</span>
                    <Badge tone={s.priority === "high" ? "red" : s.priority === "medium" ? "amber" : "slate"}>{s.priority}</Badge>
                    <Badge tone={s.source === "ai" ? "violet" : "slate"}>{s.source === "ai" ? "AI-generated" : s.source === "rules" ? "Rules-based" : "Manual"}</Badge>
                    <Badge tone={s.status === "completed" ? "green" : s.status === "skipped" ? "amber" : "slate"}>{s.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">{s.reason}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {s.status !== "completed" && <Button disabled={pending} onClick={() => act(setSessionStatus(s.id, "completed"), "Session completed")}>Complete</Button>}
                    {s.status === "planned" && <Button variant="ghost" disabled={pending} onClick={() => act(setSessionStatus(s.id, "skipped"), "Session skipped")}>Skip</Button>}
                    {s.status !== "planned" && <Button variant="ghost" disabled={pending} onClick={() => act(setSessionStatus(s.id, "planned"), "Moved back to planned")}>Reopen</Button>}
                    <Button variant="ghost" onClick={() => setResched(resched === s.id ? null : s.id)}>Reschedule</Button>
                    <ConfirmButton label="Delete" disabled={pending} onConfirm={() => act(deleteSession(s.id), "Session deleted")} />
                  </div>
                  {resched === s.id && (
                    <form className="mt-2 flex flex-wrap gap-2" onSubmit={(e) => {
                      e.preventDefault(); const f = new FormData(e.currentTarget);
                      act(rescheduleSession(s.id, String(f.get("date")), String(f.get("time"))), "Session rescheduled", () => setResched(null));
                    }}>
                      <Input name="date" type="date" defaultValue={s.session_date} aria-label="New date" className="w-auto" required />
                      <Input name="time" type="time" defaultValue={s.start_time.slice(0, 5)} aria-label="New time" className="w-auto" required />
                      <Button type="submit" disabled={pending}>Save</Button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}
    </div>
  );
}
