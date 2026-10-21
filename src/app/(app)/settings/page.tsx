import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/settings-form";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl text-white">Profile and settings</h1>
      <SettingsForm profile={data as Profile} email={user!.email ?? ""} />
    </div>
  );
}
