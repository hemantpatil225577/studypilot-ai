import { daysBetween } from "./dates.ts";

export type AnTopic = { id: string; title: string; subject_id: string; mastery: number; completed: boolean };
export type AnSubject = { id: string; name: string; exam_date: string | null };
export type AnSession = { id: string; session_date: string; duration_minutes: number; status: "planned" | "completed" | "skipped" };
export type AnAttempt = { id: string; score: number; total: number; created_at: string; topic_id: string | null };

export function computeAnalytics(i: {
  subjects: AnSubject[];
  topics: AnTopic[];
  sessions: AnSession[];
  attempts: AnAttempt[];
  today: string;
}) {
  const completedSessions = i.sessions.filter((s) => s.status === "completed");
  const minutesCompleted = completedSessions.reduce((a, s) => a + s.duration_minutes, 0);
  const totalScore = i.attempts.reduce((a, x) => a + x.score, 0);
  const totalQs = i.attempts.reduce((a, x) => a + x.total, 0);

  const minutesByDay: Record<string, number> = {};
  for (const s of completedSessions) minutesByDay[s.session_date] = (minutesByDay[s.session_date] ?? 0) + s.duration_minutes;

  return {
    subjectCount: i.subjects.length,
    topicCount: i.topics.length,
    completedTopics: i.topics.filter((t) => t.completed).length,
    plannedSessions: i.sessions.filter((s) => s.status === "planned").length,
    completedSessions: completedSessions.length,
    skippedSessions: i.sessions.filter((s) => s.status === "skipped").length,
    minutesCompleted,
    attemptCount: i.attempts.length,
    quizAccuracy: totalQs === 0 ? null : Math.round((totalScore / totalQs) * 100),
    weakest: [...i.topics].filter((t) => !t.completed).sort((a, b) => a.mastery - b.mastery).slice(0, 5),
    upcomingExams: i.subjects
      .filter((s) => s.exam_date && s.exam_date >= i.today)
      .map((s) => ({ name: s.name, date: s.exam_date as string, daysLeft: daysBetween(i.today, s.exam_date as string) }))
      .sort((a, b) => a.daysLeft - b.daysLeft),
    minutesByDay: Object.entries(minutesByDay).sort(([a], [b]) => a.localeCompare(b)).map(([date, minutes]) => ({ date, minutes })),
    attemptSeries: i.attempts.map((a, idx) => ({ n: idx + 1, percent: Math.round((a.score / a.total) * 100) })),
  };
}

export type NextAction = { title: string; detail: string; href: string };

export function nextAction(a: ReturnType<typeof computeAnalytics>, top: { title: string; topicId: string; reasons: string[] } | null): NextAction {
  if (a.subjectCount === 0) return { title: "Add your first subject", detail: "Add a subject and its exam date to start planning.", href: "/subjects" };
  if (a.topicCount === 0) return { title: "Add syllabus topics", detail: "Topics are what the planner and quizzes work from.", href: "/subjects" };
  if (a.plannedSessions === 0) return { title: "Generate a study plan", detail: "You have no planned sessions.", href: "/calendar" };
  if (a.attemptCount === 0 && top) return { title: `Take a quiz on ${top.title}`, detail: "A quiz gives the revision engine real performance data.", href: "/quiz" };
  if (top) return { title: `Revise ${top.title}`, detail: top.reasons.join(", ") || "Highest priority topic.", href: "/tutor" };
  return { title: "All topics look strong", detail: "Add new topics or keep taking quizzes.", href: "/quiz" };
}
