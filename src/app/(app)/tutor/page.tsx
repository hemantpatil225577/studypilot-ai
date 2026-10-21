import { createClient } from "@/lib/supabase/server";
import { TutorChat } from "@/components/tutor-chat";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase.from("topics").select("id,title").eq("user_id", user!.id).order("title");
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl text-white">AI tutor</h1>
      <TutorChat topics={data ?? []} />
    </div>
  );
}
