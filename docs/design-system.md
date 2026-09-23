# ParikshaVerse Design System & Core App Shell Specification

This document defines the visual design system, typography hierarchy, semantic design tokens, reusable UI primitives, application shell architecture, responsive layout rules, and accessibility standards for ParikshaVerse.

---

## 1. Product Design Direction & Aesthetics

ParikshaVerse is designed as a **modern, focused study and productivity companion** for competitive examinations in India.

### Core Principles
- **Calm & Minimal**: Reduces cognitive load during intense study sessions.
- **Modern Productivity**: Feels like Linear, Notion, or Raycast rather than a traditional coaching portal or educational textbook.
- **Generous Whitespace & Predictable Rhythm**: Clear visual hierarchy without artificial clutter.
- **Subtle Borders & Minimal Shadows**: Crisp separation using 1px borders; no oversized drop shadows or neon glows.
- **Restrained Blue Primary Accent**: Trustworthy, energetic, and accessible on both light and dark backgrounds.
- **Mobile-First Responsive Behavior**: Full feature parity and ergonomics on smartphones with 44px+ touch targets and safe-area insets.

---

## 2. Typography System

The design system eliminates all editorial/serif styling in favor of a clean, modern sans-serif stack.

### Font Family
- **Primary Sans-Serif**: `Inter` via `next/font/google` (`var(--font-sans)`), with fallback to system UI fonts:
  `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
- **Zero Runtime Dependency**: Next.js downloads and self-hosts font binaries at build time, ensuring 100% offline functionality in PWA mode and privacy compliance.

### Hierarchy Scale

| Token / Class | Font Size / Line Height | Weight | Tracking | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Display** (`.type-display`) | `text-3xl sm:text-4xl` (`30px / 36px`) | Bold (700) | Tight (`-0.025em`) | Hero & Welcome headlines |
| **H1** (`.type-h1`) | `text-2xl sm:text-3xl` (`24px / 30px`) | Bold (700) | Tight (`-0.02em`) | Page titles & Main sections |
| **H2** (`.type-h2`) | `text-xl sm:text-2xl` (`20px / 24px`) | Semi-bold (600) | Tight (`-0.015em`) | Section headings |
| **H3** (`.type-h3`) | `text-lg sm:text-xl` (`18px / 20px`) | Semi-bold (600) | Normal | Card titles & Subsections |
| **H4** (`.type-h4`) | `text-base` (`16px / 24px`) | Semi-bold (600) | Normal | Group headers & Sub-cards |
| **Body Large** (`.type-body-large`) | `text-base` (`16px / 24px`) | Normal (400) | Normal | Introductions & Lead copy |
| **Body** (`.type-body`) | `text-sm` (`14px / 20px`) | Normal (400) | Normal | Primary reading text & Descriptions |
| **Body Small** (`.type-body-small`) | `text-xs` (`12px / 16px`) | Normal (400) | Normal | Secondary text & Help notes |
| **Label** (`.type-label`) | `text-sm` (`14px / 14px`) | Medium (500) | Normal | Form labels & Inputs |
| **Caption** (`.type-caption`) | `text-xs` (`12px / 16px`) | Normal (400) | Normal | Footnotes, timestamps, meta info |
| **Button** (`.type-button`) | `text-sm` (`14px / 14px`) | Medium (500) | Normal | Button action labels |
| **Navigation** (`.type-nav`) | `text-xs sm:text-sm` (`11px / 14px`) | Medium / Semi-bold | Tight | Bottom nav & Sidebar items |

---

## 3. Semantic Design Tokens

Components consume semantic color tokens rather than raw palette colors.

### Token Definitions

| Token | Light Theme (HSL) | Dark Theme (HSL) | Purpose |
| :--- | :--- | :--- | :--- |
| `background` | `220 20% 98%` (`#F8F9FA`) | `222 47% 8%` (`#0B111E`) | Main page canvas |
| `foreground` | `222 47% 11%` (`#0F172A`) | `210 40% 98%` (`#F8FAFC`) | High-contrast primary text |
| `surface` | `0 0% 100%` (`#FFFFFF`) | `222 40% 12%` (`#121A2B`) | Standard container & card surface |
| `surface-elevated`| `0 0% 100%` (`#FFFFFF`) | `222 36% 15%` (`#18233A`) | Floating panels, modals, dropdowns |
| `surface-muted` | `210 25% 96%` (`#F1F5F9`) | `222 35% 14%` (`#162035`) | Inactive areas & nested containers |
| `border` | `214 20% 89%` (`#E2E8F0`) | `217 24% 18%` (`#222C3C`) | Primary component borders |
| `border-subtle` | `214 20% 94%` (`#EEF2F6`) | `217 24% 14%` (`#1A2230`) | Secondary subtle dividers |
| `primary` | `221 83% 53%` (`#2563EB`) | `217 91% 60%` (`#3B82F6`) | Interactive accent & brand focus |
| `primary-hover` | `221 83% 45%` (`#1D4ED8`) | `217 91% 52%` (`#2563EB`) | Button hover state |
| `secondary` | `210 20% 94%` (`#EEF2F6`) | `217 24% 18%` (`#222C3C`) | Secondary button & badge fills |
| `muted` | `210 20% 95%` (`#F0F3F7`) | `222 35% 15%` (`#182236`) | Soft backgrounds & disabled states |
| `muted-foreground`| `215 16% 46%` (`#64748B`) | `215 20% 65%` (`#94A3B8`) | Supporting descriptions & captions |
| `success` | `142 71% 36%` (`#16A34A`) | `142 69% 46%` (`#22C55E`) | Verified, completed, passing states |
| `warning` | `38 92% 48%` (`#EAB308`) | `38 92% 54%` (`#FACC15`) | Pending, provisional, warning states |
| `destructive` | `0 72% 51%` (`#DC2626`) | `0 74% 50%` (`#EF4444`) | Error states, dangerous actions |
| `info` | `199 89% 48%` (`#0284C7`) | `199 89% 56%` (`#38BDF8`) | Informational badges & callouts |
| `ring` | `221 83% 53%` | `217 91% 60%` | Focus-visible accessibility ring |

