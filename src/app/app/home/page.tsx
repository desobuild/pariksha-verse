import { PageContainer } from "@/components/navigation/page-container";
import { PageHeader } from "@/components/navigation/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BRAND } from "@/config/brand";

export default function HomePage() {
  return (
    <PageContainer>
      <PageHeader
        title="Home"
        description={`Welcome to your ${BRAND.name} preparation space.`}
        badge={<Badge variant="outline">Target: NEET 2026</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Daily Focus</CardTitle>
            <CardDescription>Structured preparation milestone</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Module placeholder. Feature implementation scheduled for Phase 2+.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Study Plan</CardTitle>
            <CardDescription>Track today&apos;s schedule</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Module placeholder. Feature implementation scheduled for Phase 2+.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revision Queue</CardTitle>
            <CardDescription>Spaced repetition check</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Module placeholder. Feature implementation scheduled for Phase 2+.
            </p>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
