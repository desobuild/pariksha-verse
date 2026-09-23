import Link from "next/link";
import { PageContainer } from "@/components/navigation/page-container";
import { PageHeader } from "@/components/navigation/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BRAND } from "@/config/brand";
import { Settings, Shield, FileText, Smartphone } from "lucide-react";

export default function MorePage() {
  return (
    <PageContainer>
      <PageHeader
        title="More & Settings"
        description="Preferences, workspace backup, legal disclosures, and account controls."
        badge={<Badge variant="outline">Settings</Badge>}
      />

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-primary" />
              <span>Workspace Preferences</span>
            </CardTitle>
            <CardDescription>Target exam configuration and guest backup</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Guest workspace data is stored locally on this device. Future phases will support encrypted cloud sync.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-primary" />
              <span>About {BRAND.name}</span>
            </CardTitle>
            <CardDescription>Mobile-first companion for competitive exams</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Built with Next.js, Cloudflare Workers, and D1. Designed for offline-first reliability and sub-second load times.
            </p>
            <div className="flex gap-4 text-sm text-primary">
              <Link href={BRAND.links.terms} className="inline-flex items-center gap-1 hover:underline">
                <FileText className="h-3.5 w-3.5" />
                <span>Terms of Service</span>
              </Link>
              <Link href={BRAND.links.privacy} className="inline-flex items-center gap-1 hover:underline">
                <Shield className="h-3.5 w-3.5" />
                <span>Privacy Policy</span>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
