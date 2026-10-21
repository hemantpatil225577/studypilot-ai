// Verifies data isolation against YOUR Supabase project using two real test accounts.
// Usage: TEST_EMAIL_A=... TEST_PASSWORD_A=... TEST_EMAIL_B=... TEST_PASSWORD_B=... npm run check:rls
// Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in the environment.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const need = ["TEST_EMAIL_A", "TEST_PASSWORD_A", "TEST_EMAIL_B", "TEST_PASSWORD_B"];
if (!url || !anon || need.some((k) => !process.env[k])) { console.error("Missing environment variables."); process.exit(2); }

async function login(email, password) {
  const c = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Login failed for ${email}`);
  return { c, id: data.user.id };
}

let failed = 0;
const check = (name, ok) => { console.log(`${ok ? "PASS" : "FAIL"} ${name}`); if (!ok) failed++; };

const A = await login(process.env.TEST_EMAIL_A, process.env.TEST_PASSWORD_A);
const B = await login(process.env.TEST_EMAIL_B, process.env.TEST_PASSWORD_B);

const sub = await A.c.from("subjects").insert({ user_id: A.id, name: "RLS probe" }).select("id").single();
check("A can create a subject", !sub.error);

const read = await B.c.from("subjects").select("id").eq("id", sub.data.id);
check("B cannot read A's subject", (read.data ?? []).length === 0);

const upd = await B.c.from("subjects").update({ name: "hacked" }).eq("id", sub.data.id).select("id");
check("B cannot update A's subject", (upd.data ?? []).length === 0);

const forged = await B.c.from("subjects").insert({ user_id: A.id, name: "forged" });
check("B cannot insert rows as A", !!forged.error);

const topicOnForeign = await B.c.from("topics").insert({ user_id: B.id, subject_id: sub.data.id, title: "x" });
check("B cannot attach a topic to A's subject", !!topicOnForeign.error);

const attempt = await A.c.from("quiz_attempts").insert({ user_id: A.id, quiz_id: crypto.randomUUID(), score: 9, total: 9, answers: [] });
check("Users cannot insert quiz attempts directly", !!attempt.error);

const key = await A.c.from("quiz_questions").select("correct_index").limit(1);
check("Users cannot read quiz answer keys", !!key.error);

await A.c.from("subjects").delete().eq("id", sub.data.id);
console.log(failed ? `${failed} check(s) failed` : "All checks passed");
process.exit(failed ? 1 : 0);
