import { createClient } from "@/lib/supabase/server";
import { CalendarView } from "@/components/calendar-view";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [ses, top] = await Promise.all([
    supabase.from("study_sessions").select("*").eq("user_id", user!.id).order("session_date").order("start_time"),
    supabase.from("topics").select("id,title").eq("user_id", user!.id),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl text-white">Study calendar</h1>
      <CalendarView sessions={ses.data ?? []} topics={top.data ?? []} />
    </div>
  );
}
