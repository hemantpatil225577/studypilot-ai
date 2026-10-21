/** Pull a JSON object out of model output that may be wrapped in prose or code fences. */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json|```/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object found in model output");
  return JSON.parse(cleaned.slice(start, end + 1));
}
