# Domain: UI Components

## Last Update
- **Date:** 2026-01-26
- **Commit:** ef480b4
- **Summary:** shadcn/ui components with dark glassmorphism theme

## Files

### Layout Components
- `src/components/layout/app-sidebar.tsx` - Main navigation sidebar
- `src/components/layout/header.tsx` - Top header with user menu

### Shared Components
- `src/components/shared/data-table.tsx` - Reusable data table
- `src/components/shared/stats-card.tsx` - KPI display card

### UI Primitives (shadcn/ui)
- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/dropdown-menu.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/tabs.tsx`
- `src/components/ui/avatar.tsx`
- `src/components/ui/skeleton.tsx`
- `src/components/ui/progress.tsx`
- `src/components/ui/slider.tsx`
- `src/components/ui/switch.tsx`
- `src/components/ui/sidebar.tsx`
- `src/components/ui/sonner.tsx` (toaster)

### Providers
- `src/components/providers.tsx` - tRPC + Theme + Toaster

## Connections
- **pages** - All pages use these components
- **api** - Providers wrap tRPC client

## Recent Commits
- `3972e6e` - feat: add functional CRUD modals to all pages + new campaign creation page
- `c4cf62c` - feat: add slider component for spam controls
- Previous shadcn component additions

## Problems & Solutions

### 2027-01-27 - Inconsistent Modal Implementation Patterns

**Problem:** Each CRUD page implemented modals slightly differently, making code harder to maintain and reason about.

**Root Cause:** No documented standard modal pattern when pages were initially built.

**Solution:** Established Modal CRUD Pattern that all dashboard pages now follow:
1. State: `formData` object + `*Open` boolean
2. Mutation: useMutation with onSuccess (toast, close, reset, refetch) and onError handlers
3. Validation: Client-side check before calling mutation
4. Example pages: groups, creatives, models, casinos, revenue

**Prevention:** Document UI patterns with code examples BEFORE implementing pages. Include key points and variations.

**Files Modified:**
- `src/components/ui/dialog.tsx`
- Modal implementations in all CRUD pages

## Attention Points

### Sidebar Navigation
```typescript
const mainNavItems = [
  { title: 'Overview', href: '/', icon: LayoutDashboard },
  { title: 'Groups', href: '/groups', icon: Users },
  // ... 7 main items
];

const entitiesNavItems = [
  { title: 'Models', href: '/models', icon: Heart },
  { title: 'Casinos', href: '/casinos', icon: Dice5 },
];

const adminNavItems = [
  { title: 'Spam Controls', href: '/spam-controls', icon: Shield },
  // ... 4 admin items
];
```

### DataTable Props
```typescript
interface DataTableProps {
  columns: Array<{
    key: string;
    header: string;
    cell: (row: any) => React.ReactNode;
    className?: string;
  }>;
  data: any[];
  isLoading?: boolean;
  emptyMessage?: string;
}
```

### Theme
- Dark mode with glassmorphism
- Uses CSS variables from globals.css
- Card backgrounds: `bg-card/80 border-border/50`
- Status colors: green (success), yellow (warning), red (danger)

### Gotchas
- All shadcn components are in `components/ui/`
- Use `cn()` utility for className merging
- Icons from lucide-react (named imports only)
- Sidebar skeleton uses fixed width ('70%') not Math.random()

### Modal CRUD Pattern (MANDATORY)
All CRUD dialogs follow this exact pattern for consistency:

```tsx
'use client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function EntityPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    // ... other fields with defaults
  });

  const createMutation = trpc.entity.create.useMutation({
    onSuccess: () => {
      toast.success('Entity created successfully');
      setCreateOpen(false);
      setFormData({ name: '', /* reset all fields */ });
      refetch(); // Re-fetch list query
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create entity');
    },
  });

  const handleCreate = () => {
    // ALWAYS validate before mutation
    if (!formData.name || !formData.otherRequired) {
      toast.error('Please fill all required fields');
      return;
    }
    createMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      {/* Header with title */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Entities</h1>
        <Button onClick={() => setCreateOpen(true)}>Add Entity</Button>
      </div>

      {/* DataTable */}
      <DataTable columns={columns} data={data || []} isLoading={isLoading} />

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Entity</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Entity name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            {/* More fields... */}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

**Key Points:**
- State: `formData` (full object, not scattered state) + `*Open` (dialog visibility)
- Mutation: Always has onSuccess + onError handlers
- Validation: Check required fields BEFORE calling mutation
- Reset: On success, reset form data to initial defaults
- Refetch: Trigger list query refresh after successful mutation
- Loading: Disable submit button during mutation with `isPending` check
