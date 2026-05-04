"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Position relative to the document direction. `end` = right in LTR, left in RTL. */
  side?: "end" | "start";
  widthClassName?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function Drawer({
  open,
  onClose,
  title,
  side = "end",
  widthClassName = "w-full sm:max-w-md",
  children,
  footer,
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Latch the latest onClose handler in a ref so the keydown effect's
  // dependency array doesn't include the parent's per-render arrow
  // function. Otherwise every keystroke in any nested input would yank
  // focus back to the panel shell — same footgun we hit in Modal.tsx.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
  }, [open]);

  return (
    <div
      aria-hidden={!open}
      className={cn(
        "fixed inset-0 z-[60] transition-opacity duration-300",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      )}
    >
      <button
        type="button"
        aria-label="Close overlay"
        onClick={onClose}
        className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "absolute top-0 bottom-0 flex flex-col bg-surface shadow-elevated outline-none",
          "transition-transform duration-300 ease-premium",
          widthClassName,
          side === "end" ? "end-0" : "start-0",
          open
            ? "translate-x-0"
            : side === "end"
            ? "rtl:-translate-x-full ltr:translate-x-full"
            : "rtl:translate-x-full ltr:-translate-x-full"
        )}
      >
        {title ? (
          <header className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-base font-semibold tracking-tight">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-brand-soft hover:text-ink"
            >
              <X className="size-4" />
            </button>
          </header>
        ) : null}

        <div className="flex-1 overflow-y-auto">{children}</div>

        {footer ? (
          <footer className="border-t border-line bg-surface px-5 py-4">{footer}</footer>
        ) : null}
      </div>
    </div>
  );
}
