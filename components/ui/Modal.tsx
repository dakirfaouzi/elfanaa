"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
};

const SIZES = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
} as const;

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      aria-hidden={!open}
      className={cn(
        "fixed inset-0 z-[70] transition-opacity duration-200",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      )}
    >
      <button
        type="button"
        aria-label="Close overlay"
        onClick={onClose}
        className="absolute inset-0 bg-ink/55 backdrop-blur-sm"
      />
      <div className="absolute inset-0 flex items-end justify-center p-0 sm:items-center sm:p-6">
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          tabIndex={-1}
          className={cn(
            "relative w-full bg-surface shadow-elevated outline-none",
            "rounded-t-xl sm:rounded-lg",
            "max-h-[92dvh] flex flex-col",
            SIZES[size],
            open ? "animate-scale-in" : ""
          )}
        >
          {title ? (
            <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
                {description ? (
                  <p className="mt-1 text-sm text-muted">{description}</p>
                ) : null}
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-brand-soft hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </header>
          ) : null}

          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

          {footer ? (
            <footer className="border-t border-line bg-surface px-6 py-4">{footer}</footer>
          ) : null}
        </div>
      </div>
    </div>
  );
}
