# Project Rules

> **CHARACTER LIMIT**: Max 40,000 chars. Validate with `wc -m CLAUDE.md` before commit.

---

## Last Change

**Branch:** refactor/remove-app-url-env
**Date:** 2026-01-30
**Summary:** Removed APP_URL environment variable. Magic link URL is now derived from request headers (host + x-forwarded-proto) instead of hardcoded env var. This makes the app work automatically across environments and respects reverse proxy configurations.

---

## 30 Seconds Overview

**Telegram Ads Management Dashboard** - A central control panel to manage advertising campaigns on Telegram groups for OnlyFans models and casino brands.

**Key Features:**
- Campaign management with scheduling and rotation
- Creative library with A/B testing
- Revenue tracking and deal management
- Analytics with performance metrics
- Spam controls and safety measures
- Audit logging for all actions
- Queue monitoring for background jobs
- Magic link authentication

---

## Stack

| Component  | Technology                 |
| ---------- | -------------------------- |
| Runtime    | Bun                        |
| Framework  | Next.js 15 + React 19      |
| Language   | TypeScript **strict mode** |
| API        | tRPC                       |
| Database   | MongoDB + Mongoose         |
| Queue      | BullMQ + Redis             |
| Bot        | grammY (Telegram)          |
| Auth       | Magic Link + HTTP-only     |
| UI         | shadcn/ui + Tailwind v4    |
| Charts     | Recharts                   |
| Testing    | Vitest + Playwright        |
| Container  | Docker Compose             |

---

## Architecture

```
project-root/
├── CLAUDE.md              # THIS FILE - project rules (40k char max)
├── .claude/               # Claude Code configuration
├── common/                # Shared across services
│   ├── db/                # MongoDB connection
│   ├── models/            # Mongoose schemas (14 models)
│   ├── queue/             # BullMQ setup
│   └── services/          # Auth, Email, Audit services
├── services/
│   ├── bot/               # Telegram Bot (grammY)
│   └── worker/            # BullMQ Workers
├── src/
│   ├── app/
│   │   ├── (auth)/        # Login/Verify pages
│   │   ├── (dashboard)/   # Protected dashboard pages (13 pages)
│   │   │   ├── page.tsx           # Overview
│   │   │   ├── groups/            # Telegram Groups
│   │   │   ├── campaigns/         # Campaign Manager
│   │   │   ├── creatives/         # Creative Library
│   │   │   ├── scheduling/        # Calendar + Rotation
│   │   │   ├── revenue/           # Deals + Revenue
│   │   │   ├── analytics/         # Performance
│   │   │   ├── models/            # OnlyFans Models
│   │   │   ├── casinos/           # Casino Brands
│   │   │   ├── spam-controls/     # Safety Controls
│   │   │   ├── reports/           # Exports
│   │   │   ├── audit-logs/        # Activity Logs
│   │   │   └── queue-monitor/     # Queue Status
│   │   └── api/trpc/      # tRPC API route
│   ├── components/
│   │   ├── ui/            # shadcn primitives
│   │   ├── layout/        # Sidebar, Header
│   │   └── shared/        # DataTable, StatsCard
│   ├── lib/trpc/          # tRPC client
│   └── server/trpc/       # tRPC routers (12 routers)
├── types/                 # TypeScript interfaces
└── docker-compose.yml     # Docker services
```

---

## Workflow (STRICT FLOW)

```
0. INIT TASK      →  Run commit-manager to REGISTER task start
1. TODO LIST      →  ALWAYS create detailed todo list from prompt
2. RESEARCH       →  Run research agent for NEW features (MANDATORY)
3. AUDIT          →  Check docs from last audit OR run fresh audit
4. BRANCH         →  Create feature/ | fix/ | refactor/ | test/
5. IMPLEMENT      →  Follow project rules + analyzer approval
6. DOCUMENT       →  Document ALL modified files (MANDATORY)
7. UPDATE         →  Update THIS FILE (CLAUDE.md) with session changes
8. QUALITY        →  Run typecheck && lint && test (Husky enforced)
9. VALIDATE       →  RUN: npx tsx .claude/hooks/stop-validator.ts (MANDATORY)
10. FINISH        →  Only after validator shows "ALL CHECKS PASSED"
```

