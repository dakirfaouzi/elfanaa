import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type BadgeProps = {
  tone?: "neutral" | "accent" | "success" | "danger" | "ink";
  className?: string;
  children: ReactNode;
};

const TONES = {
  neutral: "bg-brand-soft text-ink",
  accent: "bg-accent/15 text-accent",
  success: "bg-success/10 text-success",
  danger: "bg-danger/10 text-danger",
  ink: "bg-ink text-bg",
} satisfies Record<string, string>;

export function Badge({ tone = "neutral", className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider",
        TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
