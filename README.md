# ParikshaVerse

> A mobile-first preparation companion for competitive exams in India.

## Product Philosophy

**TRACK → UNDERSTAND → PLAN → STUDY → PRACTICE → REVISE → ANALYZE → IMPROVE**

NEET is the initial supported target, but the architecture is strictly exam-agnostic for JEE, UPSC, SSC, GATE, CAT, CUET, Banking, and future state-level competitive exams.

---

## Tech Stack

- **Framework**: Next.js (App Router) + React 19
- **Deployment Runtime**: Cloudflare Workers via `vinext` + `@vinext/cloudflare`
- **Database**: Cloudflare D1 (Serverless SQLite) with Drizzle ORM
- **Language**: TypeScript (Strict Mode)
- **Styling**: Tailwind CSS with deliberate Light/Dark/System semantic tokens
- **UI Primitives**: Radix UI / shadcn-compatible accessible primitives
- **Icons**: Lucide React
- **Validation**: Zod
- **Unit & Integration Testing**: Vitest with React Testing Library + JSDOM
- **End-to-End Testing**: Playwright
- **Package Manager**: pnpm

---

## Project Structure

```
src/
├── app/                  # Next.js App Router (route placeholders, layouts, API)
│   ├── (marketing)/      # Landing & onboarding routes
│   ├── app/              # Core authenticated/guest preparation app shell
│   │   ├── home/
│   │   ├── study/
│   │   ├── planner/
│   │   ├── progress/
│   │   ├── resources/
│   │   ├── mock-tests/
│   │   └── more/
│   ├── auth/             # Sign-in & registration placeholders
│   ├── exam/             # Exam selection & personalization flows
│   ├── legal/            # Terms & privacy disclosures
│   └── api/              # API routes (e.g. /api/health)
│
├── components/
│   ├── ui/               # Core accessible UI primitives (Button, Card, Dialog, etc.)
│   ├── navigation/       # AppHeader, DesktopSidebar, MobileBottomNav, PageContainer
│   └── shared/           # ThemeProvider, ThemeToggle, EmptyState, ErrorState
│
├── features/             # Feature modules (auth, exams, workspace, planner, etc.)
├── domain/               # Pure business models and domain rules (exam-agnostic)
├── db/                   # Database client, Drizzle schema, and migrations
│   ├── schema/           # Drizzle table definitions
│   ├── migrations/       # SQL migration outputs
│   └── index.ts          # Typed D1 Drizzle database client
│
├── lib/
│   ├── storage/          # StorageAdapter abstraction (browser/memory/cloud)
│   ├── validation/       # Zod schemas and validation rules
│   ├── cloudflare/       # Typed server-side Cloudflare environment bindings
│   └── utils/            # Utility helpers (cn, etc.)
│
├── config/               # Single-source configurations (brand, navigation)
├── hooks/                # Custom React hooks (media queries, responsive hooks)
└── types/                # Shared TypeScript definitions
```

---

## Available Scripts

| Command              | Purpose                                                           |
| :------------------- | :---------------------------------------------------------------- |
| `pnpm dev`           | Start local Next.js development server on `http://localhost:3000` |
| `pnpm build`         | Build production Next.js bundle                                   |
| `pnpm start`         | Start production Next.js server                                   |
| `pnpm vinext:dev`    | Run app using `vinext` Vite-based runtime                         |
| `pnpm vinext:build`  | Build app bundle using `vinext` for Cloudflare Workers            |
| `pnpm vinext:deploy` | Deploy directly to Cloudflare Workers with `@vinext/cloudflare`   |
| `pnpm typecheck`     | Run strict TypeScript compiler verification (`tsc --noEmit`)      |
| `pnpm lint`          | Run ESLint checks                                                 |
| `pnpm format:check`  | Verify formatting with Prettier                                   |
| `pnpm format:write`  | Auto-format files with Prettier                                   |
| `pnpm test`          | Run Vitest unit tests                                             |
| `pnpm test:watch`    | Run Vitest in watch mode                                          |
| `pnpm test:e2e`      | Run Playwright end-to-end smoke tests                             |
| `pnpm db:generate`   | Generate SQL migration from Drizzle schemas                       |
| `pnpm db:migrate`    | Apply migrations to Cloudflare D1 database                        |
| `pnpm db:studio`     | Launch Drizzle Studio database viewer                             |

---

## Local Development Workflow

### Prerequisites

- Node.js `v20+` or `v24+`
- `pnpm` (enabled via `corepack enable pnpm` or npm)

### Setup

1. Clone the repository and install dependencies:

   ```bash
   pnpm install
   ```

2. Copy the sample environment configuration:

   ```bash
   cp .env.example .env.local
   ```

3. Run the development server:

   ```bash
   pnpm dev
   ```

   Open `http://localhost:3000` in your browser.

4. Run tests:
   ```bash
   pnpm test
   pnpm typecheck
   pnpm lint
   ```

---

## Cloudflare Development & Deployment

The deployment pipeline is built Cloudflare-first:

```
Next.js App Router  ➔  vinext  ➔  Cloudflare Workers  ➔  Cloudflare D1
```

- **Wrangler Configuration**: Defined in [`wrangler.jsonc`](./wrangler.jsonc) with compatibility flags (`nodejs_compat`) and D1 database binding `DB`.
- **Database Client**: Instantiated via [`src/db/index.ts`](./src/db/index.ts) utilizing `drizzle-orm/d1`.
- **Environment Bindings**: Type-safe accessor [`src/lib/cloudflare/env.ts`](./src/lib/cloudflare/env.ts) prevents server bindings from leaking into client components.

To deploy to Cloudflare Workers:

```bash
pnpm vinext:deploy
```

---

## Storage & Guest Workspace Abstraction

Guest workspace state is governed by the [`StorageAdapter`](./src/lib/storage/types.ts) boundary. Components never touch raw `localStorage` or `IndexedDB` directly:

- `BrowserStorageAdapter`: Implements local browser persistence with namespace prefixing and error resilience.
- `MemoryStorageAdapter`: In-memory storage for SSR, Vitest unit testing, and fallback.
- Future phases will connect IndexedDB and Cloudflare sync behind this exact interface.

---

## Brand Configuration

Brand strings are strictly centralized in [`src/config/brand.ts`](./src/config/brand.ts). Rebranding or adjusting taglines requires changing one config object without code modifications across the application.
