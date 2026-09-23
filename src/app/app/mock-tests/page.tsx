import { PageContainer } from "@/components/navigation/page-container";
import { PageHeader } from "@/components/navigation/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function MockTestsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Mock Tests & Practice"
        description="Exam simulations, sectional tests, and question banks."
        badge={<Badge variant="secondary">Practice</Badge>}
      />

      <Card>
        <CardHeader>
          <CardTitle>Test Center</CardTitle>
          <CardDescription>Timed exam simulations and error log analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Mock test simulation engine and error logging will be introduced in subsequent phases.
          </p>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
