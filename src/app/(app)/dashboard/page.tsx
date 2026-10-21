import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadStudyContext, rankedForUser } from "@/lib/data";
import { computeAnalytics, nextAction } from "@/lib/analytics";
import { Badge, Card, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const c = await loadStudyContext(supabase, user!.id);
  const today = new Date().toISOString().slice(0, 10);
  const a = computeAnalytics({ ...c, today });
  const ranked = rankedForUser(c.topics, c.subjects, c.attempts, today);
  const next = nextAction(a, ranked[0] ?? null);
  const todays = c.sessions.filter((s) => s.session_date === today && s.status === "planned");
  const titleOf = (id: string) => c.topics.find((t) => t.id === id)?.title ?? "Topic";

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl text-white">Hi {c.profile.name || "there"}</h1>
      <Card>
        <p className="text-sm text-slate-400">Recommended next step</p>
        <h2 className="mt-1 font-display text-xl text-white">{next.title}</h2>
        <p className="mt-1 text-sm text-slate-300">{next.detail}</p>
        <Link href={next.href} className="mt-3 inline-block rounded-lg bg-violet-600 px-4 py-2 text-sm text-white hover:bg-violet-500">Go</Link>
      </Card>

      {a.subjectCount === 0 ? (
        <EmptyState title="Your dashboard is empty" body="Add a subject and some topics. Every number here is calculated from what you save." />
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            ["Topics", `${a.completedTopics}/${a.topicCount} completed`],
            ["Sessions done", `${a.completedSessions} (${a.plannedSessions} planned)`],
            ["Study time", `${Math.floor(a.minutesCompleted / 60)}h ${a.minutesCompleted % 60}m`],
            ["Quiz accuracy", a.quizAccuracy === null ? "No quizzes yet" : `${a.quizAccuracy}%`],
          ].map(([k, v]) => (<Card key={k}><p className="text-sm text-slate-400">{k}</p><p className="mt-1 font-display text-xl text-white">{v}</p></Card>))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-lg text-white">Today</h2>
          {todays.length === 0 ? <p className="mt-2 text-sm text-slate-400">No sessions planned for today.</p> : (
            <ul className="mt-2 space-y-2 text-sm">{todays.map((s) => (<li key={s.id} className="flex justify-between"><span>{s.start_time.slice(0, 5)} · {titleOf(s.topic_id)}</span><span className="text-slate-400">{s.duration_minutes} min</span></li>))}</ul>
          )}
        </Card>
        <Card>
          <h2 className="font-display text-lg text-white">Upcoming exams</h2>
          {a.upcomingExams.length === 0 ? <p className="mt-2 text-sm text-slate-400">No exam dates set.</p> : (
            <ul className="mt-2 space-y-2 text-sm">{a.upcomingExams.map((e) => (<li key={e.name + e.date} className="flex justify-between"><span>{e.name}</span><span className="text-slate-400">{e.date} ({e.daysLeft} days)</span></li>))}</ul>
          )}
        </Card>
        <Card className="lg:col-span-2">
          <h2 className="font-display text-lg text-white">What to revise first</h2>
          <p className="text-xs text-slate-400">Rules-based ranking from mastery, difficulty, exam urgency and quiz results. Not a trained model.</p>
          {ranked.length === 0 ? <p className="mt-2 text-sm text-slate-400">Add topics to see recommendations.</p> : (
            <ul className="mt-3 space-y-2 text-sm">
              {ranked.slice(0, 5).map((r) => (
                <li key={r.topicId} className="flex flex-wrap items-center gap-2">
                  <Badge tone={r.priority === "high" ? "red" : r.priority === "medium" ? "amber" : "slate"}>{r.priority}</Badge>
                  <span className="text-white">{r.title}</span>
                  <span className="text-slate-400">{r.reasons.join(", ")}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
