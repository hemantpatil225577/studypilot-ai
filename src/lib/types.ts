export type Profile = {
  id: string; name: string; study_hours_per_day: number; session_minutes: number;
  tutor_history_enabled: boolean; onboarded: boolean;
};
export type Subject = { id: string; user_id: string; name: string; exam_date: string | null; daily_hours: number | null };
export type Topic = {
  id: string; user_id: string; subject_id: string; title: string; difficulty: number; mastery: number; completed: boolean;
};
export type StudySession = {
  id: string; topic_id: string; session_date: string; start_time: string; duration_minutes: number;
  priority: "high" | "medium" | "low"; reason: string; status: "planned" | "completed" | "skipped"; source: "ai" | "rules" | "manual";
};
export type Attempt = { id: string; score: number; total: number; created_at: string; quiz_id: string; topic_id: string | null };
