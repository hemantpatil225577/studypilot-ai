// Structured logs. Never pass tokens, keys, emails, prompts or model output here.
export const log = {
  info: (event: string, data: Record<string, string | number | boolean> = {}) =>
    console.log(JSON.stringify({ level: "info", event, ...data, t: new Date().toISOString() })),
  error: (event: string, data: Record<string, string | number | boolean> = {}) =>
    console.error(JSON.stringify({ level: "error", event, ...data, t: new Date().toISOString() })),
};
