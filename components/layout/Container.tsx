import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/cn";

type ContainerProps = {
  as?: ElementType;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  className?: string;
  children: ReactNode;
};

const SIZE_MAP = {
  sm: "max-w-3xl",
  md: "max-w-5xl",
  lg: "max-w-6xl",
  xl: "max-w-[1440px]",
  full: "max-w-none",
} as const;

export function Container({
  as: Tag = "div",
  size = "xl",
  className,
  children,
}: ContainerProps) {
  return (
    <Tag className={cn("mx-auto w-full px-4 sm:px-6 lg:px-8", SIZE_MAP[size], className)}>
      {children}
    </Tag>
  );
}