---

## 4. Theme System (Light / Dark / System)

- **Engine**: Powered by `next-themes` via `ThemeProvider`.
- **Default**: System theme (follows user OS preference `prefers-color-scheme`).
- **Persistence**: Persisted in `localStorage` under key `theme`.
- **Toggle**: `ThemeToggle` component cyclically toggles `system` -> `light` -> `dark`.
- **Visual Feel**:
  - *Light Mode*: Warm, off-white calm canvas with crisp pure white card surfaces and dark slate typography.
  - *Dark Mode*: Deep midnight/navy background (`#0B111E`), slightly lighter card surfaces (`#121A2B`), and high-readability text (`#F8FAFC`). Not pitch black; reduces glare.

---

## 5. Spacing, Radius, and Shadow Scales

### Spacing Scale
Uses standard 4px increments:
- `p-1` (4px), `p-2` (8px), `p-3` (12px), `p-4` (16px), `p-5` (20px), `p-6` (24px), `p-8` (32px), `p-12` (48px).

### Radius Scale
- `sm` (`rounded-sm` / `rounded-md`): 6px-8px (`calc(var(--radius) - 4px)`) — Badges, small tags.
- `md` (`rounded-lg`): 10px (`calc(var(--radius) - 2px)`) — Form inputs, select triggers, buttons.
- `lg` (`rounded-xl`): 12px (`var(--radius)`) — Cards, sheets, dialog modals.
- `xl` (`rounded-2xl`): 16px (`calc(var(--radius) + 4px)`) — Brand marks, major outer containers.
- `pill` (`rounded-full`): 9999px — Status pills and circular avatars.

### Shadow Scale
- `shadow-subtle`: `0 1px 2px 0 rgba(0, 0, 0, 0.04)` — Buttons, cards, header borders.
- `shadow-card`: `0 1px 3px 0 rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.04)` — Elevated cards.
- `shadow-elevated`: `0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)` — Dropdowns and dialogs.

---

## 6. UI Primitives & Form Controls

