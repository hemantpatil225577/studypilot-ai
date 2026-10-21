export type KeyedQuestion = { id: string; correctIndex: number; explanation: string };

export type GradeResult = {
  score: number;
  total: number;
  percent: number;
  results: { questionId: string; selected: number | null; correctIndex: number; correct: boolean; explanation: string }[];
};

export function gradeAnswers(questions: KeyedQuestion[], answers: (number | null)[]): GradeResult {
  if (answers.length !== questions.length) throw new Error("Answer count does not match question count");
  const results = questions.map((q, i) => {
    const sel = answers[i];
    const valid = typeof sel === "number" && Number.isInteger(sel) && sel >= 0 && sel <= 3;
    return {
      questionId: q.id,
      selected: valid ? sel : null,
      correctIndex: q.correctIndex,
      correct: valid && sel === q.correctIndex,
      explanation: q.explanation,
    };
  });
  const score = results.filter((r) => r.correct).length;
  return { score, total: questions.length, percent: Math.round((score / questions.length) * 100), results };
}
