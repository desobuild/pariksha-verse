import Link from "next/link";
import { PageContainer } from "@/components/navigation/page-container";
import { PageHeader } from "@/components/navigation/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BRAND } from "@/config/brand";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface px-4 py-3 sm:px-6">
        <Link href="/" className="font-semibold text-sm text-foreground hover:text-primary transition-colors">
          &larr; Back to {BRAND.name}
        </Link>
      </header>
      <PageContainer size="narrow">
        <PageHeader
          title="Privacy Policy"
          description="How ParikshaVerse handles and safeguards your exam study information."
        />
        <Card>
          <CardHeader>
            <CardTitle>Data Protection Principles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              ParikshaVerse operates with an offline-first and privacy-conscious design. Guest
              preparation progress is stored locally in your browser workspace.
            </p>
            <p>
              When Cloudflare infrastructure is used, requests are processed at the network edge
              with industry-standard TLS encryption.
            </p>
          </CardContent>
        </Card>
      </PageContainer>
    </div>
  );
}
