import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "@/components/onboarding-form";

export default async function Page() {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const { data: p } = await supabase.from("profiles").select("name,onboarded").eq("id", data.user.id).single();
  if (p?.onboarded) redirect("/dashboard");
  return <OnboardingForm defaultName={p?.name ?? ""} />;
}
