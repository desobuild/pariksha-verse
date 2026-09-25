import * as React from "react";
import { BookOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatAccuracy, type SubjectPracticePerformance } from "@/domain/practice";

export interface SubjectPerformanceProps {
  subjects: SubjectPracticePerformance[];
}

export function SubjectPerformance({ subjects }: SubjectPerformanceProps) {
  if (subjects.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="subjects-heading">
      <h2 id="subjects-heading" className="text-xs font-semibold uppercase tracking-wider text-foreground-subtle mb-3">
        Subject Performance
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {subjects.map((sub) => {
          const accuracyPct = sub.totalQuestions > 0 ? sub.accuracy / 100 : 0;
          return (
            <Card key={sub.subjectId} variant="base" className="p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4 text-primary" aria-hidden="true" />
                    {sub.subjectName}
                  </h3>
                  <span className="text-xs font-semibold text-foreground">
                    {sub.totalQuestions > 0 ? formatAccuracy(sub.accuracy) : "—"}
                  </span>
                </div>

                <div className="mt-3">
                  <Progress
                    value={accuracyPct}
                    className="h-2 bg-surface-tint"
                  />
                </div>
              </div>

              <div className="mt-3.5 flex items-center justify-between text-xs text-foreground-subtle border-t border-border-subtle pt-2.5">
                <span>{sub.totalQuestions.toLocaleString()} questions</span>
                <span>{sub.sessionCount} {sub.sessionCount === 1 ? "session" : "sessions"}</span>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
