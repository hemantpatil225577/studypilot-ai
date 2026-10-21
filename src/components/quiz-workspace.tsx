"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, EmptyState, Select } from "@/components/ui";

type Q = { id: string; question: string; options: string[] };
type Quiz = { quizId: string; source: "ai" | "sample"; title: string; questions: Q[] };
type Result = { score: number; total: number; percent: number; results: { questionId: string; selected: number | null; correctIndex: number; correct: boolean; explanation: string }[] };
type Hist = { id: string; score: number; total: number; at: string; topic: string; sample: boolean };

export function QuizWorkspace({ topics, history }: { topics: { id: string; title: string }[]; history: Hist[] }) {
  const router = useRouter();
  const [topicId, setTopicId] = useState("");
  const [count, setCount] = useState(5);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canSample, setCanSample] = useState(false);

  async function generate(sample: boolean) {
    if (!topicId) { setError("Choose a topic first."); return; }
    setBusy(true); setError(null); setResult(null);
    try {
      const r = await fetch("/api/quiz", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ topicId, count, sample }) });
      const j = await r.json();
      if (r.status === 401) { router.push("/login"); return; }
      if (!r.ok) { setError(j.error); setCanSample(j.code === "AI_UNAVAILABLE" || j.code === "AI_INVALID"); return; }
      setQuiz(j); setAnswers(j.questions.map(() => null)); setIdx(0); setCanSample(false);
    } catch { setError("Network error. Check your connection and retry."); }
    finally { setBusy(false); }
  }

  async function submit() {
    if (!quiz) return;
    setBusy(true); setError(null);
    try {
      const r = await fetch(`/api/quiz/${quiz.quizId}/submit`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ answers }) });
      const j = await r.json();
      if (!r.ok) { setError(j.error); return; }
      setResult(j); router.refresh();
    } catch { setError("Network error. Your answers are still here. Try submitting again."); }
    finally { setBusy(false); }
  }

  if (quiz && result) {
    return (
      <Card className="space-y-4">
        <h2 className="font-display text-2xl text-white">You scored {result.score}/{result.total} ({result.percent}%)</h2>
        {quiz.source === "sample" && <Badge tone="amber">Sample quiz: generic study-skills questions, not generated from your topic</Badge>}
        <ol className="space-y-4">
          {quiz.questions.map((q, i) => {
            const r = result.results[i];
            return (
              <li key={q.id} className="rounded-lg bg-white/5 p-3 text-sm">
                <p className="text-white">{i + 1}. {q.question}</p>
                <p className={r.correct ? "text-emerald-300" : "text-red-300"}>Your answer: {r.selected === null ? "none" : q.options[r.selected]}</p>
                {!r.correct && <p className="text-emerald-300">Correct answer: {q.options[r.correctIndex]}</p>}
                <p className="mt-1 text-slate-400">{r.explanation}</p>
              </li>
            );
          })}
        </ol>
        <Button onClick={() => { setQuiz(null); setResult(null); }}>Take another quiz</Button>
      </Card>
    );
  }

  if (quiz) {
    const q = quiz.questions[idx];
    const last = idx === quiz.questions.length - 1;
    return (
      <Card className="space-y-4">
        <div className="flex items-center justify-between text-sm text-slate-400"><span>{quiz.title}</span><span>Question {idx + 1} of {quiz.questions.length}</span></div>
        {quiz.source === "sample" && <Badge tone="amber">Sample quiz: generic study-skills questions, not generated from your topic</Badge>}
        <fieldset>
          <legend className="text-lg text-white">{q.question}</legend>
          <div className="mt-3 space-y-2">
            {q.options.map((o, i) => (
              <label key={i} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${answers[idx] === i ? "border-violet-400 bg-violet-500/20" : "border-white/10 bg-white/5"}`}>
                <input type="radio" name={`q-${q.id}`} checked={answers[idx] === i} onChange={() => setAnswers(answers.map((a, k) => (k === idx ? i : a)))} className="accent-violet-500" />
                {o}
              </label>
            ))}
          </div>
        </fieldset>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <div className="flex gap-2">
          <Button variant="ghost" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>Back</Button>
          {!last ? <Button onClick={() => setIdx(idx + 1)}>Next</Button> : <Button disabled={busy} onClick={submit}>{busy ? "Submitting…" : "Submit quiz"}</Button>}
        </div>
        <p className="text-xs text-slate-500">Unanswered questions count as wrong. Correct answers are revealed only after you submit.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {topics.length === 0 ? (
        <EmptyState title="No topics to quiz on" body="Add syllabus topics in Subjects first." />
      ) : (
        <Card className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Select value={topicId} onChange={(e) => setTopicId(e.target.value)} aria-label="Topic"><option value="">Choose a topic</option>{topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</Select>
            <Select value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label="Number of questions">{[3, 5, 8, 10].map((n) => <option key={n} value={n}>{n} questions</option>)}</Select>
          </div>
          <Button disabled={busy} onClick={() => generate(false)}>{busy ? "Generating…" : "Generate AI quiz"}</Button>
          {error && (
            <div role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
              {canSample && <div className="mt-2"><Button variant="ghost" onClick={() => generate(true)} disabled={busy}>Use a labelled sample quiz</Button></div>}
            </div>
          )}
        </Card>
      )}
      <Card>
        <h2 className="font-display text-lg text-white">Recent attempts</h2>
        {history.length === 0 ? <p className="mt-2 text-sm text-slate-400">No attempts yet.</p> : (
          <ul className="mt-2 divide-y divide-white/10 text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-white">{h.topic} {h.sample && <Badge tone="amber">sample</Badge>}</span>
                <span className="text-slate-400">{h.score}/{h.total} · {new Date(h.at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
