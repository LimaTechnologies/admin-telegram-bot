# Research: Dashboard Detail Pages vs Modals for Entity Editing (2025-2026)

## Metadata

- **Date:** 2026-02-11
- **Researcher:** research-web agent
- **Freshness:** fresh
- **Stack:** Next.js 15, React Hook Form, Zod, shadcn/ui

## Problem Statement

When building admin dashboards with complex entity editing (e.g., OnlyFans models with info, photos, products), should we use modals or dedicated detail pages? What are the best patterns for 2025-2026 considering UX, SEO, and maintainability?

## Search Queries

1. "Next.js 15 App Router detail pages vs modals editing 2025 2026 best practices"
2. "admin dashboard UX entity detail pages nested routes 2025"
3. "react-hook-form Zod complex forms detail pages tab layout 2026"
4. "Next.js parallel routes intercepting routes modals 2025 patterns"
5. "dashboard entity editing UX patterns back navigation 2026"

## Key Findings

### Finding 1: When to Use Modals vs Detail Pages

**Source:** https://nextjs.org/docs/app/api-reference/file-conventions/intercepting-routes
**Date:** 2026-02-09 (Next.js 16.1.6 docs)
**Relevance:** HIGH

**Use Modals (Intercepting Routes) For:**
- Quick previews or confirmations
- Simple forms (1-3 fields)
- Actions that preserve context (e.g., viewing photo from feed)
- When shareable URLs AND context preservation are both needed

**Use Dedicated Detail Pages For:**
- Complex entities with multiple sections (5+ fields)
- Forms requiring tab-based layouts
- Multi-step workflows
- Heavy content that needs SEO optimization
- When users need deep focus without distractions

**Hybrid Pattern (Best Practice):**
Next.js 15+ supports intercepting routes + parallel routes to get BOTH:
- Soft-navigate (client-side): Shows modal overlay
- Hard-navigate (direct URL/refresh): Shows full detail page

**Code Example:**

```typescript
// File structure for hybrid pattern
app/
├── @modal/                       // Parallel route slot
│   └── (.)models/               // Intercept models route
│       └── [id]/
│           └── page.tsx         // Modal view (lightweight)
├── models/
│   ├── page.tsx                 // List view
│   └── [id]/
│       └── page.tsx             // Full detail page (SEO-optimized)
└── layout.tsx                   // Renders {children} + {modal}
```

**Applies When:**
- Using Next.js 15+ (version 14 has issues with interceptors + dynamic routes)
- Entity has both "quick view" and "detailed edit" requirements
- Need URL shareability without losing list context

### Finding 2: Admin Dashboard UX Best Practices (2025)

**Source:** https://medium.com/@CarlosSmith24/admin-dashboard-ui-ux-best-practices-for-2025-8bdc6090c57d
**Date:** 2025
**Relevance:** HIGH

**Strategic Information Hierarchy:**
- "Inverted pyramid" approach: critical KPIs at top
- Drill-down capabilities for granular details
- Users should grasp key insights within seconds

**Progressive Disclosure:**
- Show essential options initially
- Reveal advanced features only when needed
- Keeps interface clean without sacrificing power

**For Entity Detail Pages:**
- Primary info (name, status, key metrics) above the fold
- Secondary details (photos, products, history) in tabs below
- Advanced settings in expandable sections

**Navigation Patterns:**
- Fixed sidebar OR top nav bar (users always know location)
- Breadcrumbs for retracing steps (MANDATORY for nested routes)
- Minimal dropdowns/nested items
- Bottom nav on mobile, sidebar on desktop

**Applies When:**
- Building admin dashboards with complex data
- Users need context + drill-down capabilities
- Multi-level navigation required

### Finding 3: Next.js 15 Nested Routes Pattern

**Source:** https://nextjs.org/learn/dashboard-app/creating-layouts-and-pages
**Date:** 2025
**Relevance:** HIGH

**Nested Route Structure:**

```typescript
// URL: /models/123/products/456
app/
└── models/
    └── [id]/
        ├── page.tsx              // /models/123
        ├── layout.tsx            // Shared layout for model pages
        └── products/
            └── [productId]/
                └── page.tsx      // /models/123/products/456
```

**Key Benefit:**
"Only the page components update while the layout won't re-render. This is called partial rendering which preserves client-side React state in the layout when transitioning between pages."

**Best Practices:**
- Use layouts to persist state across nested navigation
- Breadcrumbs automatically built from route segments
- Each nested level can have loading.tsx for skeleton states

