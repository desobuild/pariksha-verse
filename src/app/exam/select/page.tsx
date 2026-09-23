import Link from "next/link";
import { PageContainer } from "@/components/navigation/page-container";
import { PageHeader } from "@/components/navigation/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/config/brand";
import { GraduationCap, ArrowRight } from "lucide-react";

export default function ExamSelectPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface px-4 py-3 sm:px-6">
        <Link href="/" className="font-bold text-foreground hover:text-primary transition-colors">
          &larr; Back to {BRAND.name}
        </Link>
      </header>

      <PageContainer size="narrow">
        <PageHeader
          title="Choose Your Exam"
          description="Select your target competitive examination to personalize your syllabus and schedule."
        />

        <div className="grid gap-3 sm:grid-cols-2">
          {BRAND.supportedExamsInitial.map((exam) => (
            <Card key={exam} className="transition-all hover:border-primary/50">
              <CardHeader className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{exam}</CardTitle>
                  </div>
                  {exam === "NEET" && (
                    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                      Supported First
                    </span>
                  )}
                </div>
                <CardDescription className="text-xs">
                  Comprehensive exam tracker & syllabus
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <Button asChild variant="outline" size="sm" className="w-full justify-between">
                  <Link href={`/exam/personalize?exam=${encodeURIComponent(exam)}`}>
                    <span>Select {exam}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </PageContainer>
    </div>
  );
}
