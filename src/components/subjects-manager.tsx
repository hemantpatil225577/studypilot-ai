"use client";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { createSubject, createTopic, deleteSubject, deleteTopic, updateSubject, updateTopic, type Result } from "@/app/actions";
import { Badge, Button, Card, ConfirmButton, EmptyState, Input, Select } from "@/components/ui";
import type { Subject, Topic } from "@/lib/types";

export function SubjectsManager({ subjects, topics }: { subjects: Subject[]; topics: Topic[] }) {
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "done" | "weak">("all");
  const [sort, setSort] = useState<"added" | "mastery" | "difficulty" | "title">("added");
  const [editing, setEditing] = useState<string | null>(null);

  function run(p: Promise<Result>, ok: string, after?: () => void) {
    start(async () => {
      const r = await p;
      if (r.ok) { toast.success(ok); after?.(); } else toast.error(r.error);
    });
  }

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    const fn = (t: Topic) =>
      (!term || t.title.toLowerCase().includes(term)) &&
      (filter === "all" || (filter === "open" && !t.completed) || (filter === "done" && t.completed) || (filter === "weak" && t.mastery < 50));
    const cmp: Record<string, (a: Topic, b: Topic) => number> = {
      added: () => 0, mastery: (a, b) => a.mastery - b.mastery, difficulty: (a, b) => b.difficulty - a.difficulty, title: (a, b) => a.title.localeCompare(b.title),
    };
    return topics.filter(fn).sort(cmp[sort]);
  }, [topics, q, filter, sort]);

  return (
    <div className="space-y-4">
      <Card>
        <form className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]" onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget; const f = new FormData(form);
          run(createSubject({ name: f.get("name"), examDate: f.get("exam") ? String(f.get("exam")) : null }), "Subject added", () => form.reset());
        }}>
          <Input name="name" placeholder="New subject name" aria-label="Subject name" required />
          <Input name="exam" type="date" aria-label="Exam date" />
          <Button type="submit" disabled={pending}>Add subject</Button>
        </form>
      </Card>

      <Card className="grid gap-3 sm:grid-cols-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search topics" aria-label="Search topics" />
        <Select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="Filter topics">
          <option value="all">All topics</option><option value="open">Not completed</option><option value="done">Completed</option><option value="weak">Mastery under 50%</option>
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort topics">
          <option value="added">Order added</option><option value="mastery">Weakest first</option><option value="difficulty">Hardest first</option><option value="title">Title A to Z</option>
        </Select>
      </Card>

      {subjects.length === 0 && <EmptyState title="No subjects yet" body="Add a subject above, then add its syllabus topics." />}

      {subjects.map((s) => {
        const list = visible.filter((t) => t.subject_id === s.id);
        return (
          <Card key={s.id}>
            {editing === s.id ? (
              <form className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]" onSubmit={(e) => {
                e.preventDefault(); const f = new FormData(e.currentTarget);
                run(updateSubject(s.id, { name: f.get("name"), examDate: f.get("exam") ? String(f.get("exam")) : null }), "Subject updated", () => setEditing(null));
              }}>
                <Input name="name" defaultValue={s.name} aria-label="Subject name" required />
                <Input name="exam" type="date" defaultValue={s.exam_date ?? ""} aria-label="Exam date" />
                <Button type="submit" disabled={pending}>Save</Button>
                <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              </form>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><h2 className="font-display text-xl text-white">{s.name}</h2><p className="text-sm text-slate-400">{s.exam_date ? `Exam: ${s.exam_date}` : "No exam date"}</p></div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setEditing(s.id)}>Edit</Button>
                  <ConfirmButton label="Delete subject" disabled={pending} onConfirm={() => run(deleteSubject(s.id), "Subject deleted")} />
                </div>
              </div>
            )}

            <ul className="mt-4 space-y-2">
              {list.map((t) => <TopicRow key={t.id} t={t} pending={pending} run={run} />)}
              {list.length === 0 && <li className="text-sm text-slate-400">No topics match.</li>}
            </ul>

            <form className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]" onSubmit={(e) => {
              e.preventDefault(); const form = e.currentTarget; const f = new FormData(form);
              run(createTopic(s.id, { title: f.get("title"), difficulty: f.get("difficulty"), mastery: 0 }), "Topic added", () => form.reset());
            }}>
              <Input name="title" placeholder="Add a topic" aria-label={`New topic for ${s.name}`} required />
              <Select name="difficulty" defaultValue="3" aria-label="Difficulty">{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Difficulty {n}</option>)}</Select>
              <Button type="submit" disabled={pending}>Add topic</Button>
            </form>
          </Card>
        );
      })}
    </div>
  );
}

function TopicRow({ t, pending, run }: { t: Topic; pending: boolean; run: (p: Promise<Result>, ok: string, after?: () => void) => void }) {
  const [edit, setEdit] = useState(false);
  const save = (patch: Partial<{ title: string; difficulty: number; mastery: number; completed: boolean }>, msg: string, after?: () => void) =>
    run(updateTopic(t.id, { title: t.title, difficulty: t.difficulty, mastery: t.mastery, completed: t.completed, ...patch }), msg, after);

  if (edit) {
    return (
      <li>
        <form className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto]" onSubmit={(e) => {
          e.preventDefault(); const f = new FormData(e.currentTarget);
          save({ title: String(f.get("title")), difficulty: Number(f.get("difficulty")), mastery: Number(f.get("mastery")) }, "Topic updated", () => setEdit(false));
        }}>
          <Input name="title" defaultValue={t.title} aria-label="Topic title" required />
          <Select name="difficulty" defaultValue={t.difficulty} aria-label="Difficulty">{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Diff {n}</option>)}</Select>
          <Input name="mastery" type="number" min={0} max={100} defaultValue={t.mastery} aria-label="Mastery percent" className="w-24" />
          <Button type="submit" disabled={pending}>Save</Button>
          <Button type="button" variant="ghost" onClick={() => setEdit(false)}>Cancel</Button>
        </form>
      </li>
    );
  }
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
      <input type="checkbox" checked={t.completed} disabled={pending} aria-label={`Mark ${t.title} complete`} onChange={(e) => save({ completed: e.target.checked }, e.target.checked ? "Topic completed" : "Topic reopened")} className="h-4 w-4 accent-violet-500" />
      <span className={t.completed ? "text-slate-500 line-through" : "text-white"}>{t.title}</span>
      <Badge tone="violet">Diff {t.difficulty}</Badge>
      <Badge tone={t.mastery < 50 ? "amber" : "green"}>Mastery {t.mastery}%</Badge>
      <span className="ml-auto flex gap-2">
        <Button variant="ghost" onClick={() => setEdit(true)}>Edit</Button>
        <ConfirmButton label="Delete" disabled={pending} onConfirm={() => run(deleteTopic(t.id), "Topic deleted")} />
      </span>
    </li>
  );
}
