import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Landing() {
  const { data } = await createClient().auth.getUser();
  const cta = data.user ? { href: "/dashboard", label: "Open dashboard" } : { href: "/register", label: "Create your account" };
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <nav className="flex items-center justify-between">
        <span className="font-display text-xl font-semibold text-white">StudyPilot AI</span>
        {!data.user && <Link href="/login" className="text-sm text-slate-300 hover:text-white">Sign in</Link>}
      </nav>
      <section className="py-24">
        <h1 className="max-w-3xl font-display text-5xl font-semibold leading-tight text-white sm:text-6xl">
          Know what to revise tonight, and why.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-slate-300">
          Add your syllabus and exam dates. StudyPilot schedules your sessions, quizzes you on weak topics, and shows a plain explanation for every recommendation.
        </p>
        <Link href={cta.href} className="mt-8 inline-block rounded-lg bg-violet-600 px-6 py-3 font-medium text-white hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300">
          {cta.label}
        </Link>
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ["Study planner", "An AI-generated or clearly labelled rules-based schedule that respects your daily hours."],
          ["Tutor and quizzes", "Ask questions, rehearse a viva, and take quizzes graded on the server."],
          ["Honest analytics", "Every number is calculated from your saved sessions and quiz attempts."],
        ].map(([t, b]) => (
          <div key={t} className="glass rounded-2xl p-5">
            <h2 className="font-display text-lg text-white">{t}</h2>
            <p className="mt-2 text-sm text-slate-400">{b}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