> **CRITICAL:** Stop hook BLOCKS task completion if any validation fails.

---

## MANDATORY: Run Stop Validator Before Completing

> **YOU MUST run the stop-validator manually BEFORE attempting to complete ANY task.**

```bash
# RUN THIS COMMAND before saying "task complete" or finishing work:
npx tsx .claude/hooks/stop-validator.ts
```

### Why This Is Required

The stop hook runs automatically but Claude often ignores its output. **Running manually ensures you see and fix ALL issues.**

### Validation Workflow

```
1. Finish implementation
2. RUN: npx tsx .claude/hooks/stop-validator.ts
3. If issues found → Fix them ONE BY ONE
4. RUN validator again after EACH fix
5. Only complete task when output shows "ALL CHECKS PASSED"
```

### What It Validates

| Check | Requirement |
|-------|-------------|
| Branch | Must be on `main` (merged) |
| Git tree | Must be clean (committed) |
| CLAUDE.md | Must be updated with session changes |
| Documentation | All source files must be documented |
| Domains | Domain files must be updated |

> **IMPORTANT:** If validator shows issues, create a TODO list and fix them in order. Do NOT try to complete the task until ALL checks pass.

---

## Stop Hook Validations

The stop hook runs when Claude is about to finish and **BLOCKS** if:

| Validation    | Condition              | Action Required                                |
| ------------- | ---------------------- | ---------------------------------------------- |
| Branch        | NOT on main            | Merge branch to main, then `git checkout main` |
| Git Tree      | Uncommitted changes    | Commit, merge to main, sync remote             |
| CLAUDE.md     | Not updated            | Update Last Change (ANY file change triggers)  |
| CLAUDE.md     | Missing sections       | Add required sections                          |
| CLAUDE.md     | Exceeds 40k chars      | Compact the file                               |
| Documentation | Source files undoc     | Run documenter agent                           |

---

## CLAUDE.md Update Rules

> **NOT just Last Change - also document FLOW changes, architecture, and feature core.**

### When to Update CLAUDE.md

| Change Type | What to Update |
|-------------|----------------|
| Any file change | Last Change section (branch, date, summary) |
| New feature added | Add to 30s Overview, Architecture if needed |
| Flow changed | Update Workflow section or add new section |
| New pattern established | Add to relevant section (UI, API, etc.) |
| Gotcha discovered | Add to NRY or FORBIDDEN sections |
| New config added | Update Configuration section |

### Session Change Format (MANDATORY)

```
**Branch:** feature/example-feature
**Date:** YYYY-MM-DD
**Summary:** 1-2 sentences describing WHAT changed and WHY.
```

### Flow Documentation

When implementing features that change how the app works:

1. **Document the flow** in relevant section (or create new)
2. **Explain what each part does** (architecture impact)
3. **Record gotchas** in NRY/FORBIDDEN if discovered
4. **Update domain docs** via domain-updater agent

---

## Critical Rules

### HTTP Requests (MANDATORY)

| Rule | Implementation |
|------|----------------|
| Use axios ONLY | Never `fetch()` or raw `axios` |
| `withCredentials: true` | ALWAYS for cookies/sessions |
| Extend base instance | Create `lib/api/axios.ts` |
| Type responses | `api.get<User>('/users')` |
| Centralize errors | Use interceptors |

> **See `.claude/CLAUDE.md`** for full axios setup template.

### Path Aliases (MANDATORY)

| Alias      | Maps To             | Use For       |
| ---------- | ------------------- | ------------- |
| `$types/*` | `./types/*`         | Type defs     |
| `@common`  | `./common/index.ts` | Logger, utils |
| `@db`      | `./common/db/`      | DB connection |

> **NEVER** use `@types/` (reserved by TypeScript)

### Types Location

- **ALL** interfaces/types MUST be in `types/` folder
- **NEVER** define types in `src/` files
- **EXCEPTION:** Zod inferred types and Mongoose Documents

### TypeScript Strict

```typescript
process.env['VARIABLE']; // CORRECT (bracket notation)
source: 'listed' as const; // CORRECT (literal type)
```

