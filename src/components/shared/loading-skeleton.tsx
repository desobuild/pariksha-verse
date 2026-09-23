import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";

export interface LoadingSkeletonProps {
  count?: number;
  className?: string;
}

export function LoadingSkeleton({ count = 3, className }: LoadingSkeletonProps) {
  return (
    <div className={cn("space-y-3", className)} aria-label="Loading content...">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="flex items-center space-x-4 rounded-2xl border border-border bg-surface p-4"
        >
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
