"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { profileSchema, subjectSchema, topicSchema } from "@/lib/schemas";
import { DATE_RE, TIME_RE } from "@/lib/dates";
import { masteryAfterSession } from "@/lib/revision";
import { validateSchedule } from "@/lib/planner";
import { log } from "@/lib/logger";

export type Result = { ok: true } | { ok: false; error: string };

async function ctx() {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("AUTH");
  return { supabase, user: data.user };
}

function fail(e: unknown): Result {
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Invalid input" };
  if (e instanceof Error && e.message === "AUTH") return { ok: false, error: "Your session has expired. Please sign in again." };
  if (e instanceof Error && e.message.startsWith("USER:")) return { ok: false, error: e.message.slice(5) };
  log.error("action_failed");
  return { ok: false, error: "Something went wrong. Please try again." };
}
const done = (paths: string[]): Result => {
  paths.forEach((p) => revalidatePath(p));
  return { ok: true };
};
const uuid = z.string().uuid();

export async function saveProfile(input: unknown): Promise<Result> {
  try {
    const { supabase, user } = await ctx();
    const p = profileSchema.parse(input);
    const { error } = await supabase.from("profiles").update({
      name: p.name, study_hours_per_day: p.studyHoursPerDay, session_minutes: p.sessionMinutes,
      ...(p.tutorHistoryEnabled === undefined ? {} : { tutor_history_enabled: p.tutorHistoryEnabled }),
    }).eq("id", user.id);
    if (error) throw error;
    return done(["/settings", "/dashboard"]);
  } catch (e) { return fail(e); }
}

export async function completeOnboarding(input: unknown): Promise<Result> {
  try {
    const { supabase, user } = await ctx();
    const schema = z.object({
      profile: profileSchema,
      subject: subjectSchema,
      topics: z.array(z.string().trim().min(1).max(120)).max(30),
      difficulty: z.coerce.number().int().min(1).max(5),
    });
    const d = schema.parse(input);
    const sub = await supabase.from("subjects").insert({ user_id: user.id, name: d.subject.name, exam_date: d.subject.examDate ?? null, daily_hours: d.subject.dailyHours ?? null }).select("id").single();
    if (sub.error) throw sub.error;
    if (d.topics.length) {
      const t = await supabase.from("topics").insert(d.topics.map((title) => ({ user_id: user.id, subject_id: sub.data.id, title, difficulty: d.difficulty })));
      if (t.error) throw t.error;
    }
    const p = await supabase.from("profiles").update({
      name: d.profile.name, study_hours_per_day: d.profile.studyHoursPerDay, session_minutes: d.profile.sessionMinutes, onboarded: true,
    }).eq("id", user.id);
    if (p.error) throw p.error;
    return done(["/dashboard", "/subjects"]);
  } catch (e) { return fail(e); }
}

export async function createSubject(input: unknown): Promise<Result> {
  try {
    const { supabase, user } = await ctx();
    const s = subjectSchema.parse(input);
    const { error } = await supabase.from("subjects").insert({ user_id: user.id, name: s.name, exam_date: s.examDate ?? null, daily_hours: s.dailyHours ?? null });
    if (error) throw error;
    return done(["/subjects", "/dashboard"]);
  } catch (e) { return fail(e); }
}

export async function updateSubject(id: string, input: unknown): Promise<Result> {
  try {
    const { supabase, user } = await ctx();
    const s = subjectSchema.parse(input);
    const { data, error } = await supabase.from("subjects").update({ name: s.name, exam_date: s.examDate ?? null, daily_hours: s.dailyHours ?? null }).eq("id", uuid.parse(id)).eq("user_id", user.id).select("id");
    if (error) throw error;
    if (!data?.length) throw new Error("USER:Subject not found.");
    return done(["/subjects", "/dashboard"]);
  } catch (e) { return fail(e); }
}

export async function deleteSubject(id: string): Promise<Result> {
  try {
    const { supabase, user } = await ctx();
    const { error } = await supabase.from("subjects").delete().eq("id", uuid.parse(id)).eq("user_id", user.id);
    if (error) throw error;
    return done(["/subjects", "/dashboard", "/calendar", "/analytics"]);
  } catch (e) { return fail(e); }
}

export async function createTopic(subjectId: string, input: unknown): Promise<Result> {
  try {
    const { supabase, user } = await ctx();
    const t = topicSchema.parse(input);
    const sid = uuid.parse(subjectId);
    const sub = await supabase.from("subjects").select("id").eq("id", sid).eq("user_id", user.id).maybeSingle();
    if (!sub.data) throw new Error("USER:Subject not found.");
    const { error } = await supabase.from("topics").insert({ user_id: user.id, subject_id: sid, title: t.title, difficulty: t.difficulty, mastery: t.mastery });
    if (error) throw error;
    return done(["/subjects", "/dashboard"]);
  } catch (e) { return fail(e); }
}

