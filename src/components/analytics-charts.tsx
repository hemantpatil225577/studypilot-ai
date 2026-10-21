"use client";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui";

type Props = { mastery: { name: string; mastery: number }[]; minutesByDay: { date: string; minutes: number }[]; attempts: { n: number; percent: number }[] };

function Box({ title, empty, children }: { title: string; empty: string | null; children: React.ReactNode }) {
  return (
    <Card>
      <h2 className="font-display text-lg text-white">{title}</h2>
      <div className="mt-3 h-56">{empty ? <p className="text-sm text-slate-400">{empty}</p> : children}</div>
    </Card>
  );
}
const axis = { stroke: "#94a3b8", fontSize: 12 };
const tip = { contentStyle: { background: "#111836", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8 } };

export function AnalyticsCharts({ mastery, minutesByDay, attempts }: Props) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Box title="Topic mastery" empty={mastery.length === 0 ? "No topics." : null}>
        <ResponsiveContainer><BarChart data={mastery}><CartesianGrid stroke="rgba(255,255,255,.08)" /><XAxis dataKey="name" {...axis} /><YAxis domain={[0, 100]} {...axis} /><Tooltip {...tip} /><Bar dataKey="mastery" fill="#8b5cf6" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
      </Box>
      <Box title="Minutes studied per day" empty={minutesByDay.length === 0 ? "Complete a study session to see this chart." : null}>
        <ResponsiveContainer><BarChart data={minutesByDay}><CartesianGrid stroke="rgba(255,255,255,.08)" /><XAxis dataKey="date" {...axis} /><YAxis {...axis} /><Tooltip {...tip} /><Bar dataKey="minutes" fill="#6366f1" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
      </Box>
      <Box title="Quiz score per attempt (%)" empty={attempts.length === 0 ? "Take a quiz to see this chart." : null}>
        <ResponsiveContainer><LineChart data={attempts}><CartesianGrid stroke="rgba(255,255,255,.08)" /><XAxis dataKey="n" {...axis} /><YAxis domain={[0, 100]} {...axis} /><Tooltip {...tip} /><Line dataKey="percent" stroke="#a78bfa" strokeWidth={2} dot /></LineChart></ResponsiveContainer>
      </Box>
    </div>
  );
}