---

## Quality Gates

```bash
bun run typecheck     # MUST pass
bun run lint          # MUST pass
bun run test          # MUST pass
docker compose build  # MUST pass
```

---

## Commit Format

```
[type]: [description]

- Detail 1
- Detail 2

Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>
```

Types: `feat`, `fix`, `refactor`, `docs`, `chore`

---

## FORBIDDEN Actions

| Action                         | Reason                       |
| ------------------------------ | ---------------------------- |
| Skip stop-validator            | MUST run `npx tsx .claude/hooks/stop-validator.ts` before completing |
| Write in non-English           | ALL code/docs MUST be in EN  |
| Skip typecheck                 | Catches runtime errors       |
| Relative imports (shared)      | Breaks when files move       |
| Use `@types/` alias            | Reserved by TypeScript       |
| Use `any` type                 | Defeats strict mode          |
| Skip docker build test         | May fail in production       |
| Define types in `src/`         | Must be in `types/`          |
| Skip research for new features | Leads to outdated patterns   |
| Skip todo list creation        | Loses track of tasks         |
| Make responsive UI only        | Must be separate UIs         |
| Commit directly to main        | Stop hook will BLOCK         |
| Skip documenter agent          | Stop hook will BLOCK         |
| Leave files undocumented       | Stop hook will BLOCK         |
| Finish on feature branch       | Stop hook will BLOCK         |
| Stack Last Change entries      | Keep only the LATEST         |
| Use Cards on mobile            | Waste space in flex-col      |
| Edit JSX without UI agents     | MUST run ui-mobile/tablet/desktop |
| Skip planning for features     | Use EnterPlanMode first      |
| Skip domain documentation      | MUST update domains/*.md     |
| Only update CLAUDE.md          | Domains are detail, CLAUDE.md is summary |
| Skip flow documentation        | Document architecture changes in CLAUDE.md |
| Use MUI/Chakra                 | Use shadcn/ui + Radix for personality control |
| Neumorphism on forms           | Accessibility issues, use Glassmorphism |
| Scroll animations on dashboard | Use only on landing/marketing pages |
| 3D elements on mobile          | Performance issues, use sparingly |
| Masonry grid on mobile         | Use vertical lists instead |
| Mix animation libraries        | Pick one primary (Framer or GSAP) |
| Wildcard icon imports          | Use named imports (`import { X } from 'lucide-react'`) |
| React Icons in production      | Use Lucide + Simple Icons directly |
| Files > 400 lines              | MUST split into smaller components |
| Page components in /components | Use `app/[page]/_components/` |
| Skip cn utility                | MUST use clsx + tailwind-merge |
| 'use client' at top level      | Push to leaf components only |
| Waterfall data fetching        | Use Promise.all() for parallel |
| Skip loading.tsx               | Add skeleton loaders for data pages |

---

## UI Architecture (MANDATORY)

> Web apps MUST have **separate UIs** for each platform, NOT just "responsive design".

| Platform          | Layout                                      |
| ----------------- | ------------------------------------------- |
| Mobile (375px)    | Full-screen modals, bottom nav, touch-first |
| Tablet (768px)    | Condensed dropdowns, hybrid nav             |
| Desktop (1280px+) | Sidebar left, top navbar with search        |

### JSX Editing = UI Agents (MANDATORY)

ANY task that edits `.tsx` or `.jsx` files MUST invoke UI agents:

```
ui-mobile + ui-tablet + ui-desktop (run in PARALLEL)
```

---

## UI/UX Design Rules

### Mobile FORBIDDEN Patterns

| Pattern | Problem | Use Instead |
|---------|---------|-------------|
| Cards in flex-col | Waste vertical space, poor scanning | Compact lists with dividers |
| Card grids | Too cramped, hard to tap | Full-width list items |
| Nested cards | Confusing hierarchy | Flat structure |
| Multiple CTAs per card | Touch confusion | Single primary action |

### Design Principles

| Platform | Density | Navigation | Actions |
|----------|---------|------------|---------|
| Mobile | LOW - space for touch | Bottom tab bar | Bottom sheet |
| Tablet | MEDIUM - hybrid | Side + top | Context menus |
| Desktop | HIGH - data dense | Fixed sidebar | Inline + hover |

### Component Choices

```
Mobile:   Lists > Cards, Sheets > Modals, Tabs > Dropdowns
Tablet:   Collapsible cards, Split views, Floating actions
Desktop:  Data tables, Multi-column forms, Keyboard shortcuts
```

---

## Design System Reference

> **Full docs in**: `.claude/skills/research-cache/cache/` (after research agent runs)

### Required Libraries

```bash
# Core utilities (MANDATORY)
bun add clsx tailwind-merge class-variance-authority
bun add -D tailwindcss-animate

# Animation & feedback
bun add @formkit/auto-animate framer-motion sonner

# Skeleton loaders
bun add react-loading-skeleton

# Copy-paste from: magicui.design, ui.aceternity.com, hover.dev
```

### The `cn` Utility (MANDATORY)

```typescript
// lib/utils.ts - MUST HAVE in every project
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

// Usage
<div className={cn('base', condition && 'conditional', userClassName)} />
```

---

## Icon Libraries (MANDATORY)

| Library | Use For | Icons | Import |
|---------|---------|-------|--------|
| **Lucide React** | UI icons (shadcn default) | 1,600+ | `import { Camera } from 'lucide-react'` |
| **Simple Icons** | Brand logos ONLY | 3,150+ | `import { SiReact } from '@icons-pack/react-simple-icons'` |
| **Heroicons** | Tailwind projects | 290+ | `import { BeakerIcon } from '@heroicons/react/24/outline'` |

### Icon Rules

```typescript
// ✅ CORRECT: Named imports (tree-shakable, ~1KB per icon)
import { Camera, User, Settings } from 'lucide-react';

// ❌ FORBIDDEN: Wildcard imports (bundles ALL icons, +30KB)
import * as Icons from 'lucide-react';
```

### Icon Styling

```tsx
<Camera size={24} />                           // Size prop
<User className="w-6 h-6 text-blue-500" />     // Tailwind classes
<Settings strokeWidth={1.5} />                 // Stroke width
<button aria-label="Take photo"><Camera /></button>  // Accessibility
```

---

## Aesthetic Libraries

| Library | Purpose | When |
|---------|---------|------|
| **clsx + tailwind-merge** | className management | ALWAYS |
| **class-variance-authority** | Component variants | Reusable components |
| **tailwindcss-animate** | Micro-interactions | Animations |
| **react-loading-skeleton** | Loading states | Data fetching |
| **Magic UI** | Animated components | Landing pages |

### CVA for Component Variants

```typescript
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva('rounded font-medium transition-colors', {
  variants: {
    variant: {
      default: 'bg-primary text-white hover:bg-primary/90',
      destructive: 'bg-red-500 text-white hover:bg-red-600',
      outline: 'border border-input bg-transparent hover:bg-accent',
    },
    size: {
      sm: 'h-8 px-3 text-sm',
      md: 'h-10 px-4',
      lg: 'h-12 px-6 text-lg',
    },
  },
  defaultVariants: { variant: 'default', size: 'md' },
});

type ButtonProps = VariantProps<typeof buttonVariants>;
```

---

## Component Organization (MANDATORY)

### File Structure

```
src/
├── app/
│   ├── (auth)/                    # Route group
│   │   ├── login/
│   │   │   ├── page.tsx
│   │   │   └── _components/       # Page-specific components
│   │   │       ├── login-form.tsx
│   │   │       └── social-buttons.tsx
│   │   └── layout.tsx
│   ├── dashboard/
│   │   ├── page.tsx
│   │   └── _components/           # Page-specific
│   └── layout.tsx                 # Root layout with providers
├── components/
│   ├── ui/                        # shadcn primitives (Button, Input, etc.)
│   ├── layout/                    # Header, Sidebar, Footer
│   └── shared/                    # Reusable across features
└── lib/
    └── utils.ts                   # cn utility
```

### Component Location Rules

| Question | Location |
|----------|----------|
| Used in ONE page only? | `app/[page]/_components/` |
| Used across 2+ features? | `components/shared/` |
| UI primitive (Button, Input)? | `components/ui/` |
| Layout element (Header, Footer)? | `components/layout/` |

### File Size Rules (MANDATORY)

| Lines | Action |
|-------|--------|
| < 200 | Keep in single file |
| 200-400 | Consider splitting |
| > 400 | **MUST split** into smaller components |

> **Rule:** When a file exceeds 200 lines, extract logical pieces into `_components/` folder.

### Naming Conventions

```
components/
├── ui/
│   ├── button.tsx          # kebab-case files
│   └── data-table.tsx
├── shared/
│   └── user-avatar.tsx
└── layout/
    └── main-header.tsx
```

---

## Next.js App Router Patterns (MANDATORY)

### Server vs Client Components

```tsx
// ✅ DEFAULT: Server Component (no directive needed)
export default async function Page({ params }) {
  const data = await fetch('...');  // Server-side fetch
  return <ClientButton data={data} />;  // Pass to client
}

// ✅ Client Component (push to leaves)
'use client';
export function ClientButton({ data }) {
  const [state, setState] = useState();
  return <button onClick={() => setState(!state)}>{data}</button>;
}
```

### When to Use 'use client'

| Need | Directive |
|------|-----------|
| useState, useEffect, useContext | `'use client'` |
| onClick, onChange, onSubmit | `'use client'` |
| Browser APIs (localStorage, window) | `'use client'` |
| Data fetching only | Server Component (default) |
| Static rendering | Server Component (default) |

> **Rule:** Keep `'use client'` at the LEAVES of component tree, not at the top.

### Layout Context Pattern (MANDATORY)

```tsx
// app/layout.tsx - Root layout with providers
import { Providers } from '@/components/providers';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

// components/providers.tsx
'use client';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';

export function Providers({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system">
        {children}
        <Toaster position="top-right" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
```

### Route Groups & Private Folders

```
app/
├── (marketing)/           # Route group (no URL impact)
│   ├── page.tsx           # / (home)
│   └── about/page.tsx     # /about
├── (app)/                 # Route group for authenticated
│   ├── dashboard/page.tsx # /dashboard
│   └── layout.tsx         # Shared app layout
├── _components/           # Private folder (NOT a route)
└── _lib/                  # Private folder (NOT a route)
```

### Parallel Data Fetching

```tsx
// ✅ CORRECT: Parallel fetches
export default async function Page() {
  const [user, posts, comments] = await Promise.all([
    getUser(),
    getPosts(),
    getComments(),
  ]);
  return <Dashboard user={user} posts={posts} comments={comments} />;
}

// ❌ AVOID: Waterfall (sequential)
export default async function Page() {
  const user = await getUser();
  const posts = await getPosts();  // Waits for user
  const comments = await getComments();  // Waits for posts
}
```

### Dynamic Imports (Heavy Components)

```tsx
import dynamic from 'next/dynamic';

// ✅ For modals, charts, admin panels
const HeavyChart = dynamic(() => import('@/components/charts/heavy-chart'), {
  loading: () => <Skeleton className="h-96" />,
  ssr: false,  // Client-only if needed
});

// ❌ DON'T dynamic import above-the-fold content (hurts LCP)
```

### Skeleton Loading Pattern

```tsx
// loading.tsx - Automatic loading UI
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
```

---

## Grid Layouts (Choose by Context)

| Grid Type | Use For | Mobile |
|-----------|---------|--------|
| **Bento Grid** | Landing, features, portfolios | Stacks vertically |
| **12-Column** | Dashboards, admin panels | Collapse to 1-2 cols |
| **Masonry** | Galleries, Pinterest-style | Use vertical list |
| **Card Grid** | Products, team, blog archive | Stack to single col |
| **Split Grid** | Hero sections, auth pages | Stack vertically |
| **Kanban** | Project management, tasks | Horizontal scroll |

---

## Modal/Dialog Patterns (Choose by Action)

| Modal Type | Use For | Mobile |
|------------|---------|--------|
| **Centered Dialog** | Confirmations, short forms | Full-screen |
| **Slide-over/Drawer** | Filters, settings, details | Bottom sheet |
| **Bottom Sheet** | Actions, sharing, quick forms | Native feel |
| **Command Palette** | CMD+K, power users | Full-screen |
| **Wizard/Stepper** | Multi-step forms, onboarding | Full-screen |
| **Lightbox** | Images, videos | Full-screen |

---

## List Patterns (Choose by Data)

| List Type | Use For | Key Feature |
|-----------|---------|-------------|
| **Simple List** | Basic items, settings | Dividers |
| **Avatar List** | Users, contacts | Profile images |
| **Expandable/Accordion** | FAQs, nested content | Collapse/expand |
| **Swipeable List** | Mobile actions | Left/right swipe |
| **Drag & Drop** | Reordering | dnd-kit (NOT react-beautiful-dnd) |
| **Virtualized** | 1000+ items | react-window or react-virtuoso |
| **Timeline** | Activity feed, history | Vertical line |
| **Chat/Messages** | Conversations | Bubbles left/right |

---

## Multi-Step Forms (MANDATORY for complex forms)

| Pattern | Use For | Progress |
|---------|---------|----------|
| **Horizontal Stepper** | Onboarding, checkout | Numbers at top |
| **Card-based Steps** | Settings, profiles | Expandable cards |
| **Slide Animation** | Typeform-style | Left/right slide |
| **Accordion Steps** | Long forms | Collapsible sections |

### Form Stack (MANDATORY)

```typescript
// react-hook-form + Zod + per-step validation
const { trigger } = useForm<FormData>({ resolver: zodResolver(schema) });

const nextStep = async () => {
  const isValid = await trigger(currentStepFields);
  if (!isValid) return;
  setStep(step + 1);
};
```

---

## Toast Notifications (MANDATORY: Sonner)

```typescript
// Install: pnpm dlx shadcn@latest add sonner
import { toast } from "sonner";

// Promise-based (loading → success/error)
toast.promise(saveData(), {
  loading: 'Saving...',
  success: 'Saved!',
  error: 'Failed to save',
});

// With action button
toast('File deleted', {
  action: { label: 'Undo', onClick: () => restoreFile() },
});
```

> **Duration**: 4s info, 7s+ errors. Max 3-5 visible toasts.

---

## Optimistic UI (MANDATORY for mutations)

> **ALWAYS show instant feedback, rollback on error.**

### Pattern 1: useOptimistic (React 19)

```typescript
const [optimisticItems, addOptimistic] = useOptimistic(
  items,
  (state, newItem) => [...state, { ...newItem, pending: true }]
);

async function addItem(data: ItemData) {
  addOptimistic(data);  // Instant UI update
  try {
    await api.post('/items', data);
  } catch {
    toast.error('Failed to add');
    // State auto-reverts
  }
}
```

### Pattern 2: TanStack Query

```typescript
useMutation({
  mutationFn: updateItem,
  onMutate: async (newData) => {
    await queryClient.cancelQueries({ queryKey: ['items'] });
    const previous = queryClient.getQueryData(['items']);
    queryClient.setQueryData(['items'], (old) =>
      old.map(item => item.id === newData.id ? { ...item, ...newData } : item)
    );
    return { previous };
  },
  onError: (err, vars, context) => {
    queryClient.setQueryData(['items'], context.previous); // Rollback
    toast.error('Update failed');
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: ['items'] }),
});
```

---

## Data Display Patterns

### Tables

| Style | Use For |
|-------|---------|
| **Striped rows** | Long lists, scanning |
| **Sticky header** | Scrollable data |
| **Expandable rows** | Details on demand |
| **Sortable columns** | Data comparison |
| **Virtualized** | 1000+ rows (TanStack Virtual) |

### Cards

| Style | Use For |
|-------|---------|
| **Stats/KPI Card** | Metrics with trends |
| **Product Card** | E-commerce listings |
| **Profile Card** | User information |
| **Interactive Card** | Hover effects, animations |

---

## Navigation Patterns

| Type | Desktop | Mobile |
|------|---------|--------|
| **Header** | Fixed top navbar | Hamburger menu |
| **Sidebar** | Fixed left, collapsible | Overlay drawer |
| **Tabs** | Horizontal tabs | Bottom tab bar |
| **Breadcrumbs** | Path navigation | Simplified |

---

## Animation Libraries

| Library | Use When | Bundle |
|---------|----------|--------|
| **AutoAnimate** | 90% of UI (lists, tabs, dropdowns) | Minimal |
| **Framer Motion** | Page transitions, gestures, layouts | 32KB |
| **GSAP** | Scroll-driven, complex timelines | 23KB |
| **Magic UI** | Landing pages, marketing | Copy-paste |
| **Aceternity UI** | Portfolios, 3D effects | Copy-paste |

---

## Design Trends (2025)

| Trend | Use For | Avoid |
|-------|---------|-------|
| **Glassmorphism** | Modals, overlays, dark mode | Light backgrounds |
| **Minimalism** | Mobile, SaaS, accessibility | Marketing sites |
| **Bold Typography** | Landing hero, brands | Data dashboards |

---

## Mandatory Planning

> **ALWAYS use `EnterPlanMode` for non-trivial tasks BEFORE implementing.**

### When to Plan

| Task Type | Plan Required |
|-----------|---------------|
| New feature | YES |
| UI changes (any JSX) | YES |
| Multi-file changes | YES |
| Bug fix (simple) | NO |
| Single-line fix | NO |

### Plan Format

```
1. Analyze current state
2. Identify affected files
3. Design approach (with alternatives)
4. Get user approval
5. THEN implement
```

---

## MCP Servers

| Server                | Purpose                 | When to Use                          |
| --------------------- | ----------------------- | ------------------------------------ |
| `context7`            | Library documentation   | Before implementing with ANY library |
| `sequential-thinking` | Complex problem-solving | Multi-step tasks, planning           |
| `memory`              | Persistent knowledge    | Store/recall project patterns        |
| `playwright`          | Browser automation      | UI testing, page verification        |

---

## Agent System

82 specialized agents in 14 categories. Key agents:

| Agent            | Purpose                                                |
| ---------------- | ------------------------------------------------------ |
| orchestrator     | Coordinates development flow                           |
| research-web     | Researches best practices (MANDATORY for new features) |
| documenter       | Maps files to domains, tracks what exists where        |
| domain-updater   | Records problems, solutions, learnings in domains      |
| security-auditor | Audits security (CAN VETO)                             |
| final-validator  | Last check before commit (CAN VETO)                    |
| commit-manager   | Manages commits and merges to main                     |

---

## Domain Documentation

> Domain docs prevent Claude from re-exploring the codebase every session.

### Location

```
.claude/skills/codebase-knowledge/domains/
├── authentication.md
├── api.md
├── ui-components.md
└── ...
```

### Domain Mapping (domain-mapping.json)

| Domain | File Patterns |
|--------|---------------|
| authentication | `**/auth/**`, `**/*auth*.ts` |
| api | `**/api/**`, `**/routers/**` |
| database | `**/models/**`, `**/*.model.ts` |
| ui-components | `**/components/**/*.tsx` |
| pages | `**/app/**/page.tsx` |

### Documentation Agents

| Agent | Role | When |
|-------|------|------|
| **documenter** | Maps files to domains, creates/updates domain files | AFTER implementation |
| **domain-updater** | Records problems, solutions, gotchas | BEFORE commit |

### Domain File Sections

Every domain file MUST have:
- **Last Update** - Date, commit, summary
- **Files** - All files in this domain
- **Connections** - Links to other domains
- **Recent Commits** - Commit history
- **Attention Points** - Gotchas and rules

---

## NRY (Never Repeat Yourself)

Common Claude mistakes to avoid:

- Multi-line bash with `\` continuations (breaks permissions)
- Relative paths in permission patterns
- Executing agent logic manually (use Task tool)
- Using bash for file operations (use Read/Write/Edit)
- Ignoring context size (use `/compact`)

---

## Configuration

Project-specific settings in `.claude/config/`:

- `project-config.json` - Stack, structure, commands
- `domain-mapping.json` - File-to-domain mapping
- `quality-gates.json` - Quality check commands
- `testing-config.json` - Test framework config
- `security-rules.json` - Security audit rules

---

## Setup by start-vibing

This project was set up with `npx start-vibing`.
For updates: `npx start-vibing --force`
