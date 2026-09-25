import * as React from "react";
import { RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatAccuracy, type WeakTopicInfo } from "@/domain/practice";
import { diffLocalDays } from "@/domain/revision";

export interface WeakTopicsListProps {
  weakTopics: WeakTopicInfo[];
  onPracticeTopic: (topicId: string) => void;
}

function formatRelativePracticeDate(d: Date | null): string {
  if (!d) return "—";
  const diff = diffLocalDays(new Date(d), new Date());
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function WeakTopicsList({ weakTopics, onPracticeTopic }: WeakTopicsListProps) {
  return (
    <section aria-labelledby="weak-topics-heading">
      <div className="flex items-center justify-between mb-3">
        <h2 id="weak-topics-heading" className="text-xs font-semibold uppercase tracking-wider text-foreground-subtle">
          Topics Needing Practice
        </h2>
        {weakTopics.length > 0 && (
          <Badge variant="warning" className="text-[11px]">
            {weakTopics.length} {weakTopics.length === 1 ? "topic" : "topics"} below 60%
          </Badge>
        )}
      </div>

      {weakTopics.length === 0 ? (
        <Card variant="base" className="p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Nothing is currently below your practice threshold.
          </p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {weakTopics.map((topic) => (
            <Card
              key={topic.topicId}
              variant="base"
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs text-foreground-subtle">
                  {topic.subjectName} · {topic.chapterName}
                </p>
                <h3 className="text-sm font-semibold text-foreground truncate mt-0.5">
                  {topic.topicName}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold text-warning">
                    {formatAccuracy(topic.accuracy)} accuracy
                  </span>
                  <span>·</span>
                  <span>{topic.totalQuestions} questions</span>
                  <span>·</span>
                  <span>Last practiced {formatRelativePracticeDate(topic.lastPracticedAt)}</span>
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px] shrink-0 font-semibold gap-1.5 self-start sm:self-center"
                onClick={() => onPracticeTopic(topic.topicId)}
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Practice Again
              </Button>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
