import { createClient } from "@/lib/supabase/server";
import { loadStudyContext } from "@/lib/data";
import { computeAnalytics } from "@/lib/analytics";
import { AnalyticsCharts } from "@/components/analytics-charts";
import { Card, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const c = await loadStudyContext(supabase, user!.id);
  const a = computeAnalytics({ ...c, today: new Date().toISOString().slice(0, 10) });
  const mastery = c.topics.map((t) => ({ name: t.title.length > 18 ? t.title.slice(0, 17) + "…" : t.title, mastery: t.mastery }));
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl text-white">Progress</h1>
      {a.topicCount === 0 ? (
        <EmptyState title="Nothing to analyse yet" body="Add topics, complete study sessions and take quizzes. Charts appear as soon as there is data." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[["Sessions completed", a.completedSessions], ["Sessions skipped", a.skippedSessions], ["Minutes studied", a.minutesCompleted], ["Quiz accuracy", a.quizAccuracy === null ? "n/a" : `${a.quizAccuracy}%`]].map(([k, v]) => (
              <Card key={String(k)}><p className="text-sm text-slate-400">{k}</p><p className="font-display text-xl text-white">{v}</p></Card>
            ))}
          </div>
          <AnalyticsCharts mastery={mastery} minutesByDay={a.minutesByDay} attempts={a.attemptSeries} />
          <Card>
            <h2 className="font-display text-lg text-white">Weakest topics</h2>
            <ul className="mt-2 space-y-1 text-sm">{a.weakest.map((t) => <li key={t.id} className="flex justify-between"><span className="text-white">{t.title}</span><span className="text-slate-400">{t.mastery}% mastery</span></li>)}</ul>
          </Card>
        </>
      )}
    </div>
  );
}
