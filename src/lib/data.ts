import type { SupabaseClient } from "@supabase/supabase-js";
import type { Attempt, Profile, StudySession, Subject, Topic } from "@/lib/types";
import { rankTopics, type RevisionTopic } from "@/lib/revision";

export async function loadStudyContext(supabase: SupabaseClient, userId: string) {
  const [p, s, t, ses, att] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("subjects").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("topics").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("study_sessions").select("*").eq("user_id", userId).order("session_date").order("start_time"),
    supabase.from("quiz_attempts").select("id,score,total,created_at,quiz_id,quizzes(topic_id)").eq("user_id", userId).order("created_at"),
  ]);
  const firstError = p.error ?? s.error ?? t.error ?? ses.error ?? att.error;
  if (firstError) throw new Error("Failed to load study data");

  const attempts: Attempt[] = (att.data ?? []).map((a) => {
    const q = a.quizzes as unknown as { topic_id: string } | { topic_id: string }[] | null;
    const topicId = Array.isArray(q) ? q[0]?.topic_id ?? null : q?.topic_id ?? null;
    return { id: a.id, score: a.score, total: a.total, created_at: a.created_at, quiz_id: a.quiz_id, topic_id: topicId };
  });
  return {
    profile: p.data as Profile,
    subjects: (s.data ?? []) as Subject[],
    topics: (t.data ?? []) as Topic[],
    sessions: (ses.data ?? []) as StudySession[],
    attempts,
  };
}

export function toRevisionTopics(topics: Topic[], subjects: Subject[], attempts: Attempt[]): (RevisionTopic & { subjectName: string })[] {
  const acc = new Map<string, { s: number; t: number }>();
  for (const a of attempts) {
    if (!a.topic_id) continue;
    const cur = acc.get(a.topic_id) ?? { s: 0, t: 0 };
    acc.set(a.topic_id, { s: cur.s + a.score, t: cur.t + a.total });
  }
  return topics.map((t) => {
    const sub = subjects.find((x) => x.id === t.subject_id);
    const a = acc.get(t.id);
    return {
      id: t.id, title: t.title, difficulty: t.difficulty, mastery: t.mastery, completed: t.completed,
      examDate: sub?.exam_date ?? null, quizAccuracy: a && a.t > 0 ? a.s / a.t : null, subjectName: sub?.name ?? "",
    };
  });
}

export function rankedForUser(topics: Topic[], subjects: Subject[], attempts: Attempt[], today: string) {
  const rt = toRevisionTopics(topics, subjects, attempts);
  const examByTopic = new Map(rt.map((t) => [t.id, t.examDate]));
  return rankTopics(rt, today).map((r) => ({ ...r, examDate: examByTopic.get(r.topicId) ?? null }));
}