### Button System (`src/components/ui/button.tsx`)
- **Variants**: `default` (Primary), `secondary`, `outline`, `ghost`, `destructive`, `link`.
- **Sizes**:
  - `default`: `h-11 px-4 py-2 min-h-[44px] min-w-[44px]` (44px mobile touch target).
  - `sm`: `h-9 px-3 text-xs min-h-[36px]`.
  - `lg`: `h-12 px-8 text-base min-h-[48px]`.
  - `icon`: `h-11 w-11 min-h-[44px] min-w-[44px] p-0`.
- **Features**:
  - `loading?: boolean`: Displays animated `Loader2` spinner, disables button, sets `aria-busy="true"`.
  - `asChild?: boolean`: Renders `Slot` component for accessible `<Link>` wrappers.
  - Interactive states: Default, `:hover`, `:active` (`scale-[0.99]`), `:focus-visible` (`ring-2 ring-ring`).

### Form Controls (`src/components/ui/`)
- **Input** (`input.tsx`): 44px default height (`h-11`), rounded-xl, subtle border, error state (`error?: boolean`, `aria-invalid="true"`, `border-destructive`).
- **Textarea** (`textarea.tsx`): Min-height 96px, rounded-xl, subtle border, error state (`error?: boolean`, `aria-invalid="true"`).
- **Form Group & Helpers** (`form.tsx`):
  - `FormGroup`: Vertical spacing (`space-y-1.5`).
  - `FormLabel`: Standardized typography with optional `required` asterisk indicator.
  - `FormDescription`: Helpful microcopy (`text-xs text-muted-foreground`).
  - `FormError` / `FormMessage`: Semantic error callout with `AlertCircle` icon and `role="alert"`.
- **Select** (`select.tsx`): Radix-based accessible dropdown with matching height and focus rings.
- **Checkbox** (`checkbox.tsx`) & **Switch** (`switch.tsx`): 44px touch-accessible targets, animated state changes.

### Card & Surface System (`src/components/ui/card.tsx`)
- **Surface Variants**:
  - `base` (default): `bg-surface border-border shadow-subtle`
  - `elevated`: `bg-surface-elevated border-border shadow-card`
  - `interactive`: `bg-surface border-border hover:border-primary/40 hover:bg-surface-elevated/90 transition-all cursor-pointer`
  - `muted`: `bg-surface-muted border-border-subtle`
- **Sub-components**: `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`.

### Badge / Status System (`src/components/ui/badge.tsx`)
- **Semantic Variants**: `default` (primary solid), `primary` (subtle tint), `secondary`, `neutral`, `success`, `warning`, `destructive`, `info`, `outline`.
- **Accessible Communication**: Supports `icon?: React.ReactNode` so meaning does not rely solely on color.

---

## 7. Navigation & App Shell Architecture

### App Header (`src/components/navigation/app-header.tsx`)
- Sticky top banner (`h-14 bg-surface border-b border-border shadow-subtle`).
- Brand Mark (`PV`) and title link to `/app/home`.
- Dynamic Active Exam Indicator (`resolveActiveExamAttempt()` -> `NEET 2027` provisional; never hardcoded `NEET 2026`).
- Account status (email badge for authenticated, `Guest Mode` badge for guests).
- Compact action buttons (`Sign Out` / `Sign In`) with `shrink-0` to prevent layout collision on mobile.
- `ThemeToggle` integration.

### Desktop Sidebar (`src/components/navigation/desktop-sidebar.tsx`)
- Fixed 256px (`w-64`) left sidebar visible on `md:` breakpoints (768px+).
- 7 Core Navigation Items: Home, Study, Planner, Mock Tests, Progress, Resources, More.
- **Visually Quiet Active State**: `bg-primary/10 text-primary font-semibold border-l-2 border-primary pl-2.5` (replaces harsh solid saturated backgrounds).
- Clean footer with brand name and tagline.

### Mobile Bottom Navigation (`src/components/navigation/mobile-bottom-nav.tsx`)
- Fixed bottom dock on mobile (`md:hidden`).
- 5 Core Navigation Items: Home, Study, Progress, Resources, More.
- Safe-area aware (`safe-area-bottom`).
- 44px+ touch targets (`min-h-[44px]`).
- Clear icon stroke and label weighting for active state (`aria-current="page"`).