**Applies When:**
- Entity has sub-entities (model → products, model → purchases)
- Need persistent UI elements across sub-pages
- Want to preserve form state during navigation

### Finding 4: React Hook Form + Zod for Complex Forms

**Source:** https://blog.logrocket.com/building-reusable-multi-step-form-react-hook-form-zod/
**Date:** 2024-2025
**Relevance:** HIGH

**Pattern for Tab-Based Detail Pages:**

```typescript
// Define schemas per section (tab)
const basicInfoSchema = z.object({
  name: z.string().min(1),
  username: z.string().min(1),
  tier: z.enum(['standard', 'premium']),
});

const photosSchema = z.object({
  previewPhotos: z.array(z.string().url()).max(4),
});

const productsSchema = z.object({
  products: z.array(z.object({
    type: z.enum(['content', 'subscription']),
    price: z.number().positive(),
  })),
});

// Combine for full validation
const modelSchema = z.object({
  ...basicInfoSchema.shape,
  ...photosSchema.shape,
  ...productsSchema.shape,
});

// Form setup
const form = useForm<ModelFormData>({
  resolver: zodResolver(modelSchema),
  mode: 'onChange', // Real-time validation
  defaultValues: existingModel || defaultValues,
});

// Validate specific section before tab change
const validateTab = async (fields: string[]) => {
  const isValid = await form.trigger(fields);
  if (!isValid) {
    toast.error('Please fix errors before switching tabs');
    return false;
  }
  return true;
};
```

**Key Patterns:**
- Define schemas per section for granular validation
- Use `trigger()` to validate specific fields before tab navigation
- Set `mode: 'onChange'` for real-time feedback
- Use `defaultValues` to populate existing entity data

**Applies When:**
- Entity has 5+ sections/tabs
- Need per-section validation before navigation
- Form has complex nested data structures

### Finding 5: Back Navigation & Breadcrumbs

**Source:** https://docs.medusajs.com/learn/fundamentals/admin/ui-routes
**Date:** 2025
**Relevance:** MEDIUM

**Breadcrumb Pattern:**

```typescript
// Automatic breadcrumbs from route hierarchy
/models → Models
/models/123 → Models / Model Name
/models/123/products → Models / Model Name / Products
/models/123/products/456 → Models / Model Name / Products / Product Name

// Implementation
import { usePathname } from 'next/navigation';

function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  return (
    <nav className="flex" aria-label="Breadcrumb">
      {segments.map((segment, index) => {
        const href = `/${segments.slice(0, index + 1).join('/')}`;
        const isLast = index === segments.length - 1;

        return (
          <div key={href} className="flex items-center">
            {index > 0 && <span className="mx-2">/</span>}
            {isLast ? (
              <span className="text-gray-500">{segment}</span>
            ) : (
              <Link href={href}>{segment}</Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
```

**Router.back() for Modals:**

```typescript
'use client';
import { useRouter } from 'next/navigation';

function ModalHeader() {
  const router = useRouter();

  return (
    <button onClick={() => router.back()}>
      Close
    </button>
  );
}
```

**Applies When:**
- Multi-level nested routes
- Users need context of where they are
- Modal overlays that need proper close behavior

### Finding 6: Tab-Based Layout Pattern

**Source:** Multiple sources + common practice
**Date:** 2025-2026
**Relevance:** HIGH

**Implementation Pattern:**

```typescript
// app/models/[id]/layout.tsx
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ModelLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  return (
    <div className="space-y-6">
      {/* Header with breadcrumbs */}
      <Breadcrumbs />

      {/* Tab navigation */}
      <Tabs defaultValue="info" className="w-full">
        <TabsList>
          <TabsTrigger value="info" asChild>
            <Link href={`/models/${params.id}`}>Info</Link>
          </TabsTrigger>
          <TabsTrigger value="photos" asChild>
            <Link href={`/models/${params.id}/photos`}>Photos</Link>
          </TabsTrigger>
          <TabsTrigger value="products" asChild>
            <Link href={`/models/${params.id}/products`}>Products</Link>
          </TabsTrigger>
          <TabsTrigger value="purchases" asChild>
            <Link href={`/models/${params.id}/purchases`}>Purchases</Link>
          </TabsTrigger>
        </TabsList>

        {/* Tab content */}
        <div className="mt-6">
          {children}
        </div>
      </Tabs>
    </div>
  );
}

// app/models/[id]/page.tsx (Info tab - default)
export default function ModelInfoPage({ params }) {
  return <ModelInfoForm modelId={params.id} />;
}

// app/models/[id]/photos/page.tsx
export default function ModelPhotosPage({ params }) {
  return <ModelPhotosManager modelId={params.id} />;
}
```

