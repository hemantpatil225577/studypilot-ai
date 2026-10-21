"use client";
import * as React from "react";
import { clsx } from "clsx";

export const cn = (...a: unknown[]) => clsx(a);

export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }>(
  ({ className, variant = "primary", ...p }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-violet-600 text-white hover:bg-violet-500",
        variant === "ghost" && "border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10",
        variant === "danger" && "bg-red-600/80 text-white hover:bg-red-600",
        className,
      )}
      {...p}
    />
  ),
);
Button.displayName = "Button";

const field = "w-full rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400";
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn(field, className)} {...p} />
));
Input.displayName = "Input";
export const Select = ({ className, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) => <select className={cn(field, className)} {...p} />;
export const Textarea = ({ className, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea className={cn(field, className)} {...p} />;

export const Label = ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
  <label htmlFor={htmlFor} className="mb-1 block text-sm text-slate-300">{children}</label>
);

export const Card = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("glass rounded-2xl p-5", className)} {...p} />;

export const Badge = ({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "violet" | "amber" | "green" | "red" }) => (
  <span className={cn("rounded-md px-2 py-0.5 text-xs", tone === "slate" && "bg-white/10 text-slate-200", tone === "violet" && "bg-violet-500/20 text-violet-200", tone === "amber" && "bg-amber-500/20 text-amber-200", tone === "green" && "bg-emerald-500/20 text-emerald-200", tone === "red" && "bg-red-500/20 text-red-200")}>
    {children}
  </span>
);

export const Skeleton = ({ className }: { className?: string }) => <div className={cn("animate-pulse rounded-lg bg-white/10", className)} />;

export function EmptyState({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <Card className="text-center">
      <h3 className="font-display text-lg text-white">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-400">{body}</p>
      {children && <div className="mt-4 flex justify-center">{children}</div>}
    </Card>
  );
}

/** Two-step confirmation for destructive actions. */
export function ConfirmButton({ label, confirmLabel = "Yes, delete", onConfirm, disabled }: { label: string; confirmLabel?: string; onConfirm: () => void; disabled?: boolean }) {
  const [ask, setAsk] = React.useState(false);
  if (!ask) return <Button variant="ghost" disabled={disabled} onClick={() => setAsk(true)} type="button">{label}</Button>;
  return (
    <span role="alertdialog" aria-label="Confirm" className="inline-flex items-center gap-2">
      <Button variant="danger" type="button" onClick={() => { setAsk(false); onConfirm(); }}>{confirmLabel}</Button>
      <Button variant="ghost" type="button" onClick={() => setAsk(false)}>Cancel</Button>
    </span>
  );
}
