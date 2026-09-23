import Link from "next/link";
import { PageContainer } from "@/components/navigation/page-container";
import { PageHeader } from "@/components/navigation/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ExamPersonalizePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface px-4 py-3 sm:px-6">
        <Link href="/exam/select" className="font-bold text-foreground hover:text-primary transition-colors">
          &larr; Back to Exam Selection
        </Link>
      </header>

      <PageContainer size="narrow">
        <PageHeader
          title="Personalize Preparation"
          description="Configure your target exam year, available study hours, and current preparation stage."
        />

        <Card>
          <CardHeader>
            <CardTitle>Preparation Profile</CardTitle>
            <CardDescription>Target timeline and daily baseline</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Personalization forms and workspace initialization will be implemented in subsequent phases.
            </p>
            <Button asChild className="w-full">
              <Link href="/app/home">Enter Preparation Space</Link>
            </Button>
          </CardContent>
        </Card>
      </PageContainer>
    </div>
  );
}
