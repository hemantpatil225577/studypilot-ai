"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button, Card, ConfirmButton, Select, Textarea } from "@/components/ui";

type Msg = { role: "user" | "assistant"; content: string };
const MODES = [
  ["simple", "Simple explanation"], ["steps", "Step-by-step example"], ["exam", "Exam-style answer"], ["viva", "Viva practice"],
] as const;

export function TutorChat({ topics }: { topics: { id: string; title: string }[] }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<(typeof MODES)[number][0]>("simple");
  const [topicId, setTopicId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSent, setLastSent] = useState<string | null>(null);
  const [persisted, setPersisted] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/tutor").then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (j?.enabled) { setPersisted(true); setMsgs(j.messages.map((m: Msg) => ({ role: m.role, content: m.content }))); }
    }).catch(() => {});
  }, []);
  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [msgs, busy]);

  async function send(text: string, history: Msg[]) {
    setBusy(true); setError(null); setLastSent(text);
    try {
      const r = await fetch("/api/tutor", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, mode, topicId: topicId || undefined, history: history.slice(-10) }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "Request failed"); return; }
      setMsgs([...history, { role: "user", content: text }, { role: "assistant", content: j.reply }]);
      setLastSent(null);
    } catch { setError("Network error. Check your connection and retry."); }
    finally { setBusy(false); }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = input.trim();
    if (!t || busy) return;
    setInput("");
    send(t, msgs);
  }

  async function clearHistory() {
    const r = await fetch("/api/tutor", { method: "DELETE" });
    if (r.ok) { setMsgs([]); toast.success("History cleared"); } else toast.error("Could not clear history");
  }

  return (
    <Card className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} aria-label="Tutor mode">{MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
        <Select value={topicId} onChange={(e) => setTopicId(e.target.value)} aria-label="Topic context"><option value="">No specific topic</option>{topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</Select>
      </div>
      <div className="max-h-[50vh] min-h-48 space-y-3 overflow-y-auto rounded-lg bg-black/20 p-3" aria-live="polite">
        {msgs.length === 0 && !busy && <p className="text-sm text-slate-400">Ask anything about your course. Try &ldquo;Explain deadlocks&rdquo; or switch to Viva practice.</p>}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : ""}>
            <div className={`inline-block max-w-[90%] whitespace-pre-wrap rounded-xl px-3 py-2 text-left text-sm ${m.role === "user" ? "bg-violet-600 text-white" : "bg-white/10 text-slate-100"}`}>{m.content}</div>
          </div>
        ))}
        {busy && <div className="animate-pulse text-sm text-slate-400">Tutor is thinking…</div>}
        <div ref={end} />
      </div>
      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
          {lastSent && <Button variant="ghost" onClick={() => send(lastSent, msgs)} disabled={busy}>Retry</Button>}
        </div>
      )}
      <form onSubmit={submit} className="space-y-2">
        <Textarea rows={3} value={input} maxLength={2000} onChange={(e) => setInput(e.target.value)} aria-label="Your question" placeholder="Type your question" />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={busy || !input.trim()}>Send</Button>
          <Button type="button" variant="ghost" onClick={() => setMsgs([])}>New chat</Button>
          {persisted && <ConfirmButton label="Delete saved history" confirmLabel="Yes, delete" onConfirm={clearHistory} />}
        </div>
      </form>
    </Card>
  );
}
