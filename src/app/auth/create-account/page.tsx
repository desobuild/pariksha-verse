import Link from "next/link";
import { PageContainer } from "@/components/navigation/page-container";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BRAND } from "@/config/brand";

export default function CreateAccountPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12">
      <PageContainer size="narrow">
        <div className="mb-6 text-center">
          <Link href="/" className="inline-flex items-center gap-2 mb-2 font-bold text-xl text-foreground">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-sm">
              {BRAND.logo.mark}
            </div>
            <span>{BRAND.name}</span>
          </Link>
          <p className="text-sm text-muted-foreground">{BRAND.tagline}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create Account</CardTitle>
            <CardDescription>Start your personalized competitive exam journey</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" type="text" placeholder="Aarav Sharma" disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="student@example.com" disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" disabled />
            </div>
            <p className="text-xs text-muted-foreground">
              Account registration will be enabled in subsequent phases.
            </p>
            <Button asChild className="w-full">
              <Link href="/exam/select">Get Started as Guest</Link>
            </Button>
          </CardContent>
          <CardFooter className="justify-center border-t border-border pt-4 text-xs text-muted-foreground">
            <span>Already have an account? </span>
            <Link href="/auth/sign-in" className="ml-1 text-primary hover:underline font-semibold">
              Sign In
            </Link>
          </CardFooter>
        </Card>
      </PageContainer>
    </div>
  );
}
