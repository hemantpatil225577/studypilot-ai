import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth-actions";

const NAV = [
  ["/dashboard", "Dashboard"], ["/subjects", "Subjects"], ["/calendar", "Calendar"], ["/tutor", "Tutor"],
  ["/quiz", "Quizzes"], ["/analytics", "Analytics"], ["/settings", "Settings"],
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const { data: p } = await supabase.from("profiles").select("name,onboarded").eq("id", data.user.id).single();
  if (!p?.onboarded) redirect("/onboarding");
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:flex-row">
      <aside className="md:w-52 md:shrink-0">
        <div className="mb-4 font-display text-xl font-semibold text-white">StudyPilot AI</div>
        <nav aria-label="Main" className="flex gap-1 overflow-x-auto md:flex-col">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">{label}</Link>
          ))}
        </nav>
        <form action={signOut} className="mt-4">
          <button className="rounded-lg px-3 py-2 text-sm text-slate-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">Sign out ({p.name || "you"})</button>
        </form>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
