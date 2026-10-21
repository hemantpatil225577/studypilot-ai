
"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;

      setMessage("Password updated successfully. You can now log in.");
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to update password. Open the reset link from your email again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-xl border p-6 shadow-sm">
        <h1 className="mb-2 text-2xl font-bold">Reset Password</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Enter your new password below.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium">
              New password
            </label>
            <input
              id="password"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border bg-transparent px-3 py-2"
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium">
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-md border bg-transparent px-3 py-2"
              placeholder="Enter password again"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50"
          >
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>

        {message && (
          <p role="status" className="mt-4 break-words text-sm">
            {message}
          </p>
        )}

        <a href="/login" className="mt-5 block text-center text-sm underline">
          Back to Login
        </a>
      </div>
    </main>
  );
}
