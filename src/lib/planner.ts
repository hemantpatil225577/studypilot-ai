import { addDays, isValidDate, toMinutes, fromMinutes, TIME_RE } from "./dates.ts";
import type { Ranked } from "./revision.ts";

export type PlannedSession = {
  topicId: string;
  title?: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  priority: "high" | "medium" | "low";
  reason: string;
};

export type ValidationCtx = {
  knownTopicIds: Set<string>;
  dailyLimitMinutes: number;
  windowStart: string;
  windowEnd: string;
  /** minutes already scheduled per date by sessions that will be kept */
  existingMinutesByDate?: Record<string, number>;
};

export function validateSchedule(sessions: PlannedSession[], ctx: ValidationCtx): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  const byDate = new Map<string, PlannedSession[]>();

  sessions.forEach((s, i) => {
    const tag = `Session ${i + 1}`;
    if (!ctx.knownTopicIds.has(s.topicId)) errors.push(`${tag}: unknown topic id`);
    if (!isValidDate(s.date)) {
      errors.push(`${tag}: invalid date`);
      return;
    }
    if (s.date < ctx.windowStart || s.date > ctx.windowEnd) errors.push(`${tag}: date outside the requested window`);
    if (!TIME_RE.test(s.startTime)) {
      errors.push(`${tag}: invalid start time`);
      return;
    }
    if (toMinutes(s.startTime) + s.durationMinutes > 24 * 60) errors.push(`${tag}: runs past midnight`);
    const key = `${s.topicId}|${s.date}|${s.startTime}`;
    if (seen.has(key)) errors.push(`${tag}: duplicate session`);
    seen.add(key);
    byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);
  });

  for (const [date, list] of byDate) {
    const total = list.reduce((a, s) => a + s.durationMinutes, 0) + (ctx.existingMinutesByDate?.[date] ?? 0);
    if (total > ctx.dailyLimitMinutes) errors.push(`${date}: ${total} min exceeds the daily limit of ${ctx.dailyLimitMinutes} min`);
    const sorted = [...list].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
    for (let i = 1; i < sorted.length; i++) {
      const prevEnd = toMinutes(sorted[i - 1].startTime) + sorted[i - 1].durationMinutes;
      if (toMinutes(sorted[i].startTime) < prevEnd) errors.push(`${date}: overlapping time slots at ${sorted[i].startTime}`);
    }
  }
  return errors;
}

export type RulesPlanInput = {
  ranked: (Ranked & { examDate: string | null })[];
  startDate: string;
  days: number;
  dailyLimitMinutes: number;
  sessionMinutes: number;
  startTime?: string;
};

/** Deterministic planner. Output is always labelled source "rules", never "ai". */
export function rulesPlan(input: RulesPlanInput): PlannedSession[] {
  const { ranked, startDate, days, dailyLimitMinutes, sessionMinutes } = input;
  const out: PlannedSession[] = [];
  if (ranked.length === 0) return out;
  const breakMin = 10;
  let pointer = 0;
  for (let d = 0; d < days; d++) {
    const date = addDays(startDate, d);
    let cursor = toMinutes(input.startTime ?? "18:00");
    let used = 0;
    const usedToday = new Set<string>();
    let tries = 0;
    while (used + sessionMinutes <= dailyLimitMinutes && tries < ranked.length) {
      const t = ranked[pointer % ranked.length];
      pointer++;
      tries++;
      if (usedToday.has(t.topicId)) continue;
      if (t.examDate && date > t.examDate) continue;
      if (cursor + sessionMinutes > 24 * 60) break;
      out.push({
        topicId: t.topicId,
        title: t.title,
        date,
        startTime: fromMinutes(cursor),
        durationMinutes: sessionMinutes,
        priority: t.priority,
        reason: t.reasons.length ? `Rules-based: ${t.reasons.join(", ")}` : "Rules-based: scheduled by priority score",
      });
      usedToday.add(t.topicId);
      used += sessionMinutes;
      cursor += sessionMinutes + breakMin;
      tries = 0;
    }
  }
  return out;
}
