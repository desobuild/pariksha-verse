# ParikshaVerse — Architecture Decisions (Phase 1: Foundation)

This document formalizes the architectural decisions established during Phase 1 of ParikshaVerse.

---

## 1. High-Level System Architecture

ParikshaVerse is designed as a **mobile-first preparation companion** deployed to Cloudflare Workers with serverless SQLite (Cloudflare D1), powered by Next.js and `vinext`.

```
Client Tier (Mobile PWA & Desktop Web)
   │
   │  HTTPS / Edge Network
   ▼
Cloudflare Workers Runtime (via vinext)
   ├── Next.js App Router (SSR, Streaming, API Handlers)
   ├── Server-Side Infrastructure Layer (`src/lib/cloudflare/`)
   │      └── Typed Bindings: `CloudflareEnv` (`env.DB`)
   │
   ▼
Data & Storage Tier
   ├── Edge Database: Cloudflare D1 via Drizzle ORM
   └── Client Storage: Abstracted `StorageAdapter` (Browser / Memory / future IndexedDB)
```

---

## 2. Core Architectural Decisions

### ADR 1: Cloudflare-First Edge Deployment

- **Decision**: Avoid Vercel-locked, AWS, or multi-cloud abstractions (Supabase, Firebase, Redis, PostgreSQL). The entire server footprint runs on Cloudflare Workers edge nodes.
- **Tooling**: Use `vinext` and `@vinext/cloudflare` as the Vite-based Next.js deployment adapter, generating worker bundles that mount directly to Cloudflare Workers with native D1 bindings.
- **Rationale**: Sub-10ms global edge latency for students across tier-1, tier-2, and tier-3 cities in India with minimal infrastructure costs.

### ADR 2: D1 Database + Drizzle ORM

- **Decision**: Use Cloudflare D1 with Drizzle ORM (`drizzle-orm/d1`).
- **Phase 1 Boundary**: No premature domain tables (users, syllabus, questions, mock tests) were created in Phase 1. Only a minimal `health_check` verification table was introduced to prove migration generation and driver execution.
- **Rationale**: Drizzle ORM generates zero-overhead SQL, maintains type-safety without code generation bloat, and provides seamless D1 integration.

### ADR 3: Server/Client Boundary & Binding Isolation

- **Decision**: Direct D1 bindings and worker environment references are strictly confined to server-side code (`src/lib/cloudflare/env.ts` and `src/db/index.ts`).
- **Rule**: Client components (`"use client"`) must never import or consume Cloudflare environment bindings directly. All data access occurs through Server Components or route handlers.

### ADR 4: Storage Abstraction for Guest Workspaces

- **Decision**: Implement a unified `StorageAdapter` interface (`getItem`, `setItem`, `removeItem`, `clear`, `getAllKeys`).
- **Implementations**:
  - `BrowserStorageAdapter`: Prefixed local browser storage with quota protection.
  - `MemoryStorageAdapter`: In-memory storage for SSR, Vitest unit testing, and fallback.
- **Rationale**: Students can begin studying immediately as guests without forced account creation. Future phases will swap the underlying engine to IndexedDB and encrypted Cloudflare sync without modifying any UI components.

### ADR 5: Single-Source Brand Configuration

- **Decision**: Hardcoded strings like "ParikshaVerse" are banned from UI templates and components. All brand strings, taglines, and descriptions reside in [`src/config/brand.ts`](../src/config/brand.ts).
- **Rationale**: Enables zero-friction rebranding, white-labeling, or localized product variations.

### ADR 6: Mobile-First Responsive App Shell

- **Decision**: Target viewport 390×844 (also 375×812, 430×932) with a sticky header and bottom navigation bar (Home, Study, Progress, Resources, More). Expand to a left sidebar on desktop (768px+).
- **Controls**: Minimum 44px touch targets on mobile with safe-area bottom inset preservation.

### ADR 7: Semantic Design Tokens & Deliberate Dark Mode

- **Decision**: Adopt the approved Stitch visual language:
  - Light: Tinted canvas (`#FAF8FF`), Surface (`#FFFFFF`), Primary (`#0051D5` / `#131B2E`), Border (`#E2E8F0`).
  - Dark: Deep night slate (`#0B0F17`), Surface (`#111827`), Primary (`#3B82F6`), Border (`#1E293B`).
  - System is the default mode, managed via `next-themes`.
- **Constraint**: No arbitrary colors, no gradients, no glassmorphism, no neon accents.

### ADR 8: Testing Strategy

- **Unit & Integration**: Vitest with React Testing Library + JSDOM for components, hooks, storage adapter, and D1 mock connectivity.
- **End-to-End**: Playwright with mobile viewport configurations (iPhone 12 / 390×844) and desktop Chrome.
