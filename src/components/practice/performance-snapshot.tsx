import * as React from "react";
import { CheckCircle2, HelpCircle, Layers, Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatAccuracy, type OverallPracticeSnapshot } from "@/domain/practice";

export interface PerformanceSnapshotProps {
  snapshot: OverallPracticeSnapshot;
}

export function PerformanceSnapshot({ snapshot }: PerformanceSnapshotProps) {
  const { totalQuestions, totalCorrect, accuracy, sessionCount } = snapshot;

  const metrics = [
    {
      label: "Questions Attempted",
      value: totalQuestions.toLocaleString(),
      subtext: `${totalCorrect.toLocaleString()} correct`,
      icon: HelpCircle,
    },
    {
      label: "Overall Accuracy",
      value: totalQuestions > 0 ? formatAccuracy(accuracy) : "—",
      subtext: totalQuestions > 0 ? `${totalCorrect} of ${totalQuestions}` : "No attempts yet",
      icon: Target,
    },
    {
      label: "Correct Answers",
      value: totalCorrect.toLocaleString(),
      subtext: `${(totalQuestions - totalCorrect).toLocaleString()} incorrect`,
      icon: CheckCircle2,
    },
    {
      label: "Practice Sessions",
      value: sessionCount.toLocaleString(),
      subtext: sessionCount === 1 ? "1 session logged" : `${sessionCount} sessions logged`,
      icon: Layers,
    },
  ];

  return (
    <section aria-labelledby="snapshot-heading">
      <h2 id="snapshot-heading" className="text-xs font-semibold uppercase tracking-wider text-foreground-subtle mb-3">
        Performance Snapshot
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <Card key={m.label} variant="base" className="p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">{m.label}</span>
                <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold tracking-tight text-foreground">{m.value}</p>
                <p className="text-xs text-foreground-subtle mt-0.5">{m.subtext}</p>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
