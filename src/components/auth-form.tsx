
"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { signIn, signUp } from "@/app/auth-actions";
import { Button, Card, Input, Label } from "@/components/ui";

export function AuthForm({
  mode,
  notice,
}: {
  mode: "login" | "register";
  notice?: string;
}) {
  const [error, setError] = useState<string | null>(notice ?? null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") ?? "");
    const password = String(f.get("password") ?? "");

    setError(null);
    setInfo(null);

    start(async () => {
      const r =
        mode === "login"
          ? await signIn({ email, password })
          : await signUp({
              name: String(f.get("name") ?? ""),
              email,
              password,
            });

      if (r?.error) setError(r.error);
      if (r?.info) setInfo(r.info);
    });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <Link
        href="/"
        className="mb-6 font-display text-xl font-semibold text-white"
      >
        StudyPilot AI
      </Link>

      <Card>
        <h1 className="font-display text-2xl text-white">
          {mode === "login" ? "Sign in" : "Create your account"}
        </h1>

        <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
          {mode === "register" && (
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                autoComplete="name"
                required
              />
            </div>
          )}

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              minLength={8}
              required
            />
          </div>

          {mode === "login" && (
            <div className="text-right">
              <Link
                href="/forgot-password"
                className="text-sm text-violet-300 underline"
              >
                Forgot Password?
              </Link>
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-300">
              {error}
            </p>
          )}

          {info && (
            <p role="status" className="text-sm text-emerald-300">
              {info}
            </p>
          )}

          <Button type="submit" disabled={pending} className="w-full">
            {pending
              ? "Please wait…"
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </Button>
        </form>

        <p className="mt-4 text-sm text-slate-400">
          {mode === "login" ? (
            <>
              New here?{" "}
              <Link
                className="text-violet-300 underline"
                href="/register"
              >
                Create an account
              </Link>
            </>
          ) : (
            <>
              Already registered?{" "}
              <Link className="text-violet-300 underline" href="/login">
                Sign in
              </Link>
            </>
          )}
        </p>
      </Card>
    </main>
  );
}
