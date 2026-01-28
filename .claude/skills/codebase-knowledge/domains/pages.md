# Domain: Dashboard Pages

## Last Update
- **Date:** 2026-01-28
- **Commit:** fix/analytics-charts-visibility
- **Summary:** Fixed analytics charts visibility - vibrant colors, legends, improved tooltips

## Files

### Auth Pages
- `src/app/(auth)/login/page.tsx` - Email input for magic link
- `src/app/(auth)/verify/page.tsx` - Token verification

### Dashboard Pages (13 total)
- `src/app/(dashboard)/page.tsx` - Overview with KPIs
- `src/app/(dashboard)/groups/page.tsx` - Telegram groups management (functional Add modal)
- `src/app/(dashboard)/campaigns/page.tsx` - Campaign CRUD
- `src/app/(dashboard)/campaigns/new/page.tsx` - NEW: Full campaign creation form
- `src/app/(dashboard)/creatives/page.tsx` - Creative library (functional Add modal)
- `src/app/(dashboard)/scheduling/page.tsx` - Calendar + rotation (functional Schedule modal)
- `src/app/(dashboard)/revenue/page.tsx` - Deals + revenue tracking (functional New Deal modal)
- `src/app/(dashboard)/analytics/page.tsx` - Performance charts
- `src/app/(dashboard)/models/page.tsx` - OnlyFans models (functional Add modal)
- `src/app/(dashboard)/casinos/page.tsx` - Casino brands (functional Add modal)
- `src/app/(dashboard)/spam-controls/page.tsx` - Safety settings
- `src/app/(dashboard)/reports/page.tsx` - Export generation
- `src/app/(dashboard)/audit-logs/page.tsx` - Activity history
- `src/app/(dashboard)/queue-monitor/page.tsx` - BullMQ status

### Layouts
- `src/app/(auth)/layout.tsx` - Centered auth layout
- `src/app/(dashboard)/layout.tsx` - Sidebar + header layout

## Connections
- **api** - All pages use tRPC queries/mutations
- **ui-components** - Pages use shared components
- **authentication** - Dashboard layout checks session

## Recent Commits
- `3972e6e` - feat: add functional CRUD modals to all pages + new campaign creation page
- `c4cf62c` - feat: add all missing dashboard pages
- Previous commits for groups, campaigns

## Attention Points

### Page Structure Pattern
```tsx
'use client';

export default function EntityPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all');

  const { data, isLoading, refetch } = trpc.entity.list.useQuery({...});
  const deleteMutation = trpc.entity.delete.useMutation({...});

  const columns = [...]; // DataTable columns

  return (
    <div className="space-y-6">
      {/* Header with title + Add button */}
      {/* Stats cards */}
      {/* Filters */}
      {/* DataTable */}
      {/* Pagination */}
    </div>
  );
}
```

### Column Types
All pages use `any` type for DataTable columns with eslint-disable:
```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const columns: Array<{ key: string; header: string; cell: (row: any) => React.ReactNode }> = [...]
```

### Gotchas
- All dashboard pages are client components ('use client')
- verify/page.tsx uses useRef to prevent double verification
- analytics uses `getOverview` (not `getDashboardStats`)
- audit-logs uses `audit.list` (not `auditLog.list`)
- Pagination resets when filters change (should reset page to 1)

### Modal CRUD Pattern (MANDATORY)
All CRUD modals now follow this standardized pattern for consistency:
```tsx
const [formData, setFormData] = useState({ /* field defaults */ });
const createMutation = trpc.entity.create.useMutation({
  onSuccess: () => {
    toast.success('Created successfully');
    setCreateOpen(false);
    setFormData({ /* reset to defaults */ });
    refetch();
  },
  onError: (error) => toast.error(error.message),
});

const handleCreate = () => {
  // Client-side validation BEFORE mutation
  if (!formData.requiredField) {
    toast.error('Please fill all required fields');
    return;
  }
  createMutation.mutate(formData);
};
```

**Key Points:**
- State management: `formData` + `*Open` boolean
- useMutation with onSuccess (toast, close, reset, refetch) and onError handlers
- Client-side validation returns early if invalid
- Reset form data to defaults on success

### Campaign Creation Page
- **Route:** `/campaigns/new`
- **Features:**
  - Multi-card form layout (Basic Info, Schedule, Entity Selection, Target Groups, Creatives)
  - Conditional rendering based on campaign type (OnlyFans vs Casino)
  - Checkbox lists for group and creative selection with `toggleGroup()`, `toggleCreative()` helpers
  - Form validation before submission
  - Back navigation with ArrowLeft icon
  - Uses `trpc.group.getActive` and `trpc.creative.getActive` queries
- **Required fields:** name, startDate, groupIds (min 1), creativeIds (min 1)

### Problems & Solutions

#### 2026-01-28 - Analytics Charts Dark Mode Visibility

**Problem:** Charts on analytics page were nearly invisible in dark mode - grey bars on dark background, no color differentiation between Views and Clicks lines.

**Root Cause:** Charts used CSS variables (`hsl(var(--primary))`) which in dark mode resolve to low-contrast grey colors (oklch with 0 chroma).

**Solution:**
- Created explicit CHART_COLORS constant with vibrant hex colors:
  - Views: `#22c55e` (green-500)
  - Clicks: `#3b82f6` (blue-500)
  - Revenue: `#f59e0b` (amber-500)
- Added Legend component to both charts
- Enhanced Line component with visible dots (r=5) and activeDot (r=8)
- Added gradient fill to Bar chart
- Improved Tooltip with contrasting dark background (#1f2937)
- Added progress bars to Campaign Performance section

**Prevention:** For Recharts in dark mode, always use explicit hex colors instead of CSS variables. Add legends to all charts.

**Files Modified:**
- `src/app/(dashboard)/analytics/page.tsx`

#### 2027-01-27 - Modal CRUD Pattern Standardization

**Problem:** Each CRUD page had slightly different modal implementations, leading to inconsistency and harder maintenance.

**Root Cause:** No documented standard pattern for modals across pages.

**Solution:** Created standardized Modal CRUD Pattern documented above. All pages (groups, creatives, models, casinos, revenue) now implement identical pattern with formData state, useMutation with onSuccess/onError callbacks, client-side validation.

**Prevention:** Document patterns BEFORE implementation. Include code example and key points to follow.

**Files Modified:**
- `src/app/(dashboard)/groups/page.tsx`
- `src/app/(dashboard)/creatives/page.tsx`
- `src/app/(dashboard)/models/page.tsx`
- `src/app/(dashboard)/casinos/page.tsx`
- `src/app/(dashboard)/revenue/page.tsx`

### Attention Points

#### 2027-01-27 - Active Query Filters
- Use `getActive` queries (not `list`) when building dropdown/select lists in forms
- Example: `trpc.group.getActive.useQuery()` filters by `isActive: true`
- Example: `trpc.creative.getActive.useQuery()` filters by `isCompliant: true`
- These replace full lists in campaign creation UI

#### 2027-01-27 - Test Data Dependencies
When testing campaign features, build test data in this order:
1. Create Model (OnlyFans/Casino)
2. Create Group (links to Model)
3. Create Creative (links to Group)
4. Create Campaign (links to Model + Group)
5. Create ScheduledPost (links to Campaign + Creative + Group)
Each step depends on previous step's creation

#### 2027-01-27 - Default Schema Values
Mongoose schemas have automatic defaults (e.g., `settings: { isActive: true }`), so:
- New groups created without explicit `isActive` are automatically active
- Check schema defaults before assuming need to set explicitly
- This affects what appears in `getActive` queries immediately after creation
