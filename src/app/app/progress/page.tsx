import { PageContainer } from "@/components/navigation/page-container";
import { PageHeader } from "@/components/navigation/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ProgressPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Progress & Analytics"
        description="Coverage metrics, accuracy trends, and readiness indicators."
        badge={<Badge variant="secondary">Analytics</Badge>}
      />

      <Card>
        <CardHeader>
          <CardTitle>Preparation Analytics</CardTitle>
          <CardDescription>Subject mastery and revision retention</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Progress metrics and retention analytics will be implemented in subsequent phases.
          </p>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
