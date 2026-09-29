import { getCloudflareEnv } from "@/lib/cloudflare/env";

export interface SendMagicLinkEmailParams {
  email: string;
  verificationUrl: string;
  token?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailProvider {
  sendMagicLinkEmail(params: SendMagicLinkEmailParams): Promise<SendEmailResult>;
}

/**
 * Resend transactional email provider implementation via standard HTTP fetch.
 * Fully compatible with Cloudflare Workers, Edge Runtime, and Node.js.
 */
export class ResendEmailProvider implements EmailProvider {
  private apiKey: string;
  private from: string;

  constructor(apiKey: string, from: string = "ParikshaVerse <auth@parikshaverse.in>") {
    this.apiKey = apiKey;
    this.from = from;
  }

  async sendMagicLinkEmail({
    email,
    verificationUrl,
    token,
  }: SendMagicLinkEmailParams): Promise<SendEmailResult> {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.from,
          to: [email],
          subject: "Your ParikshaVerse Sign-In Link",
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h2 style="color: #0f172a; margin-top: 0;">Sign in to ParikshaVerse</h2>
              <p style="color: #334155; font-size: 15px; line-height: 1.5;">Click the button below to sign in and access your synced study workspace:</p>
              <div style="margin: 28px 0;">
                <a href="${verificationUrl}" style="background-color: #0284c7; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                  Sign In to ParikshaVerse
                </a>
              </div>
              <p style="color: #475569; font-size: 13px; line-height: 1.4;">Or enter this verification token in your browser:</p>
              <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 13px; word-break: break-all; color: #0f172a;">
                ${token || ""}
              </div>
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 28px 0;" />
              <p style="color: #64748b; font-size: 12px; margin-bottom: 0;">
                This link will expire in 15 minutes. If you did not request this email, you can safely ignore it.
              </p>
            </div>
          `,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Resend email dispatch failed (${response.status}): ${errorText}`,
        };
      }

      const data = (await response.json()) as { id?: string };
      return {
        success: true,
        messageId: data.id,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Network error during email dispatch",
      };
    }
  }
}

/**
 * In-memory test email provider for unit tests and local mock verification.
 */
export class TestEmailProvider implements EmailProvider {
  public sentEmails: SendMagicLinkEmailParams[] = [];
  public shouldFail: boolean = false;
  public failureMessage: string = "Simulated email provider failure";

  async sendMagicLinkEmail(params: SendMagicLinkEmailParams): Promise<SendEmailResult> {
    if (this.shouldFail) {
      return {
        success: false,
        error: this.failureMessage,
      };
    }
    this.sentEmails.push({ ...params });
    return {
      success: true,
      messageId: `test_msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    };
  }

  clear(): void {
    this.sentEmails = [];
    this.shouldFail = false;
  }
}

/**
 * Local development fallback provider that logs magic link URL to the console
 * without requiring live credentials.
 */
export class ConsoleEmailProvider implements EmailProvider {
  async sendMagicLinkEmail(params: SendMagicLinkEmailParams): Promise<SendEmailResult> {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.log(`[Email Dev Adapter] Magic link for ${params.email}: ${params.verificationUrl}`);
    }
    return {
      success: true,
      messageId: `console_${Date.now()}`,
    };
  }
}

let activeProvider: EmailProvider | null = null;

/**
 * Overrides the active email provider (useful for tests).
 */
export function setEmailProvider(provider: EmailProvider | null): void {
  activeProvider = provider;
}

/**
 * Resolves the appropriate email provider based on configuration.
 */
export function getEmailProvider(): EmailProvider {
  if (activeProvider) {
    return activeProvider;
  }

  const isServerOrTest =
    typeof window === "undefined" ||
    !!process.env.VITEST ||
    process.env.NODE_ENV === "test";
  const cfEnv = isServerOrTest ? getCloudflareEnv() : {};
  const resendApiKey =
    cfEnv.RESEND_API_KEY ||
    (typeof process !== "undefined" ? process.env?.RESEND_API_KEY : undefined);
  const fromEmail =
    cfEnv.EMAIL_FROM ||
    (typeof process !== "undefined" ? process.env?.EMAIL_FROM : undefined) ||
    "ParikshaVerse <auth@parikshaverse.in>";

  if (resendApiKey && resendApiKey.trim() !== "") {
    return new ResendEmailProvider(resendApiKey, fromEmail);
  }

  const env = (
    cfEnv.ENVIRONMENT ||
    (typeof process !== "undefined" ? process.env?.ENVIRONMENT || process.env?.NODE_ENV : undefined) ||
    "development"
  ).toLowerCase();

  const isStagingOrProd =
    env === "production" ||
    env === "staging" ||
    (typeof process !== "undefined" &&
      (process.env?.ENVIRONMENT === "production" ||
        process.env?.ENVIRONMENT === "staging"));

  if (isStagingOrProd) {
    // In staging or production, fail safely if email credentials are missing
    return {
      async sendMagicLinkEmail() {
        return {
          success: false,
          error: "Transactional email provider is not configured for staging/production.",
        };
      },
    };
  }

  // In test environment, return a TestEmailProvider
  if (typeof process !== "undefined" && process.env?.NODE_ENV === "test") {
    return new TestEmailProvider();
  }

  return new ConsoleEmailProvider();
}

/**
 * Dispatches a magic-link authentication email through the configured provider.
 */
export async function sendMagicLinkEmail(params: SendMagicLinkEmailParams): Promise<SendEmailResult> {
  const provider = getEmailProvider();
  return provider.sendMagicLinkEmail(params);
}
