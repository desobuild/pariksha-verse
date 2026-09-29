import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "default" | "narrow" | "wide" | "full";
}

export function PageContainer({
  children,
  className,
  size = "default",
  ...props
}: PageContainerProps) {
  const sizeClasses = {
    narrow: "max-w-2xl",
    default: "max-w-4xl",
    wide: "max-w-6xl",
    full: "max-w-full",
  };

  /*
   * The mobile bottom inset is appended after `className` so tailwind-merge
   * can never strip it: when callers pass py-* (e.g. "py-6 sm:py-8"),
   * twMerge removes any pb-* declared *before* it, which used to drop the
   * reserved space above the fixed mobile bottom nav. The app shell also
   * reserves the nav height itself (MobileBottomNav spacer), so this padding
   * only provides breathing room above that inset.
   */
  const bottomInsetClasses = "pb-6 md:pb-8";

  return (
    <div
      className={cn(
        "mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6",
        sizeClasses[size],
        className,
        bottomInsetClasses
      )}
      {...props}
    >
      {children}
    </div>
  );
}
