import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
  iconStart?: ReactNode;
  iconEnd?: ReactNode;
};

const BASE =
  "relative inline-flex items-center justify-center gap-2 font-medium tracking-tight " +
  "transition-all duration-200 ease-premium select-none whitespace-nowrap " +
  "disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none " +
  "focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-bg active:scale-[0.98]";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-ink text-bg hover:bg-ink/90",
  secondary: "bg-brand-soft text-ink hover:bg-line",
  ghost: "bg-transparent text-ink hover:bg-brand-soft",
  outline: "bg-transparent text-ink border border-line hover:border-ink hover:bg-brand-soft",
  danger: "bg-danger text-white hover:bg-danger/90",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-sm rounded-sm",
  md: "h-11 px-5 text-sm rounded-md",
  lg: "h-[52px] px-6 text-base rounded-md",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    fullWidth,
    loading,
    iconStart,
    iconEnd,
    className,
    children,
    disabled,
    type = "button",
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        BASE,
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className
      )}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center"
        >
          <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
        </span>
      ) : null}
      <span className={cn("inline-flex items-center gap-2", loading && "opacity-0")}>
        {iconStart}
        {children}
        {iconEnd}
      </span>
    </button>
  );
});
