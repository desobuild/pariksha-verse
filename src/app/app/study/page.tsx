import { BookOpen, Atom, FlaskConical, Dna } from "lucide-react";
import { PageContainer } from "@/components/navigation/page-container";
import { SectionHeader } from "@/components/shared/section-header";
import { IconTile } from "@/components/shared/icon-tile";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const SUBJECTS = [
  { name: "Physics", icon: Atom },
  { name: "Chemistry", icon: FlaskConical },
  { name: "Biology", icon: Dna },
];

export default function StudyPage() {
  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="type-h1">Study</h1>
        <p className="mt-1 type-body text-muted-foreground">
          Browse your syllabus by subject, chapter, and topic.
        </p>
      </div>

      <SectionHeader title="Subjects" description="Verified NEET syllabus baseline" />
      <div className="space-y-3">
        {SUBJECTS.map((subject) => (
          <Card key={subject.name} variant="base" className="p-4">
            <div className="flex items-center gap-3.5">
              <IconTile variant="tint" size="md">
                <subject.icon className="h-5 w-5" />
              </IconTile>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{subject.name}</p>
                <p className="mt-0.5 text-xs text-foreground-subtle">
                  Chapter breakdown unlocks with the Study module.
                </p>
              </div>
              <Badge variant="neutral">Soon</Badge>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-8">
        <SectionHeader title="Syllabus Tracker" />
        <Card className="p-5">
          <div className="flex items-center gap-3.5">
            <IconTile variant="strong" size="lg">
              <BookOpen className="h-6 w-6" />
            </IconTile>
            <div>
              <p className="text-[15px] font-semibold text-foreground">Full syllabus tree</p>
              <p className="mt-0.5 text-xs leading-relaxed text-foreground-subtle">
                Chapter and topic tracking, session logging, and mastery states arrive in the
                study phase.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}
