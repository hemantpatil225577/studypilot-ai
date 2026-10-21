import { z } from "zod";
import { DATE_RE, TIME_RE } from "@/lib/dates";

const date = z.string().regex(DATE_RE, "Use the format YYYY-MM-DD");

export const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  studyHoursPerDay: z.coerce.number().min(0.5, "At least 0.5 hours").max(16, "At most 16 hours"),
  sessionMinutes: z.coerce.number().int().min(15).max(180),
  tutorHistoryEnabled: z.boolean().optional(),
});

export const subjectSchema = z.object({
  name: z.string().trim().min(1, "Subject name is required").max(80),
  examDate: date.nullable().optional(),
  dailyHours: z.coerce.number().min(0.5).max(16).nullable().optional(),
});

export const topicSchema = z.object({
  title: z.string().trim().min(1, "Topic title is required").max(120),
  difficulty: z.coerce.number().int().min(1).max(5),
  mastery: z.coerce.number().int().min(0).max(100),
});

export const planRequestSchema = z.object({
  mode: z.enum(["ai", "rules"]),
  startDate: date,
  days: z.coerce.number().int().min(1).max(14),
});

export const aiPlanSchema = z.object({
  sessions: z
    .array(
      z.object({
        topicId: z.string().uuid(),
        title: z.string().max(200),
        date,
        startTime: z.string().regex(TIME_RE),
        durationMinutes: z.number().int().min(15).max(240),
        priority: z.enum(["high", "medium", "low"]),
        reason: z.string().min(1).max(300),
      }),
    )
    .min(1)
    .max(100),
});

export const tutorRequestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  mode: z.enum(["simple", "steps", "exam", "viva"]),
  topicId: z.string().uuid().optional(),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) })).max(12).default([]),
});

export const quizRequestSchema = z.object({
  topicId: z.string().uuid(),
  count: z.coerce.number().int().min(3).max(10).default(5),
  sample: z.boolean().optional(),
});

export const aiQuizSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string().min(5).max(500),
        options: z.array(z.string().min(1).max(300)).length(4),
        correctIndex: z.number().int().min(0).max(3),
        explanation: z.string().min(1).max(600),
      }),
    )
    .min(3)
    .max(10),
});

export const submitSchema = z.object({
  answers: z.array(z.number().int().min(0).max(3).nullable()).min(1).max(10),
});
