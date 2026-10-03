# Security Policy

## Supported Versions

ParikshaVerse is currently under active development.

Security fixes are applied to the current `main` branch and the publicly deployed staging environment.

| Version | Supported |
| --- | --- |
| `main` | Yes |
| Older commits/releases | No |

## Reporting a Vulnerability

Please do **not** report security vulnerabilities through public GitHub issues, pull requests, or discussions.

For security issues, please contact:

**Email:** anirudhrpatil@protonmail.com

When reporting a vulnerability, please include:

- A clear description of the issue
- The affected functionality or endpoint
- Steps to reproduce the issue
- The potential security impact
- Any relevant screenshots, logs, or proof-of-concept details
- Your suggested remediation, if known

Please avoid including real user data, authentication tokens, passwords, session cookies, API keys, or other secrets in the report.

## What to Expect

After receiving a report, the maintainer will:

1. Review and reproduce the reported issue where possible.
2. Assess its security impact.
3. Determine the appropriate remediation.
4. Release a fix when practical.
5. Update the relevant documentation when necessary.

Response and remediation timelines may vary depending on the severity and complexity of the issue.

## Scope

Security reports may include issues involving:

- Authentication and session management
- Authorization and cross-user data access
- Guest-to-account migration
- API endpoints
- Database access and tenant isolation
- Input validation
- Injection vulnerabilities
- Cross-site scripting (XSS)
- Cross-site request forgery (CSRF)
- Security headers and browser protections
- Sensitive information disclosure
- Rate limiting and abuse controls
- Cloudflare Worker or D1 integration
- Dependency vulnerabilities affecting the deployed application

## Out of Scope

The following are generally outside the scope of this policy:

- Vulnerabilities in third-party services that do not originate from ParikshaVerse
- Denial-of-service attacks against the public deployment
- Automated scanning that creates excessive traffic or degrades service
- Social engineering or phishing
- Physical attacks
- Issues requiring access to secrets or infrastructure that are not publicly exposed
- Vulnerabilities that depend entirely on unsupported, obsolete browsers or environments

## Responsible Disclosure

Please allow reasonable time for investigation and remediation before publicly disclosing a vulnerability.

Do not access, modify, delete, or expose data belonging to other users beyond what is necessary to demonstrate the vulnerability.

If a vulnerability can be demonstrated without accessing real user data, please use that approach.

## Security Practices

ParikshaVerse follows several security practices, including:

- HttpOnly, Secure, SameSite session cookies
- Stateless signed authentication verification tokens
- Hashed verification-token storage
- Atomic token consumption
- Session revocation
- API rate limiting
- Cross-tenant authorization checks
- Security headers and Content Security Policy
- Request identifiers for operational tracing
- Structured server-side logging with sensitive-data redaction
- No authentication tokens, session identifiers, secrets, or passwords in application logs
- Guest workspace ownership validation during migration
- Database queries scoped to the authenticated workspace/user where applicable

Additional operational and observability details are documented in [`docs/observability.md`](docs/observability.md).

## Dependency Security

Dependencies are periodically reviewed using the project's package-manager audit tooling.

Not every dependency advisory can necessarily be addressed immediately when it originates from a transitive build or development dependency. Such findings are evaluated based on whether the affected package is reachable in the deployed application and the practical security impact.

## Public Deployment

The public ParikshaVerse deployment is currently a **staging environment**.

The production Worker and production database are maintained separately and are not the public application environment.

See [`docs/public-deployment.md`](docs/public-deployment.md) for the current deployment model and environment boundaries.