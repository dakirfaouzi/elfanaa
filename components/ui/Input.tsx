import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type FieldWrapperProps = {
  label?: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
  id?: string;
};

export function Field({ label, error, hint, className, children, id }: FieldWrapperProps) {
  return (
    <label htmlFor={id} className={cn("block", className)}>
      {label ? (
        <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      ) : null}
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

const INPUT_BASE =
  "w-full rounded-md border border-line bg-surface px-3.5 text-[15px] text-ink " +
  "placeholder:text-muted/70 transition-colors duration-150 " +
  "focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/15 " +
  "disabled:opacity-50 disabled:bg-brand-soft";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...rest },
  ref
) {
  return (
    <input
      ref={ref}
      className={cn(INPUT_BASE, "h-11", invalid && "border-danger focus:ring-danger/20", className)}
      {...rest}
    />
  );
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, rows = 3, ...rest },
  ref
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(INPUT_BASE, "py-3 leading-relaxed", invalid && "border-danger", className)}
      {...rest}
    />
  );
});