**Benefits:**
- Each tab is a separate route (shareable URLs)
- Layout persists, only content changes
- Browser back/forward works correctly
- Can preload adjacent tabs

**Applies When:**
- Entity has 4+ distinct sections
- Each section needs its own URL
- Users frequently switch between sections

### Finding 7: Intercepting Routes - Version & Gotchas

**Source:** https://medium.com/@bashaus/using-modals-in-next-js-with-parallel-routes-slots-route-groups-and-interceptors-0873e173c96d
**Date:** 2025
**Relevance:** HIGH

**CRITICAL VERSION REQUIREMENT:**
"I recommend using at least Next 15, as some issues were found in version 14 when interlacing interceptors with dynamic routes."

**Known Issues:**
1. **Modal Stacking:** If you link from one modal to another, the first modal remains on screen
2. **Layout Re-render Bug:** When navigating back to parent URL, modal stays visible (layout doesn't re-render)
3. **File Structure Sensitivity:** When adding/removing slots or interceptors, MUST restart dev server

**Workaround for Layout Bug:**

```typescript
// app/@modal/(.)models/[id]/page.tsx
'use client';
import { usePathname } from 'next/navigation';

export default function ModelModal({ params }) {
  const pathname = usePathname();

  // Only show modal if we're actually on the model route
  if (pathname !== `/models/${params.id}`) {
    return null;
  }

  return <Modal>...</Modal>;
}
```

**Applies When:**
- Using Next.js 15+ for intercepting routes
- Building modals with parallel routes
- Need to debug modal display issues

### Finding 8: Optimistic UI for Mutations

**Source:** https://practicaldev.online/blog/reactjs/react-hook-form-zod-validation-guide
**Date:** 2026
**Relevance:** MEDIUM

**Pattern for Detail Page Updates:**

```typescript
// Using TanStack Query for optimistic updates
const updateModel = useMutation({
  mutationFn: (data: UpdateModelInput) =>
    api.patch(`/models/${modelId}`, data),

  onMutate: async (newData) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['models', modelId] });

    // Snapshot previous value
    const previous = queryClient.getQueryData(['models', modelId]);

    // Optimistically update cache
    queryClient.setQueryData(['models', modelId], (old: Model) => ({
      ...old,
      ...newData,
    }));

    return { previous };
  },

  onError: (err, vars, context) => {
    // Rollback on error
    queryClient.setQueryData(['models', modelId], context.previous);
    toast.error('Update failed');
  },

  onSettled: () => {
    // Refetch to ensure sync
    queryClient.invalidateQueries({ queryKey: ['models', modelId] });
  },
});
```

**Applies When:**
- Detail page forms with frequent updates
- Need instant feedback for better UX
- Can tolerate brief inconsistency

## Recommendations

### DO

1. **Use Detail Pages for Complex Entities**
   - 5+ fields across multiple sections
   - Tab-based navigation needed
   - User needs deep focus

2. **Use Hybrid Pattern (Intercepting Routes) When:**
   - Quick preview needed from list (modal)
   - Full edit needed from direct link (detail page)
   - Using Next.js 15+

3. **Implement Tab-Based Layouts**
   - Each tab = separate route
   - Shared layout with persistent state
   - Breadcrumbs for navigation context

4. **Use React Hook Form + Zod**
   - Schema per section/tab
   - Validate before tab switching
   - `mode: 'onChange'` for real-time feedback

5. **Add Breadcrumbs for Nested Routes**
   - Auto-generate from pathname
   - Essential for 3+ levels deep

6. **Implement Optimistic Updates**
   - Instant feedback on form submission
   - Rollback on error

### AVOID

1. **Modals for Complex Forms**
   - Poor UX for 5+ fields
   - Limited screen space
   - Users lose context on accidental close

2. **Next.js 14 for Intercepting Routes**
   - Has bugs with dynamic routes
   - Use Next.js 15+ instead

3. **Single-Page Forms for Multi-Section Entities**
   - Overwhelming for users
   - Hard to validate progressively
   - No shareable URLs for sections

4. **Nested Modals**
   - Known bug in Next.js (modals stack)
   - Confusing UX

5. **Manual Breadcrumb Implementation**
   - Auto-generate from route segments instead

### CONSIDER

1. **Progressive Disclosure**
   - Show basic fields first
   - Advanced settings in expandable sections

2. **Auto-Save Drafts**
   - Persist to localStorage or DB
   - Prevent data loss on accidental navigation

3. **Loading Skeletons**
   - Add loading.tsx for each route segment
   - Better perceived performance

4. **Mobile-First Tab Design**
   - Horizontal scrollable tabs on mobile
   - Vertical sidebar tabs on desktop

## Implementation Notes

### For This Project (Telegram Admin Bot)

**Current State:**
- Models managed in modals
- Basic info + photos + products all in one modal
- No tab navigation
- No nested routes

**Recommended Migration:**

```typescript
// NEW structure
app/
└── (dashboard)/
    └── models/
        ├── page.tsx                    // List view
        └── [id]/
            ├── layout.tsx              // Tab navigation
            ├── page.tsx                // Info tab (default)
            ├── photos/
            │   └── page.tsx            // Photos tab
            ├── products/
            │   ├── page.tsx            // Products list
            │   └── [productId]/
            │       └── page.tsx        // Product detail
            └── purchases/
                ├── page.tsx            // Purchases list
                └── [purchaseId]/
                    └── page.tsx        // Purchase detail
```

**URL Structure:**
- `/models` - List all models
- `/models/123` - Model info (default tab)
- `/models/123/photos` - Photo management
- `/models/123/products` - Products list
- `/models/123/products/456` - Edit specific product
- `/models/123/purchases` - View purchases

**Form Strategy:**

```typescript
// Separate schemas per tab
const modelInfoSchema = z.object({
  name: z.string().min(1),
  username: z.string().min(1),
  onlyfansUrl: z.string().url(),
  tier: z.enum(['standard', 'premium', 'vip']),
});

const modelPhotosSchema = z.object({
  previewPhotos: z.array(z.object({
    s3Key: z.string(),
    url: z.string().url(),
  })).max(4),
});

const productSchema = z.object({
  type: z.enum(['content', 'ppv', 'subscription']),
  name: z.string().min(1),
  description: z.string(),
  price: z.number().positive(),
  contentPhotos: z.array(z.object({
    s3Key: z.string(),
    url: z.string().url(),
  })),
});
```

### Gotchas

1. **Intercepting Routes Dev Server**
   - MUST restart dev server after adding/removing @slots
   - Hot reload doesn't work for route structure changes

2. **Modal Layout Bug**
   - Add pathname check to prevent modal showing on wrong routes
   - Use `router.back()` instead of manual URL changes

3. **Form State Persistence**
   - Use React Hook Form's `defaultValues` to populate existing data
   - Consider auto-save to localStorage for drafts

4. **Breadcrumb Active State**
   - Use `usePathname()` to highlight current tab
   - Match exact path, not just segment

5. **Nested Form Validation**
   - Products array needs `useFieldArray` from react-hook-form
   - Validate each product independently before adding to array

## Sources

| Title | URL | Date | Relevance |
|-------|-----|------|-----------|
| Next.js Intercepting Routes | https://nextjs.org/docs/app/api-reference/file-conventions/intercepting-routes | 2026-02-09 | HIGH |
| Next.js Parallel Routes | https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes | 2025 | HIGH |
| Modals in Next.js (Medium) | https://medium.com/@bashaus/using-modals-in-next-js-with-parallel-routes-slots-route-groups-and-interceptors-0873e173c96d | 2025 | HIGH |
| Admin Dashboard UX 2025 | https://medium.com/@CarlosSmith24/admin-dashboard-ui-ux-best-practices-for-2025-8bdc6090c57d | 2025 | HIGH |
| Next.js Layouts & Pages | https://nextjs.org/learn/dashboard-app/creating-layouts-and-pages | 2025 | HIGH |
| Multi-Step Forms with RHF + Zod | https://blog.logrocket.com/building-reusable-multi-step-form-react-hook-form-zod/ | 2024-2025 | HIGH |
| React Hook Form with Zod | https://ui.shadcn.com/docs/forms/react-hook-form | 2025 | HIGH |
| Medusa Admin UI Routes | https://docs.medusajs.com/learn/fundamentals/admin/ui-routes | 2025 | MEDIUM |
| Dashboard Design Patterns | https://dashboarddesignpatterns.github.io/patterns.html | 2025 | MEDIUM |
| Type-Safe Forms Guide | https://oneuptime.com/blog/post/2026-01-15-type-safe-forms-react-hook-form-zod/view | 2026-01-15 | HIGH |

## Related Topics

- [[next-js-15-app-router]]
- [[react-hook-form-patterns]]
- [[zod-validation-schemas]]
- [[admin-dashboard-ux]]
- [[form-state-management]]
