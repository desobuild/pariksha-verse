import { PageContainer } from "@/components/navigation/page-container";
import { PageHeader } from "@/components/navigation/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ResourcesPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Resources & Library"
        description="Reference material, formula sheets, and curated study notes."
        badge={<Badge variant="secondary">Library</Badge>}
      />

      <Card>
        <CardHeader>
          <CardTitle>Study Materials</CardTitle>
          <CardDescription>Curated high-yield resources</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Resource repository and offline reading support will be added in subsequent phases.
          </p>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
