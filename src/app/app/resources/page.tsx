import { Library, Notebook, PlayCircle, Sigma, FileQuestion } from "lucide-react";
import { PageContainer } from "@/components/navigation/page-container";
import { SectionHeader } from "@/components/shared/section-header";
import { IconTile } from "@/components/shared/icon-tile";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";

const CATEGORIES = [
  { label: "Notes", icon: Notebook },
  { label: "PYQs", icon: FileQuestion },
  { label: "Videos", icon: PlayCircle },
  { label: "Formula sheets", icon: Sigma },
];

export default function ResourcesPage() {
  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="type-h1">Resources</h1>
        <p className="mt-1 type-body text-muted-foreground">
          High-yield material curated around your syllabus.
        </p>
      </div>

      {/* Category tiles */}
      <div className="mb-8 grid grid-cols-4 gap-2.5">
        {CATEGORIES.map((category) => (
          <Card key={category.label} variant="muted" className="flex flex-col items-center gap-2 p-3.5">
            <IconTile variant="tint" size="sm">
              <category.icon className="h-4 w-4" />
            </IconTile>
            <span className="text-center text-[11px] font-medium leading-tight text-muted-foreground">
              {category.label}
            </span>
          </Card>
        ))}
      </div>

      <SectionHeader title="Saved For You" />
      <EmptyState
        icon={<Library className="h-6 w-6" />}
        title="Your library starts here"
        description="Saved notes, PYQ sets, and formula sheets will collect here as the resource library grows."
        className="min-h-[240px]"
      />
    </PageContainer>
  );
}
