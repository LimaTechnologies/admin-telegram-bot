# Domain: Dashboard Pages

## Last Update
- **Date:** 2026-01-26
- **Commit:** ef480b4
- **Summary:** 13 dashboard pages + 2 auth pages

## Files

### Auth Pages
- `src/app/(auth)/login/page.tsx` - Email input for magic link
- `src/app/(auth)/verify/page.tsx` - Token verification

### Dashboard Pages (13 total)
- `src/app/(dashboard)/page.tsx` - Overview with KPIs
- `src/app/(dashboard)/groups/page.tsx` - Telegram groups management
- `src/app/(dashboard)/campaigns/page.tsx` - Campaign CRUD
- `src/app/(dashboard)/creatives/page.tsx` - Creative library
- `src/app/(dashboard)/scheduling/page.tsx` - Calendar + rotation
- `src/app/(dashboard)/revenue/page.tsx` - Deals + revenue tracking
- `src/app/(dashboard)/analytics/page.tsx` - Performance charts
- `src/app/(dashboard)/models/page.tsx` - OnlyFans models
- `src/app/(dashboard)/casinos/page.tsx` - Casino brands
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
