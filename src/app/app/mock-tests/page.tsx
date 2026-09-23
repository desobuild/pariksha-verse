import { ClipboardCheck, Timer, Trophy, CalendarPlus } from "lucide-react";
import { PageContainer } from "@/components/navigation/page-container";
import { SectionHeader } from "@/components/shared/section-header";
import { IconTile } from "@/components/shared/icon-tile";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";

export default function MockTestsPage() {
  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="type-h1">Mock Tests</h1>
        <p className="mt-1 type-body text-muted-foreground">
          Simulate the real thing, then learn from every attempt.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3">
        <Card className="flex items-center gap-3 p-4">
          <IconTile variant="tint" size="sm">
            <Timer className="h-4 w-4" />
          </IconTile>
          <div>
            <p className="text-base font-bold leading-none text-foreground">—</p>
            <p className="mt-1 text-[11px] leading-tight text-foreground-subtle">Mocks taken</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <IconTile variant="tint" size="sm">
            <Trophy className="h-4 w-4" />
          </IconTile>
          <div>
            <p className="text-base font-bold leading-none text-foreground">—</p>
            <p className="mt-1 text-[11px] leading-tight text-foreground-subtle">Best score</p>
          </div>
        </Card>
      </div>

      <SectionHeader title="Upcoming" description="Scheduled test days" />
      <Card className="mb-8 p-5">
        <div className="flex items-center gap-3.5">
          <IconTile variant="tint" size="md">
            <CalendarPlus className="h-5 w-5" />
          </IconTile>
          <div>
            <p className="text-sm font-semibold text-foreground">No mocks scheduled</p>
            <p className="mt-0.5 text-xs leading-relaxed text-foreground-subtle">
              Schedule full-length or sectional tests once the practice tracker is live.
            </p>
          </div>
        </div>
      </Card>

      <SectionHeader title="Practice History" />
      <EmptyState
        icon={<ClipboardCheck className="h-6 w-6" />}
        title="No attempts yet"
        description="Scores, accuracy, and time management insights will appear after your first logged mock."
        className="min-h-[220px]"
      />
    </PageContainer>
  );
}
