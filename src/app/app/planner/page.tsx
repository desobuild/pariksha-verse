import { PageContainer } from "@/components/navigation/page-container";
import { PageHeader } from "@/components/navigation/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function PlannerPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Study Planner"
        description="Daily agendas, revision scheduling, and preparation timelines."
        badge={<Badge variant="secondary">Planner</Badge>}
      />

      <Card>
        <CardHeader>
          <CardTitle>Timeline Planner</CardTitle>
          <CardDescription>Target milestones and scheduled reviews</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Planner scheduling engine and daily task allocations will be connected in Phase 2.
          </p>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
