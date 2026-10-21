import { NextResponse } from "next/server";
import { ApiError, rateLimit, readJson, requireUser, route } from "@/lib/api";
import { planRequestSchema, aiPlanSchema } from "@/lib/schemas";
import { loadStudyContext, rankedForUser } from "@/lib/data";
import { AiUnavailableError, DATA_GUARD, aiComplete } from "@/lib/ai/provider";
import { extractJson } from "@/lib/json";
import { addDays } from "@/lib/dates";
import { rulesPlan, validateSchedule, type PlannedSession } from "@/lib/planner";
import { log } from "@/lib/logger";

export const POST = route(async (req) => {
  const { supabase, user } = await requireUser();
  const body = planRequestSchema.parse(await readJson(req));
  const ctx = await loadStudyContext(supabase, user.id);
  const windowEnd = addDays(body.startDate, body.days - 1);
  const dailyLimit = Math.round(ctx.profile.study_hours_per_day * 60);
  const ranked = rankedForUser(ctx.topics, ctx.subjects, ctx.attempts, body.startDate);
  if (ranked.length === 0) throw new ApiError(400, "Add at least one unfinished topic before planning.", "NO_TOPICS");

  // Completed/skipped sessions in the window are kept; only 'planned' ones are replaced.
  const kept = ctx.sessions.filter((s) => s.session_date >= body.startDate && s.session_date <= windowEnd && s.status !== "planned");
  const existingMinutesByDate: Record<string, number> = {};
  for (const s of kept) existingMinutesByDate[s.session_date] = (existingMinutesByDate[s.session_date] ?? 0) + s.duration_minutes;
  const vctx = {
    knownTopicIds: new Set(ctx.topics.map((t) => t.id)),
    dailyLimitMinutes: dailyLimit, windowStart: body.startDate, windowEnd, existingMinutesByDate,
  };

  let sessions: PlannedSession[];
  if (body.mode === "rules") {
    sessions = rulesPlan({ ranked, startDate: body.startDate, days: body.days, dailyLimitMinutes: dailyLimit, sessionMinutes: ctx.profile.session_minutes });
    const errs = validateSchedule(sessions, vctx);
    if (errs.length) throw new ApiError(422, "The rules-based planner could not fit a valid schedule.", "RULES_INVALID", errs);
  } else {
    rateLimit(user.id);
    const topicLines = ranked.map((r) => {
      const t = ctx.topics.find((x) => x.id === r.topicId)!;
      return JSON.stringify({ topicId: r.topicId, title: t.title, priorityScore: r.score, examDate: r.examDate, difficulty: t.difficulty, mastery: t.mastery });
    });
    const system =
      `You are a study planner. Reply with ONLY a JSON object: {"sessions":[{"topicId","title","date","startTime","durationMinutes","priority","reason"}]}. ` +
      `date is YYYY-MM-DD between ${body.startDate} and ${windowEnd}. startTime is 24h HH:mm. priority is high|medium|low. ` +
      `Use only the given topicIds. Each day's total durationMinutes must not exceed ${dailyLimit}. Sessions on the same day must not overlap. ` +
      `Prefer ${ctx.profile.session_minutes}-minute sessions. Do not schedule a topic after its examDate. reason is one short sentence. ${DATA_GUARD}`;
    let parsed: PlannedSession[];
    try {
      const text = await aiComplete({
        system, json: true, maxTokens: 3000,
        messages: [{ role: "user", content: `<data>\n${topicLines.join("\n")}\n</data>` }],
      });
      parsed = aiPlanSchema.parse(extractJson(text)).sessions;
    } catch (e) {
      if (e instanceof AiUnavailableError) throw new ApiError(503, `AI planner unavailable: ${e.message}. You can use the rules-based planner instead.`, "AI_UNAVAILABLE");
      log.error("ai_plan_unparseable");
      throw new ApiError(502, "The AI returned a plan in an unusable format. Try again or use the rules-based planner.", "AI_INVALID");
    }
    const errs = validateSchedule(parsed, vctx);
    if (errs.length) throw new ApiError(502, "The AI plan failed validation and was not saved.", "AI_INVALID", errs.slice(0, 6));
    sessions = parsed;
  }

  const source = body.mode === "ai" ? "ai" : "rules";
  const del = await supabase.from("study_sessions").delete().eq("user_id", user.id).eq("status", "planned")
    .gte("session_date", body.startDate).lte("session_date", windowEnd);
  if (del.error) throw new ApiError(500, "Could not replace the existing plan.", "DB_ERROR");
  const ins = await supabase.from("study_sessions").insert(
    sessions.map((s) => ({
      user_id: user.id, topic_id: s.topicId, session_date: s.date, start_time: s.startTime,
      duration_minutes: s.durationMinutes, priority: s.priority, reason: s.reason, source, status: "planned",
    })),
  );
  if (ins.error) throw new ApiError(409, "Could not save the plan (a session may clash with an existing one).", "DB_ERROR");
  log.info("plan_saved", { source, count: sessions.length });
  return NextResponse.json({ source, count: sessions.length });
});
