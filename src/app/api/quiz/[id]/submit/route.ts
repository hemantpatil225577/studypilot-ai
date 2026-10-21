import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, readJson, requireUser, route } from "@/lib/api";
import { submitSchema } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/server";
import { gradeAnswers } from "@/lib/grading";
import { updateMastery } from "@/lib/revision";

export const POST = route(async (req, { params }: { params: { id: string } }) => {
  const { supabase, user } = await requireUser();
  const id = z.string().uuid().parse(params.id);
  const { answers } = submitSchema.parse(await readJson(req));

  const { data: quiz } = await supabase.from("quizzes").select("id,topic_id").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!quiz) throw new ApiError(404, "Quiz not found.", "NOT_FOUND");

  const admin = createAdminClient();
  const { data: keyed, error } = await admin
    .from("quiz_questions").select("id,correct_index,explanation,position").eq("quiz_id", quiz.id).eq("user_id", user.id).order("position");
  if (error || !keyed?.length) throw new ApiError(500, "Could not load the quiz.", "DB_ERROR");
  if (answers.length !== keyed.length) throw new ApiError(400, "Answer every question (or leave it unanswered) before submitting.", "INVALID_INPUT");

  const g = gradeAnswers(keyed.map((k) => ({ id: k.id, correctIndex: k.correct_index, explanation: k.explanation })), answers);
  const att = await admin.from("quiz_attempts").insert({ user_id: user.id, quiz_id: quiz.id, score: g.score, total: g.total, answers });
  if (att.error) throw new ApiError(500, "Could not save your attempt.", "DB_ERROR");

  // Update mastery for the quiz's topic (server-computed, RLS-scoped).
  const { data: topic } = await supabase.from("topics").select("mastery").eq("id", quiz.topic_id).eq("user_id", user.id).maybeSingle();
  if (topic) await supabase.from("topics").update({ mastery: updateMastery(topic.mastery, g.percent) }).eq("id", quiz.topic_id).eq("user_id", user.id);

  return NextResponse.json(g);
});
