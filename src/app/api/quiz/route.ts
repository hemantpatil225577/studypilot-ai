import { NextResponse } from "next/server";
import { ApiError, rateLimit, readJson, requireUser, route } from "@/lib/api";
import { aiQuizSchema, quizRequestSchema } from "@/lib/schemas";
import { AiUnavailableError, DATA_GUARD, aiComplete } from "@/lib/ai/provider";
import { createAdminClient } from "@/lib/supabase/server";
import { extractJson } from "@/lib/json";
import { SAMPLE_QUESTIONS } from "@/lib/sample-quiz";
import { log } from "@/lib/logger";

type Q = { question: string; options: string[]; correctIndex: number; explanation: string };

export const POST = route(async (req) => {
  const { supabase, user } = await requireUser();
  const body = quizRequestSchema.parse(await readJson(req));

  // Ownership check on the topic (RLS + explicit user_id filter).
  const { data: topic } = await supabase.from("topics").select("id,title,difficulty").eq("id", body.topicId).eq("user_id", user.id).maybeSingle();
  if (!topic) throw new ApiError(404, "Topic not found.", "NOT_FOUND");

  let questions: Q[];
  let source: "ai" | "sample";
  if (body.sample) {
    questions = SAMPLE_QUESTIONS.slice(0, body.count);
    source = "sample";
  } else {
    rateLimit(user.id);
    const system =
      `You write multiple-choice quizzes. Reply with ONLY JSON: {"questions":[{"question","options":[4 strings],"correctIndex":0-3,"explanation"}]}. ` +
      `Write exactly ${body.count} questions at difficulty ${topic.difficulty}/5 about the topic. Exactly one option is correct. Vary the position of the correct answer. ${DATA_GUARD}`;
    try {
      const text = await aiComplete({ system, json: true, maxTokens: 3000, messages: [{ role: "user", content: `Topic: <data>${topic.title}</data>` }] });
      questions = aiQuizSchema.parse(extractJson(text)).questions;
      source = "ai";
    } catch (e) {
      if (e instanceof AiUnavailableError) throw new ApiError(503, `Quiz generation unavailable: ${e.message}. You can try a clearly labelled sample quiz instead.`, "AI_UNAVAILABLE");
      log.error("ai_quiz_invalid");
      throw new ApiError(502, "The AI returned an invalid quiz. Please try again.", "AI_INVALID");
    }
  }

  // Writes go through the service role because users have no write access to quiz tables.
  const admin = createAdminClient();
  const quiz = await admin.from("quizzes").insert({ user_id: user.id, topic_id: topic.id, source }).select("id").single();
  if (quiz.error || !quiz.data) throw new ApiError(500, "Could not save the quiz.", "DB_ERROR");
  const ins = await admin.from("quiz_questions").insert(
    questions.map((q, i) => ({ quiz_id: quiz.data.id, user_id: user.id, position: i, question: q.question, options: q.options, correct_index: q.correctIndex, explanation: q.explanation })),
  );
  if (ins.error) throw new ApiError(500, "Could not save the quiz questions.", "DB_ERROR");

  const { data } = await supabase.from("quiz_questions").select("id,position,question,options").eq("quiz_id", quiz.data.id).order("position");
  return NextResponse.json({ quizId: quiz.data.id, source, title: topic.title, questions: data ?? [] });
});
