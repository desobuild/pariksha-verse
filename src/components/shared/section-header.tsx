import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface SectionHeaderProps {
  title: string;
  /** Optional trailing control, usually a "See all" link or text button. */
  action?: React.ReactNode;
  /** Optional supporting one-liner rendered under the title. */
  description?: string;
  className?: string;
}

/**
 * Repeating Stitch pattern: section title on the left with an optional
 * quiet text action ("See all") aligned to the right on the same baseline.
 */
export function SectionHeader({ title, action, description, className }: SectionHeaderProps) {
  return (
    <div className={cn("mb-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="type-h4 text-foreground">{title}</h2>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {description && (
        <p className="mt-0.5 text-xs text-foreground-subtle">{description}</p>
      )}
    </div>
  );
}
