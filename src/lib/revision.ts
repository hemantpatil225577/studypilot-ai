import { daysBetween } from "./dates.ts";

export type RevisionTopic = {
  id: string;
  title: string;
  difficulty: number; // 1-5
  mastery: number; // 0-100
  completed: boolean;
  examDate: string | null;
  quizAccuracy: number | null; // 0-1, null when no attempts
};

export type Ranked = {
  topicId: string;
  title: string;
  score: number; // 0-1
  priority: "high" | "medium" | "low";
  reasons: string[];
};

// Weights are fixed and visible: this is a transparent rules engine, not a trained model.
export const WEIGHTS = { weakness: 0.4, urgency: 0.3, difficulty: 0.15, quizGap: 0.15 };

export function urgencyFor(examDate: string | null, today: string): number {
  if (!examDate) return 0.2;
  const d = daysBetween(today, examDate);
  if (d < 0) return 0; // exam already passed
  return Math.max(0, Math.min(1, 1 - d / 45));
}

export function rankTopics(topics: RevisionTopic[], today: string): Ranked[] {
  const out: Ranked[] = [];
  for (const t of topics) {
    if (t.completed && t.mastery >= 85) continue;
    const weakness = (100 - t.mastery) / 100;
    const urgency = urgencyFor(t.examDate, today);
    const diff = (t.difficulty - 1) / 4;
    const gap = t.quizAccuracy === null ? 0.5 : 1 - t.quizAccuracy;
    const score =
      WEIGHTS.weakness * weakness + WEIGHTS.urgency * urgency + WEIGHTS.difficulty * diff + WEIGHTS.quizGap * gap;

    const reasons: string[] = [];
    if (weakness >= 0.6) reasons.push(`mastery is only ${t.mastery}%`);
    if (t.examDate && urgency > 0) reasons.push(`exam in ${daysBetween(today, t.examDate)} day(s)`);
    if (t.difficulty >= 4) reasons.push(`rated difficulty ${t.difficulty}/5`);
    if (t.quizAccuracy !== null && t.quizAccuracy < 0.6) reasons.push(`quiz accuracy ${Math.round(t.quizAccuracy * 100)}%`);
    if (t.quizAccuracy === null) reasons.push("no quiz taken yet");
    out.push({
      topicId: t.id,
      title: t.title,
      score: Math.round(score * 1000) / 1000,
      priority: score >= 0.55 ? "high" : score >= 0.35 ? "medium" : "low",
      reasons,
    });
  }
  return out.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

// Blend previous mastery with the latest quiz percentage (0-100). Documented heuristic.
export function updateMastery(old: number, quizPercent: number): number {
  return Math.max(0, Math.min(100, Math.round(0.6 * old + 0.4 * quizPercent)));
}

// Small bump when a study session is completed.
export function masteryAfterSession(old: number): number {
  return Math.min(100, old + 5);
}
