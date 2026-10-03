# ParikshaVerse

> Prepare smarter. Track everything.

A mobile-first preparation companion for competitive exams in India.

**[Open ParikshaVerse →](https://pariksha-verse-staging.desobuild.workers.dev/)**

ParikshaVerse helps students organize their preparation across syllabus tracking, study planning, practice, revision, mock tests, and performance analytics — without requiring an account to get started.

> **Current status:** V1 is under active development. The public deployment is a staging environment and should not be considered a production service.

---

## Product Philosophy

**TRACK → UNDERSTAND → PLAN → STUDY → PRACTICE → REVISE → ANALYZE → IMPROVE**

NEET is the initial supported exam, but the underlying architecture is exam-agnostic and designed to support JEE, UPSC, SSC, GATE, CAT, CUET, Banking, state-level competitive exams, and future exam datasets.

---

## Core Features

- **Guest Mode** — Start preparing without creating an account.
- **Exam Workspaces** — Organize preparation around a selected exam and attempt.
- **Syllabus Tracking** — Track progress from subjects and chapters down to individual topics.
- **Study Planning** — Organize what to study and when.
- **Practice** — Work through topic, subject, or mixed practice sessions.
- **Revision** — Follow deterministic spaced-review intervals.
- **Mock Tests** — Simulate timed exam sessions with section-aware question selection.
- **Analytics** — Review study activity, topic coverage, practice performance, revision activity, and mock-test results.
- **Resources** — Keep useful study resources organized alongside preparation.
- **PWA** — Designed as a mobile-first installable web application.

---

## Tech Stack

- **Framework**: Next.js (App Router) + React 19
- **Deployment**: Cloudflare Workers via `vinext` + `@vinext/cloudflare`
- **Database**: Cloudflare D1 (Serverless SQLite) with Drizzle ORM
- **Language**: TypeScript (Strict Mode)
- **Styling**: Tailwind CSS with Light/Dark/System semantic tokens
- **UI**: shadcn/ui + Radix UI primitives
- **Icons**: Lucide React
- **Validation**: Zod
- **Unit & Integration Testing**: Vitest with React Testing Library + JSDOM
- **End-to-End Testing**: Playwright
- **Package Manager**: pnpm

---

## Architecture

ParikshaVerse separates exam-agnostic domain logic from the application and persistence layers.

### Exam Model

```text
Exam
└── Exam Attempt
    └── Subject
        └── Chapter
            └── Topic
```

### User Preparation Model

```text
User
└── Exam Workspace
    ├── Topic Progress
    ├── Study Sessions
    ├── Planner Tasks
    ├── Revision Items
    ├── Practice Sessions
    ├── Mock Tests
    └── Analytics
```

Domain logic is kept independent from the persistence layer wherever practical, allowing the same preparation model to support guest and authenticated experiences.

---

## Project Structure

```text
src/
├── app/                  # Next.js App Router, layouts, pages, and API routes
│   ├── (marketing)/      # Landing and onboarding routes
│   ├── app/              # Core authenticated/guest preparation app
│   │   ├── home/
│   │   ├── study/
│   │   ├── planner/
│   │   ├── progress/
│   │   ├── resources/
│   │   ├── mock-tests/
│   │   └── more/
│   ├── auth/             # Authentication flows
│   ├── exam/             # Exam selection and personalization
│   ├── legal/            # Terms and privacy disclosures
│   └── api/              # API routes
│
├── components/
│   ├── ui/               # Accessible UI primitives
│   ├── navigation/       # AppHeader, DesktopSidebar, MobileBottomNav, etc.
│   └── shared/           # Theme, states, and shared components
│
├── features/             # Feature-specific modules
├── domain/               # Exam-agnostic business logic and domain rules
├── db/                   # Database client, schema, and migrations
│   ├── schema/
│   ├── migrations/
│   └── index.ts
│
├── lib/
│   ├── storage/          # Storage abstraction
│   ├── validation/       # Zod schemas and validation
│   ├── cloudflare/       # Cloudflare environment bindings
│   └── utils/            # Shared utilities
│
├── config/               # Centralized application configuration
├── hooks/                # Custom React hooks
└── types/                # Shared TypeScript definitions
```

---

## Available Scripts

| Command | Purpose |
| :--- | :--- |
| `pnpm dev` | Start the local development server |
| `pnpm build` | Build the production Next.js bundle |
| `pnpm start` | Start the production Next.js server |
| `pnpm vinext:dev` | Run the application using the vinext Vite-based runtime |
| `pnpm vinext:build` | Build the application for Cloudflare Workers |
| `pnpm vinext:deploy` | Deploy to Cloudflare Workers |
| `pnpm typecheck` | Run strict TypeScript verification |
| `pnpm lint` | Run ESLint checks |
| `pnpm format:check` | Verify formatting with Prettier |
| `pnpm format:write` | Format files with Prettier |
| `pnpm test` | Run Vitest unit and integration tests |
| `pnpm test:watch` | Run Vitest in watch mode |
| `pnpm test:e2e` | Run Playwright end-to-end tests |
| `pnpm db:generate` | Generate SQL migrations from Drizzle schemas |
| `pnpm db:migrate` | Apply migrations to Cloudflare D1 |
| `pnpm db:studio` | Launch Drizzle Studio |

---

## Local Development

### Prerequisites

- Node.js `20+`
- pnpm

### Setup

Clone the repository and install dependencies:

```bash
git clone https://github.com/desobuild/pariksha-verse.git
cd pariksha-verse
pnpm install
```

Copy the sample environment configuration:

```bash
cp .env.example .env.local
```

Start the development server:

```bash
pnpm dev
```

Open:

```text
http://localhost:3000
```

### Verify the Project

```bash
pnpm typecheck
pnpm lint
pnpm test
```

---

## Testing

ParikshaVerse uses multiple layers of automated validation:

- **Vitest** — Unit and integration tests
- **React Testing Library** — Component behavior
- **Playwright** — End-to-end browser testing
- **TypeScript** — Strict compile-time verification
- **ESLint** — Static analysis

Run the main checks with:

```bash
pnpm test
pnpm typecheck
pnpm lint
```

The current V1 test suite contains **604 passing tests**.

---

## Cloudflare Development & Deployment

The deployment pipeline is Cloudflare-first:

```text
Next.js App Router
        ↓
      vinext
        ↓
Cloudflare Workers
        ↓
 Cloudflare D1
```

- **Wrangler Configuration**: Defined in [`wrangler.jsonc`](./wrangler.jsonc).
- **Database Client**: [`src/db/index.ts`](./src/db/index.ts) using `drizzle-orm/d1`.
- **Environment Bindings**: [`src/lib/cloudflare/env.ts`](./src/lib/cloudflare/env.ts) provides typed server-side Cloudflare bindings.

The public staging deployment is available at:

**[Open ParikshaVerse →](https://pariksha-verse-staging.desobuild.workers.dev/)**

> The public deployment is a staging environment for the current V1. Production infrastructure is maintained separately and is not the public application environment.

Deployment requires access to the appropriate Cloudflare account and environment credentials. The public repository does not contain deployment secrets.

To deploy from an appropriately configured development environment:

```bash
pnpm vinext:deploy
```

---

## Storage & Guest Workspace Abstraction

ParikshaVerse uses a storage abstraction so product features do not depend directly on a specific persistence implementation.

- **Guest users** — Progress is persisted locally in the browser.
- **Authenticated users** — Progress is persisted through the Cloudflare D1-backed application.
- **StorageAdapter** — Provides the boundary between product features and persistence implementations.
- **MemoryStorageAdapter** — Used for SSR, testing, and fallback scenarios.

When a guest user creates or signs into an account, their local workspace can be migrated into the authenticated workspace.

The storage boundary is defined in [`src/lib/storage/types.ts`](./src/lib/storage/types.ts).

---

## Current V1 Scope

### Included

- Guest mode and authentication
- Exam selection and onboarding
- Exam workspaces
- Syllabus and topic tracking
- Study planning
- Practice sessions
- Spaced revision
- Mock tests
- Performance analytics
- Study resources
- PWA support

### Intentionally Not Included in V1

- AI tutor or AI-generated questions
- Social features
- Leaderboards
- Chat
- Forums
- Subscriptions
- Rank or selection prediction

The focus of V1 is a reliable preparation workflow built around the student's own progress and activity.

---

## Security

ParikshaVerse includes:

- HttpOnly session cookies
- HMAC-signed authentication sessions
- Expiring authentication verification tokens
- Authentication rate limiting
- Tenant-scoped data access
- Security headers and Content Security Policy
- Structured and redacted server-side logging

Sensitive runtime configuration is provided through environment/runtime secrets rather than committed to the repository.

See [`docs/observability.md`](./docs/observability.md) for the observability and logging model.

If you discover a security vulnerability, please report it privately rather than opening a public issue. See [`SECURITY.md`](./SECURITY.md) for the reporting process.

---

## Product Data

NEET is the initial supported exam.

The application uses an exam-agnostic domain model so additional competitive exams can be introduced without changing the underlying preparation workflow.

The initial NEET dataset is based on the documented syllabus provenance maintained in the project. The current `neet-2027` dataset is explicitly treated as a provisional baseline rather than an official NEET-UG 2027 syllabus.

---

## Brand Configuration

Brand strings are centralized in [`src/config/brand.ts`](./src/config/brand.ts).

Rebranding or adjusting product taglines can therefore be handled from a central configuration rather than being duplicated throughout the application.

---

## Project Status

ParikshaVerse is currently in active V1 development.

The public staging deployment is available here:

**[Open ParikshaVerse →](https://pariksha-verse-staging.desobuild.workers.dev/)**

The repository is public and the project is being developed incrementally with a focus on:

- mobile-first UX
- exam-agnostic architecture
- reliable progress tracking
- deterministic preparation workflows
- testable domain logic
- privacy-conscious authentication and observability
- Cloudflare-first deployment

---

## License

No open-source license has been applied to this repository at this time.
