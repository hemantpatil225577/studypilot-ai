import { describe, it, expect } from "vitest";
import { validateSchedule, rulesPlan, type PlannedSession } from "../src/lib/planner.ts";
import { rankTopics, updateMastery, urgencyFor } from "../src/lib/revision.ts";
import { gradeAnswers } from "../src/lib/grading.ts";
import { computeAnalytics, nextAction } from "../src/lib/analytics.ts";
import { extractJson } from "../src/lib/json.ts";
import { isValidDate, addDays } from "../src/lib/dates.ts";

const ctx = { knownTopicIds: new Set(["a", "b"]), dailyLimitMinutes: 120, windowStart: "2026-11-01", windowEnd: "2026-11-07" };
const s = (o: Partial<PlannedSession> = {}): PlannedSession => ({
  topicId: "a", date: "2026-11-02", startTime: "18:00", durationMinutes: 45, priority: "high", reason: "x", ...o,
});

describe("validateSchedule", () => {
  it("accepts a valid schedule", () => expect(validateSchedule([s(), s({ topicId: "b", startTime: "19:00" })], ctx)).toEqual([]));
  it("rejects unknown topic ids", () => expect(validateSchedule([s({ topicId: "zzz" })], ctx).join()).toContain("unknown topic"));
  it("rejects invalid dates", () => expect(validateSchedule([s({ date: "2026-02-31" })], ctx).join()).toContain("invalid date"));
  it("rejects dates outside the window", () => expect(validateSchedule([s({ date: "2026-12-01" })], ctx).join()).toContain("outside"));
  it("rejects duplicates", () => expect(validateSchedule([s(), s()], ctx).join()).toContain("duplicate"));
  it("rejects overlapping slots", () =>
    expect(validateSchedule([s(), s({ topicId: "b", startTime: "18:30" })], ctx).join()).toContain("overlapping"));
  it("rejects days over the daily limit", () =>
    expect(validateSchedule([s({ durationMinutes: 90 }), s({ topicId: "b", startTime: "20:00", durationMinutes: 60 })], ctx).join()).toContain("daily limit"));
  it("counts existing minutes toward the limit", () =>
    expect(validateSchedule([s({ durationMinutes: 60 })], { ...ctx, existingMinutesByDate: { "2026-11-02": 90 } }).join()).toContain("daily limit"));
  it("rejects invalid times", () => expect(validateSchedule([s({ startTime: "25:99" })], ctx).join()).toContain("invalid start time"));
});

describe("rulesPlan", () => {
  const ranked = rankTopics(
    [
      { id: "a", title: "A", difficulty: 5, mastery: 10, completed: false, examDate: "2026-11-10", quizAccuracy: null },
      { id: "b", title: "B", difficulty: 2, mastery: 80, completed: false, examDate: null, quizAccuracy: 0.9 },
    ],
    "2026-11-01",
  ).map((r) => ({ ...r, examDate: null }));
  it("produces a schedule that passes validation", () => {
    const plan = rulesPlan({ ranked, startDate: "2026-11-01", days: 5, dailyLimitMinutes: 120, sessionMinutes: 45 });
    expect(plan.length).toBeGreaterThan(0);
    expect(validateSchedule(plan, ctx)).toEqual([]);
  });
  it("returns nothing when there are no topics", () =>
    expect(rulesPlan({ ranked: [], startDate: "2026-11-01", days: 3, dailyLimitMinutes: 120, sessionMinutes: 45 })).toEqual([]));
  it("never exceeds the daily limit", () => {
    const plan = rulesPlan({ ranked, startDate: "2026-11-01", days: 3, dailyLimitMinutes: 60, sessionMinutes: 45 });
    expect(plan.filter((p) => p.date === "2026-11-01").length).toBe(1);
  });
});

describe("revision engine", () => {
  it("ranks weak, urgent topics first", () => {
    const r = rankTopics(
      [
        { id: "strong", title: "Strong", difficulty: 2, mastery: 90, completed: false, examDate: "2026-12-30", quizAccuracy: 0.95 },
        { id: "weak", title: "Weak", difficulty: 4, mastery: 20, completed: false, examDate: "2026-11-05", quizAccuracy: 0.3 },
      ],
      "2026-11-01",
    );
    expect(r[0].topicId).toBe("weak");
    expect(r[0].priority).toBe("high");
    expect(r[0].reasons.length).toBeGreaterThan(0);
  });
  it("skips completed, mastered topics", () =>
    expect(rankTopics([{ id: "x", title: "X", difficulty: 3, mastery: 95, completed: true, examDate: null, quizAccuracy: 1 }], "2026-11-01")).toEqual([]));
  it("urgency is 0 for past exams and higher for closer ones", () => {
    expect(urgencyFor("2026-10-01", "2026-11-01")).toBe(0);
    expect(urgencyFor("2026-11-03", "2026-11-01")).toBeGreaterThan(urgencyFor("2026-12-01", "2026-11-01"));
  });
  it("updates mastery within 0-100", () => {
    expect(updateMastery(50, 100)).toBe(70);
    expect(updateMastery(100, 100)).toBe(100);
    expect(updateMastery(0, 0)).toBe(0);
  });
});

describe("grading", () => {
  const qs = [{ id: "1", correctIndex: 2, explanation: "e1" }, { id: "2", correctIndex: 0, explanation: "e2" }];
  it("scores answers on the server side", () => {
    const g = gradeAnswers(qs, [2, 1]);
    expect(g.score).toBe(1);
    expect(g.percent).toBe(50);
    expect(g.results[1].correct).toBe(false);
  });
  it("treats unanswered and out-of-range values as wrong", () => expect(gradeAnswers(qs, [null, 9]).score).toBe(0));
  it("rejects a wrong number of answers", () => expect(() => gradeAnswers(qs, [1])).toThrow());
});

describe("analytics", () => {
  const base = { subjects: [], topics: [], sessions: [], attempts: [], today: "2026-11-01" };
  it("handles an empty account", () => {
    const a = computeAnalytics(base);
    expect(a.quizAccuracy).toBeNull();
    expect(nextAction(a, null).href).toBe("/subjects");
  });
  it("computes values from data", () => {
    const a = computeAnalytics({
      ...base,
      subjects: [{ id: "s", name: "Math", exam_date: "2026-11-11" }],
      topics: [{ id: "t", title: "Algebra", subject_id: "s", mastery: 30, completed: false }],
      sessions: [
        { id: "1", session_date: "2026-11-01", duration_minutes: 45, status: "completed" },
        { id: "2", session_date: "2026-11-02", duration_minutes: 30, status: "planned" },
      ],
      attempts: [{ id: "q", score: 3, total: 4, created_at: "x", topic_id: "t" }],
    });
    expect(a.minutesCompleted).toBe(45);
    expect(a.quizAccuracy).toBe(75);
    expect(a.upcomingExams[0].daysLeft).toBe(10);
    expect(a.weakest[0].title).toBe("Algebra");
  });
});

describe("helpers", () => {
  it("extracts JSON from fenced output", () => expect(extractJson('Sure!\n```json\n{"a":1}\n```')).toEqual({ a: 1 }));
  it("throws on non-JSON", () => expect(() => extractJson("nothing here")).toThrow());
  it("validates dates", () => {
    expect(isValidDate("2026-02-28")).toBe(true);
    expect(isValidDate("2026-02-30")).toBe(false);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});
