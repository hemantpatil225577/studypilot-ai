"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveProfile } from "@/app/actions";
import { Button, Card, Input, Label } from "@/components/ui";
import type { Profile } from "@/lib/types";

export function SettingsForm({ profile, email }: { profile: Profile; email: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <Card>
      <form className="space-y-4" noValidate onSubmit={(e) => {
        e.preventDefault(); const f = new FormData(e.currentTarget); setError(null);
        start(async () => {
          const r = await saveProfile({ name: f.get("name"), studyHoursPerDay: f.get("hours"), sessionMinutes: f.get("session"), tutorHistoryEnabled: f.get("history") === "on" });
          if (r.ok) toast.success("Settings saved"); else setError(r.error);
        });
      }}>
        <p className="text-sm text-slate-400">Signed in as {email}</p>
        <div><Label htmlFor="name">Name</Label><Input id="name" name="name" defaultValue={profile.name} required /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><Label htmlFor="hours">Study hours per day</Label><Input id="hours" name="hours" type="number" step="0.5" min="0.5" max="16" defaultValue={profile.study_hours_per_day} required /></div>
          <div><Label htmlFor="session">Session length (minutes)</Label><Input id="session" name="session" type="number" step="5" min="15" max="180" defaultValue={profile.session_minutes} required /></div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input type="checkbox" name="history" defaultChecked={profile.tutor_history_enabled} className="h-4 w-4 accent-violet-500" />
          Save my tutor conversations to my account
        </label>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save settings"}</Button>
      </form>
    </Card>
  );
}
