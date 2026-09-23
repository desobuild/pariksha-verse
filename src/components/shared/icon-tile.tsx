import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface IconTileProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "tint" | "strong" | "solid" | "outline";
  size?: "sm" | "md" | "lg";
}

const sizes: Record<NonNullable<IconTileProps["size"]>, string> = {
  sm: "h-9 w-9 rounded-xl",
  md: "h-11 w-11 rounded-xl",
  lg: "h-14 w-14 rounded-2xl",
};

const variants: Record<NonNullable<IconTileProps["variant"]>, string> = {
  tint: "bg-surface-tint text-primary",
  strong: "bg-surface-tint-strong text-primary",
  solid: "bg-primary text-primary-foreground",
  outline: "border border-border bg-surface text-primary",
};

/**
 * Repeating Stitch pattern: a rounded tinted square framing a status or
 * subject icon. Decorative framing only — icons stay in the component tree.
 */
export function IconTile({
  variant = "tint",
  size = "md",
  className,
  children,
  ...props
}: IconTileProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center",
        sizes[size],
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
