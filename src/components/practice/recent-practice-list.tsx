import * as React from "react";
import { Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PracticeSession } from "@/db/schema";
import { formatAccuracy, calculateAccuracyBps } from "@/domain/practice";
import { getTopicMetadata } from "@/domain/dashboard";
import { diffLocalDays } from "@/domain/revision";

export interface RecentPracticeListProps {
  sessions: PracticeSession[];
  examAttemptId: string;
}

function formatRelativeSessionDate(d: Date | null | undefined): string {
  if (!d) return "—";
  const dateObj = new Date(d);
  const diff = diffLocalDays(dateObj, new Date());
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return dateObj.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function RecentPracticeList({ sessions, examAttemptId }: RecentPracticeListProps) {
  return (
    <section aria-labelledby="recent-practice-heading">
      <div className="flex items-center justify-between mb-3">
        <h2 id="recent-practice-heading" className="text-xs font-semibold uppercase tracking-wider text-foreground-subtle">
          Recent Practice
        </h2>
        {sessions.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {sessions.length} {sessions.length === 1 ? "session" : "sessions"} logged
          </span>
        )}
      </div>

      {sessions.length === 0 ? (
        <Card variant="base" className="p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No practice sessions recorded yet.
          </p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {sessions.map((sess) => {
            const meta = sess.topicId ? getTopicMetadata(sess.topicId, examAttemptId) : null;
            const accuracyBps = calculateAccuracyBps(sess.correct, sess.questionCount);
            const topicTitle = meta?.topicName || "Practice Session";
            const subtitle = meta ? `${meta.subjectName} · ${meta.chapterName}` : null;
            const dateLabel = formatRelativeSessionDate(sess.completedAt);

            return (
              <Card
                key={sess.id}
                variant="base"
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-primary bg-surface-tint px-2 py-0.5 rounded-md">
                      {dateLabel}
                    </span>
                    {subtitle && (
                      <span className="text-xs text-foreground-subtle truncate">
                        {subtitle}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-foreground truncate mt-1">
                    {topicTitle}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-1.5">
                    <span>
                      {sess.questionCount} {sess.questionCount === 1 ? "question" : "questions"}
                    </span>
                    <span>·</span>
                    <span>{sess.correct} correct</span>
                    <span>·</span>
                    <span className="font-semibold text-foreground">
                      {formatAccuracy(accuracyBps)} accuracy
                    </span>
                    {sess.durationMinutes > 0 && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-3 w-3 text-muted-foreground inline" />
                          {sess.durationMinutes} min
                        </span>
                      </>
                    )}
                  </p>
                </div>

                <div className="self-end sm:self-center">
                  <Badge
                    variant={accuracyBps >= 6000 ? "primary" : "warning"}
                    className="text-xs font-semibold"
                  >
                    {formatAccuracy(accuracyBps)}
                  </Badge>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
