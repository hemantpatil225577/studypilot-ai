import { createClient } from "@/lib/supabase/server";
import { QuizWorkspace } from "@/components/quiz-workspace";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [top, att] = await Promise.all([
    supabase.from("topics").select("id,title").eq("user_id", user!.id).order("title"),
    supabase.from("quiz_attempts").select("id,score,total,created_at,quizzes(source,topics(title))").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(15),
  ]);
  type Row = { id: string; score: number; total: number; created_at: string; quizzes: unknown };
  const history = ((att.data ?? []) as Row[]).map((a) => {
    const q = (Array.isArray(a.quizzes) ? a.quizzes[0] : a.quizzes) as { source: string; topics: { title: string } | { title: string }[] | null } | null;
    const t = Array.isArray(q?.topics) ? q?.topics[0] : q?.topics;
    return { id: a.id, score: a.score, total: a.total, at: a.created_at, topic: t?.title ?? "Deleted topic", sample: q?.source === "sample" };
  });
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl text-white">Quizzes</h1>
      <QuizWorkspace topics={top.data ?? []} history={history} />
    </div>
  );
}
