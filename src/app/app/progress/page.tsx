import { Flame, Clock, Target } from "lucide-react";
import { PageContainer } from "@/components/navigation/page-container";
import { SectionHeader } from "@/components/shared/section-header";
import { IconTile } from "@/components/shared/icon-tile";
import { Card } from "@/components/ui/card";

const STATS = [
  { label: "Study streak", icon: Flame },
  { label: "Hours studied", icon: Clock },
  { label: "Syllabus covered", icon: Target },
];

export default function ProgressPage() {
  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="type-h1">Progress</h1>
        <p className="mt-1 type-body text-muted-foreground">
          See how your preparation compounds over time.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-3 gap-3">
        {STATS.map((stat) => (
          <Card key={stat.label} className="p-4">
            <IconTile variant="tint" size="sm">
              <stat.icon className="h-4 w-4" />
            </IconTile>
            <p className="mt-3 text-lg font-bold leading-none text-foreground">—</p>
            <p className="mt-1.5 text-[11px] leading-tight text-foreground-subtle">{stat.label}</p>
          </Card>
        ))}
      </div>

      <SectionHeader title="Subject Readiness" description="Coverage per subject" />
      <Card className="mb-8 divide-y divide-border-subtle">
        {["Physics", "Chemistry", "Biology"].map((subject) => (
          <div key={subject} className="flex items-center justify-between gap-3 px-5 py-4">
            <p className="text-sm font-medium text-foreground">{subject}</p>
            <p className="text-xs text-foreground-subtle">Starts with your first session</p>
          </div>
        ))}
      </Card>

      <SectionHeader title="Trends" />
      <Card className="p-5">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Accuracy trends, revision retention, and readiness scoring will light up as you study,
          practice, and revise.
        </p>
      </Card>
    </PageContainer>
  );
}
