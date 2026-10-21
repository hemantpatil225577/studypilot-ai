import { NextResponse } from "next/server";
import { ApiError, rateLimit, readJson, requireUser, route } from "@/lib/api";
import { tutorRequestSchema } from "@/lib/schemas";
import { AiUnavailableError, DATA_GUARD, aiComplete } from "@/lib/ai/provider";

const MODES = {
  simple: "Explain simply, as to a first-year student, with one everyday analogy. Keep it short.",
  steps: "Teach with a worked, step-by-step example. Number the steps and show the reasoning at each step.",
  exam: "Write a model exam-style answer with a clear structure and the key terms a marker looks for. Then note common mistakes.",
  viva: "Run viva practice: ask ONE oral exam question at a time, wait for the student's answer, then give brief feedback and ask a follow-up.",
};

export const GET = route(async () => {
  const { supabase, user } = await requireUser();
  const prof = await supabase.from("profiles").select("tutor_history_enabled").eq("id", user.id).single();
  if (!prof.data?.tutor_history_enabled) return NextResponse.json({ enabled: false, messages: [] });
  const { data } = await supabase.from("tutor_messages").select("role,content,mode").eq("user_id", user.id).order("created_at", { ascending: false }).limit(40);
  return NextResponse.json({ enabled: true, messages: (data ?? []).reverse() });
});

export const DELETE = route(async () => {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("tutor_messages").delete().eq("user_id", user.id);
  if (error) throw new ApiError(500, "Could not clear history.", "DB_ERROR");
  return NextResponse.json({ ok: true });
});

export const POST = route(async (req) => {
  const { supabase, user } = await requireUser();
  const body = tutorRequestSchema.parse(await readJson(req, 60_000));
  rateLimit(user.id);

  let topicLine = "";
  if (body.topicId) {
    const { data } = await supabase.from("topics").select("title").eq("id", body.topicId).eq("user_id", user.id).maybeSingle();
    if (!data) throw new ApiError(404, "Topic not found.", "NOT_FOUND");
    topicLine = `The student is studying the topic: <data>${data.title}</data>.`;
  }
  const system = `You are StudyPilot's tutor for university students. ${MODES[body.mode]} Be accurate; say when you are unsure. Finish with one follow-up question to check understanding. ${topicLine} ${DATA_GUARD}`;
  let reply: string;
  try {
    reply = await aiComplete({
      system, maxTokens: 1200,
      messages: [...body.history.slice(-10), { role: "user", content: body.message }],
    });
  } catch (e) {
    if (e instanceof AiUnavailableError) throw new ApiError(503, `The tutor is unavailable right now: ${e.message}.`, "AI_UNAVAILABLE");
    throw e;
  }

  const prof = await supabase.from("profiles").select("tutor_history_enabled").eq("id", user.id).single();
  if (prof.data?.tutor_history_enabled) {
    await supabase.from("tutor_messages").insert([
      { user_id: user.id, role: "user", content: body.message, mode: body.mode },
      { user_id: user.id, role: "assistant", content: reply.slice(0, 8000), mode: body.mode },
    ]);
  }
  return NextResponse.json({ reply });
});