export async function updateTopic(id: string, input: unknown): Promise<Result> {
  try {
    const { supabase, user } = await ctx();
    const t = topicSchema.extend({ completed: z.boolean().optional() }).parse(input);
    const { data, error } = await supabase.from("topics").update({
      title: t.title, difficulty: t.difficulty, mastery: t.mastery, ...(t.completed === undefined ? {} : { completed: t.completed }),
    }).eq("id", uuid.parse(id)).eq("user_id", user.id).select("id");
    if (error) throw error;
    if (!data?.length) throw new Error("USER:Topic not found.");
    return done(["/subjects", "/dashboard", "/analytics"]);
  } catch (e) { return fail(e); }
}

export async function deleteTopic(id: string): Promise<Result> {
  try {
    const { supabase, user } = await ctx();
    const { error } = await supabase.from("topics").delete().eq("id", uuid.parse(id)).eq("user_id", user.id);
    if (error) throw error;
    return done(["/subjects", "/dashboard", "/calendar", "/analytics"]);
  } catch (e) { return fail(e); }
}

export async function setSessionStatus(id: string, status: "planned" | "completed" | "skipped"): Promise<Result> {
  try {
    const { supabase, user } = await ctx();
    const sid = uuid.parse(id);
    const st = z.enum(["planned", "completed", "skipped"]).parse(status);
    const { data: ses } = await supabase.from("study_sessions").select("status,topic_id").eq("id", sid).eq("user_id", user.id).maybeSingle();
    if (!ses) throw new Error("USER:Session not found.");
    const { error } = await supabase.from("study_sessions").update({ status: st }).eq("id", sid).eq("user_id", user.id);
    if (error) throw error;
    if (st === "completed" && ses.status !== "completed") {
      const { data: t } = await supabase.from("topics").select("mastery").eq("id", ses.topic_id).eq("user_id", user.id).maybeSingle();
      if (t) await supabase.from("topics").update({ mastery: masteryAfterSession(t.mastery) }).eq("id", ses.topic_id).eq("user_id", user.id);
    }
    return done(["/calendar", "/dashboard", "/analytics", "/subjects"]);
  } catch (e) { return fail(e); }
}

export async function rescheduleSession(id: string, date: string, startTime: string): Promise<Result> {
  try {
    const { supabase, user } = await ctx();
    const sid = uuid.parse(id);
    z.string().regex(DATE_RE, "Use a valid date").parse(date);
    z.string().regex(TIME_RE, "Use a valid time").parse(startTime);
    const { data: ses } = await supabase.from("study_sessions").select("*").eq("id", sid).eq("user_id", user.id).maybeSingle();
    if (!ses) throw new Error("USER:Session not found.");
    const [prof, day] = await Promise.all([
      supabase.from("profiles").select("study_hours_per_day").eq("id", user.id).single(),
      supabase.from("study_sessions").select("id,topic_id,start_time,duration_minutes,priority").eq("user_id", user.id).eq("session_date", date).neq("id", sid).neq("status", "skipped"),
    ]);
    const others = (day.data ?? []).map((o) => ({ topicId: o.topic_id, date, startTime: String(o.start_time).slice(0, 5), durationMinutes: o.duration_minutes, priority: o.priority, reason: "" }));
    const errs = validateSchedule(
      [...others, { topicId: ses.topic_id, date, startTime, durationMinutes: ses.duration_minutes, priority: ses.priority, reason: "" }],
      { knownTopicIds: new Set([ses.topic_id, ...others.map((o) => o.topicId)]), dailyLimitMinutes: Math.round(Number(prof.data?.study_hours_per_day ?? 2) * 60), windowStart: date, windowEnd: date },
    );
    if (errs.length) throw new Error(`USER:${errs[0]}`);
    const { error } = await supabase.from("study_sessions").update({ session_date: date, start_time: startTime }).eq("id", sid).eq("user_id", user.id);
    if (error) throw new Error("USER:That slot is already taken for this topic.");
    return done(["/calendar", "/dashboard"]);
  } catch (e) { return fail(e); }
}

export async function deleteSession(id: string): Promise<Result> {
  try {
    const { supabase, user } = await ctx();
    const { error } = await supabase.from("study_sessions").delete().eq("id", uuid.parse(id)).eq("user_id", user.id);
    if (error) throw error;
    return done(["/calendar", "/dashboard"]);
  } catch (e) { return fail(e); }
}
