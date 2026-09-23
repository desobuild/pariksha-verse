import { PageContainer } from "@/components/navigation/page-container";
import { PageHeader } from "@/components/navigation/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function StudyPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Study & Syllabus"
        description="Browse exam chapters, syllabus breakdowns, and concepts."
        badge={<Badge variant="secondary">Syllabus</Badge>}
      />

      <Card>
        <CardHeader>
          <CardTitle>Syllabus Tracker</CardTitle>
          <CardDescription>Hierarchical subject and topic mapping</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Topic syllabus tree and study sessions will be connected to the exam-agnostic domain in Phase 2.
          </p>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
