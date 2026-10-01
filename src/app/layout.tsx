import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import { BRAND } from "@/config/brand";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { AuthProvider } from "@/lib/auth/auth-context";
import { RepositoryProvider } from "@/repositories/repository-provider";
import "./globals.css";

/**
 * Phase 14F: the per-request CSP nonce generated in middleware travels on the
 * CSP request header; next-themes' inline theme-bootstrap script must carry
 * the same nonce or the enforced policy blocks it (the only non-framework
 * inline script in the app — framework scripts pick the nonce up natively).
 */
async function getCspNonce(): Promise<string | undefined> {
  const headerList = await headers();
  const csp = headerList.get("content-security-policy");
  return csp?.match(/'nonce-([^']+)'/)?.[1];
}

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    template: `%s | ${BRAND.name}`,
  },
  description: BRAND.description,
  applicationName: BRAND.name,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: BRAND.name,
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF8FF" },
    { media: "(prefers-color-scheme: dark)", color: "#0D1220" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = await getCspNonce();
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} min-h-dynamic bg-background text-foreground font-sans antialiased`}>
        <ThemeProvider nonce={nonce}>
          <AuthProvider>
            <RepositoryProvider>{children}</RepositoryProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

