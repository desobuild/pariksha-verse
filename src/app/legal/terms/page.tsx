import Link from "next/link";
import { PageContainer } from "@/components/navigation/page-container";
import { PageHeader } from "@/components/navigation/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BRAND } from "@/config/brand";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface px-4 py-3 sm:px-6">
        <Link href="/" className="font-bold text-foreground hover:text-primary transition-colors">
          &larr; Back to {BRAND.name}
        </Link>
      </header>
      <PageContainer size="narrow">
        <PageHeader
          title="Terms of Service"
          description="Terms and conditions for utilizing the ParikshaVerse preparation companion."
        />
        <Card>
          <CardHeader>
            <CardTitle>Usage Guidelines</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              {BRAND.name} is an independent preparation companion built to assist students preparing for competitive examinations in India.
            </p>
            <p>
              All test syllabi, chapter outlines, and exam formats remain the intellectual property of their respective examining bodies (e.g. NTA, UPSC, etc.).
            </p>
          </CardContent>
        </Card>
      </PageContainer>
    </div>
  );
}
