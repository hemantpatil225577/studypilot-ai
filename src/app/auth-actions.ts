"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const creds = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

export type AuthResult = { error?: string; info?: string };

export async function signIn(input: { email: string; password: string }): Promise<AuthResult> {
  const p = creds.safeParse(input);
  if (!p.success) return { error: p.error.issues[0].message };
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword(p.data);
  if (error) return { error: "Incorrect email or password." };
  redirect("/dashboard");
}

export async function signUp(input: { name: string; email: string; password: string }): Promise<AuthResult> {
  const name = z.string().trim().min(1, "Name is required").max(80).safeParse(input.name);
  if (!name.success) return { error: name.error.issues[0].message };
  const p = creds.safeParse(input);
  if (!p.success) return { error: p.error.issues[0].message };
  const supabase = createClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { data, error } = await supabase.auth.signUp({
    ...p.data,
    options: { data: { name: name.data }, emailRedirectTo: `${site}/auth/callback` },
  });
  if (error) return { error: error.message.includes("registered") ? "An account with this email already exists." : "Could not create the account. Try again." };
  if (!data.session) return { info: "Check your email to confirm your account, then sign in." };
  redirect("/onboarding");
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
