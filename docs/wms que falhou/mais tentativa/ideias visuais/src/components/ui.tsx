import { clsx } from "clsx";
import { X } from "lucide-react";

export function Button({
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const variants = {
    primary: "bg-brand text-white hover:bg-brand-strong",
    secondary: "bg-slate-900 text-white hover:bg-slate-700",
    ghost: "bg-white/70 text-slate-700 ring-1 ring-slate-200 hover:bg-white",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };
  return <button className={clsx("inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50", variants[variant], className)} {...props} />;
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-[var(--shadow-soft)]", className)} {...props} />;
}

export function Badge({
  tone = "slate",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: "slate" | "green" | "yellow" | "red" | "blue" | "purple" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-emerald-100 text-emerald-700",
    yellow: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
    blue: "bg-sky-100 text-sky-700",
    purple: "bg-violet-100 text-violet-700",
  };
  return <span className={clsx("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", tones[tone], className)} {...props} />;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-brand/20" {...props} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" {...props} />;
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-3 text-left" title={label}>
      <span className={clsx("flex h-7 w-12 items-center rounded-full p-1 transition", checked ? "bg-brand" : "bg-slate-300")}>
        <span className={clsx("h-5 w-5 rounded-full bg-white transition", checked ? "translate-x-5" : "translate-x-0")} />
      </span>
      <span className="text-sm font-medium text-slate-700">{label}</span>
    </button>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {eyebrow ? <p className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-brand">{eyebrow}</p> : null}
        <h1 className="font-display text-3xl font-bold text-slate-900">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="flex min-h-60 flex-col items-center justify-center gap-3 border-dashed text-center">
      <div className="rounded-full bg-brand/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.3em] text-brand">VisualWMS</div>
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="max-w-md text-sm text-slate-500">{description}</p>
      {action}
    </Card>
  );
}

export function Drawer({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35 p-2 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-xl flex-col rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <h3 className="font-display text-xl font-bold">{title}</h3>
          <button className="rounded-full p-2 hover:bg-slate-100" onClick={onClose} title="Fechar painel">
            <X size={18} />
          </button>
        </div>
        <div className="scrollbar-thin flex-1 overflow-auto p-6">{children}</div>
      </div>
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-display text-xl font-bold text-slate-900">{title}</h3>
          <button className="rounded-full p-2 hover:bg-slate-100" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
