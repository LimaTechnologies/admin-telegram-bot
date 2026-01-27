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
- `c4cf62c` - feat: add slider component for spam controls
- Previous shadcn component additions

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
