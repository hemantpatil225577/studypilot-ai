import { createClient } from "@/lib/supabase/server";
import { SubjectsManager } from "@/components/subjects-manager";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [s, t] = await Promise.all([
    supabase.from("subjects").select("*").eq("user_id", user!.id).order("created_at"),
    supabase.from("topics").select("*").eq("user_id", user!.id).order("created_at"),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl text-white">Subjects and syllabus</h1>
      <SubjectsManager subjects={s.data ?? []} topics={t.data ?? []} />
    </div>
  );
}