### Page Container & Page Header (`src/components/navigation/`)
- `PageContainer`: Responsive horizontal padding (`px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 md:pb-8`). Mobile bottom padding (`pb-24`) ensures page content is never covered by the mobile bottom navigation bar.
- `PageHeader`: Supports `eyebrow` (e.g. `Overview`, `Curriculum`, `Schedule`), `title` (`h1`), `description`, `badge`, and `action` slot with responsive stacking.

---

## 8. Responsive Breakpoints

| Breakpoint | Width Range | Layout Behavior |
| :--- | :--- | :--- |
| **Mobile Compact** | `375px - 389px` (iPhone SE/mini) | Single column, mobile bottom nav, truncated header pills |
| **Mobile Standard** | `390px - 429px` (iPhone 12/13/14) | Standard mobile bottom nav, comfortable button targets |
| **Mobile Large** | `430px - 767px` (iPhone Pro Max) | Generous card widths, full mobile bottom nav |
| **Tablet** | `768px - 1023px` (iPad, Small laptops) | Desktop sidebar reveals, mobile bottom nav hides |
| **Desktop** | `1024px - 1279px` | Multi-column grid (2-3 columns), max-w container |
| **Desktop Wide** | `1280px+` | Full 3-column layout, generous whitespace |

---

## 9. Accessibility Foundations (WCAG AA)

- **Semantic HTML**: Full use of `<header>`, `<nav>`, `<aside>`, `<main>`, `<h1>`-`<h4>`, and `<button>`.
- **Focus Rings**: Universal `:focus-visible` styling (`ring-2 ring-ring ring-offset-2 ring-offset-background`).
- **Touch Targets**: All mobile interactive elements maintain minimum 44px × 44px touch targets.
- **Contrast**: Light and dark foregrounds meet WCAG AA contrast standards (> 4.5:1 for body copy).
- **Reduced Motion**: Respects `prefers-reduced-motion: reduce` by zeroing transition and animation durations.
- **Multi-modal Status**: Badges, alerts, and forms include text and icons rather than communicating status via color alone.
- **ARIA Attributes**: `aria-current="page"`, `aria-busy="true"`, `aria-invalid="true"`, and `role="alert"`.

---

## 10. Phase 4.5 Stitch Alignment Addendum

The approved Stitch designs (`design/screens/`) define the visual source of truth. The token layer was re-tuned to their Material-3-style periwinkle palette; component styles follow.

### Re-tuned tokens (see `src/app/globals.css`)

- `background` `#FAF8FF`, `foreground` `#131B2E`, `muted-foreground` `#444651`
- `primary` `#0051D5` (hover darker); `secondary`/chips `#EAEDFF` with on-tint text `#00236F`
- Borders are soft lavender hairlines: `border` `#DBE1FF`, `border-subtle` `#EAEDFF`
- Success is the Stitch teal family (`#004942` light / `#6BD8CB` dark); destructive `#BA1A1A`; info `#316BF3`
- **New semantic tokens**: `--surface-tint` (`#EAEDFF`), `--surface-tint-strong` (`#E2E7FF`) for icon tiles / chips / tinted fills, and `--foreground-subtle` (`#757682`) for tertiary captions. Dark counterparts follow the same surface relationships (deep periwinkle-navy surfaces, lightened primary with dark on-color text).

### Component updates

- **Button**: pill radius (`rounded-full`); `lg` is a 52px Stitch CTA.
- **Card**: `rounded-2xl` with soft `shadow-card` and a hairline border (designs separate with shadow on the lavender canvas).
- **Badge**: pill chips; `primary` variant is a tint chip (`bg-surface-tint text-primary`).
- **New shared primitives**: `SectionHeader` (title + trailing action pattern), `IconTile` (rounded tinted icon squares; `tint|strong|solid|outline` Ã— `sm|md|lg`), `BrandMark` (renders the approved ParikshaVerse Icon from `/icon.svg`).
- **Navigation**: header exam target is a navy pill (`bg-foreground text-background`); sidebar active item is a tinted chip; mobile bottom nav shows a small primary indicator bar on the active tab. All remain â‰¥44px targets with `aria-current` and focus rings.

