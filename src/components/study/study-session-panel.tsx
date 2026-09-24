"use client";

import * as React from "react";
import { Play, Square, Timer, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SESSION_TYPE_OPTIONS,
  computeSessionDurationMinutes,
  formatDurationMinutes,
  formatTimerDuration,
  summarizeRecentStudy,
} from "@/domain/study";
import type { StudySession } from "@/db/schema";

const MANUAL_MIN_MINUTES = 1;
const MANUAL_MAX_MINUTES = 600;

export interface StudySessionInput {
  startedAt: Date;
  endedAt: Date;
  durationMinutes: number;
  sessionType: string;
}

export interface StudySessionPanelProps {
  sessions: StudySession[];
  /** Persists a session through the repository layer (guest or authenticated). */
  onCreateSession: (input: StudySessionInput) => Promise<StudySession>;
  onSessionCreated: (session: StudySession) => void;
}

/**
 * Intentionally simple study-session logging: a live start/finish timer
 * with a manual duration fallback, plus the topic's real recent activity.
 */
export function StudySessionPanel({
  sessions,
  onCreateSession,
  onSessionCreated,
}: StudySessionPanelProps) {
  const [sessionStart, setSessionStart] = React.useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);
  const [manualOpen, setManualOpen] = React.useState(false);
  const [manualMinutes, setManualMinutes] = React.useState("25");
  const [manualType, setManualType] = React.useState("focused");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!sessionStart) return;
    const tick = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - sessionStart.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [sessionStart]);

  const handleStart = () => {
    setSessionStart(new Date());
    setElapsedSeconds(0);
    setManualOpen(false);
  };

  const recordSession = async (input: StudySessionInput) => {
    setSaving(true);
    setError(null);
    try {
      const created = await onCreateSession(input);
      onSessionCreated(created);
      setSessionStart(null);
      setElapsedSeconds(0);
      setManualOpen(false);
    } catch {
      setError("Could not save the session. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = () => {
    if (!sessionStart) return;
    const endedAt = new Date();
    void recordSession({
      startedAt: sessionStart,
      endedAt,
      durationMinutes: computeSessionDurationMinutes(sessionStart, endedAt),
      sessionType: "focused",
    });
  };

  const handleManualSave = () => {
    const minutes = Number.parseInt(manualMinutes, 10);
    if (!Number.isFinite(minutes) || minutes < MANUAL_MIN_MINUTES || minutes > MANUAL_MAX_MINUTES) {
      setError(`Enter a duration between ${MANUAL_MIN_MINUTES} and ${MANUAL_MAX_MINUTES} minutes.`);
      return;
    }
    const endedAt = new Date();
    const startedAt = new Date(endedAt.getTime() - minutes * 60000);
    void recordSession({ startedAt, endedAt, durationMinutes: minutes, sessionType: manualType });
  };

  const recentDays = React.useMemo(() => summarizeRecentStudy(sessions), [sessions]);

  return (
    <Card variant="base" className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="type-h4">Study Session</h2>
        {sessionStart && (
          <Badge variant="primary" className="gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            Recording
          </Badge>
        )}
      </div>

      {sessionStart ? (
        <div className="mt-4">
          <p
            className="text-3xl font-semibold tabular-nums tracking-tight text-foreground"
            aria-label={`Elapsed time ${formatTimerDuration(elapsedSeconds)}`}
          >
            {formatTimerDuration(elapsedSeconds)}
          </p>
          <p className="mt-1 text-xs text-foreground-subtle">
            Started at{" "}
            {sessionStart.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <Button onClick={handleFinish} disabled={saving} className="gap-2">
              <Square className="h-4 w-4" aria-hidden="true" />
              {saving ? "Saving…" : "Finish Session"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setSessionStart(null);
                setElapsedSeconds(0);
              }}
              disabled={saving}
              className="gap-2"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Discard
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2.5">
            <Button onClick={handleStart} className="gap-2">
              <Play className="h-4 w-4" aria-hidden="true" />
              Start Study Session
            </Button>
            {!manualOpen && (
              <Button variant="outline" onClick={() => setManualOpen(true)} className="gap-2">
                <Timer className="h-4 w-4" aria-hidden="true" />
                Log time manually
              </Button>
            )}
          </div>

          {manualOpen && (
            <div className="mt-4 rounded-xl border border-border-subtle bg-surface-tint/40 p-4">
              <p className="text-xs font-medium text-foreground">Log a completed session</p>
              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-[7rem_1fr_auto]">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={MANUAL_MIN_MINUTES}
                  max={MANUAL_MAX_MINUTES}
                  value={manualMinutes}
                  onChange={(e) => setManualMinutes(e.target.value)}
                  aria-label="Duration in minutes"
                />
                <Select value={manualType} onValueChange={setManualType}>
                  <SelectTrigger aria-label="Session type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SESSION_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleManualSave} disabled={saving}>
                  {saving ? "Saving…" : "Save session"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="mt-5 border-t border-border-subtle pt-4">
        <h3 className="text-sm font-semibold text-foreground">Recent Study</h3>
        {recentDays.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No study sessions recorded yet.</p>
        ) : (
          <ul className="mt-2.5 divide-y divide-border-subtle">
            {recentDays.map((day) => (
              <li key={day.key} className="flex items-center justify-between gap-3 py-2">
                <span className="text-sm text-foreground">{day.label}</span>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {formatDurationMinutes(day.minutes)}
                  {day.sessions > 1 && (
                    <span className="ml-1.5 text-xs text-foreground-subtle">
                      · {day.sessions} sessions
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
