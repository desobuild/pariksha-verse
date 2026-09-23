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

  return (
    <div
      className={cn(
        "mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-20 md:pb-8",
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
