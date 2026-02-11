# Domain: UI Components

## Last Update
- **Date:** 2026-02-11
- **Commit:** 25f97e0
- **Summary:** Completed ImageCropper component with react-image-crop integration. Photo upload components now support cropping before S3 upload with aspect ratio presets (free, 1:1, 4:3, 16:9, 9:16).

## Files

### Layout Components
- `src/components/layout/app-sidebar.tsx` - Main navigation sidebar
- `src/components/layout/header.tsx` - Top header with user menu

### Shared Components
- `src/components/shared/data-table.tsx` - Reusable data table
- `src/components/shared/stats-card.tsx` - KPI display card
- `src/components/shared/image-cropper.tsx` - Image cropping dialog with aspect ratio presets

### Page-Specific Components
- `src/app/(dashboard)/models/_components/photo-upload.tsx` - Multi-photo upload with S3 presigned URLs
- `src/app/(dashboard)/models/_components/product-manager.tsx` - Product CRUD (packs/subscriptions)
- `src/app/(dashboard)/models/_components/model-detail-dialog.tsx` - Full model details view

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
- 25f97e0 - feat: add clickable model name to open detail page
- 4c4a76b - docs: update CLAUDE.md with model detail pages changes
- 48ae98e - feat: migrate model editing from modals to dedicated pages
- (2026-02-11) - feat: add image cropper component for photo upload optimization
- `5216399` - feat: implement model purchase system with PIX payments

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

### 2026-02-07 - Photo Upload Component with S3 Presigned URLs

**Problem:** Need to allow dashboard users to upload multiple preview photos for models without exposing S3 credentials.

**Root Cause:** Direct S3 upload from browser requires presigned URLs generated server-side.

**Solution:** Created PhotoUpload component that:
1. Calls tRPC mutation to get presigned URL + s3Key
2. Uploads file directly to S3 via presigned URL (bypassing backend)
3. Returns s3Key to parent for saving in model
4. Displays uploaded photos with delete capability

**Prevention:** For user file uploads, always use presigned URLs pattern. Server generates upload URL, browser uploads directly, server stores only the s3Key.

**Files Modified:**
- `src/app/(dashboard)/models/_components/photo-upload.tsx`
- `src/server/trpc/routers/model.router.ts`

### 2026-02-11 - Image Cropper Component

**Problem:** Need to allow users to crop/optimize uploaded photos before saving to S3 (reduces storage, improves gallery appearance).

**Root Cause:** Photos uploaded at full resolution may have poor framing or excessive file size.

**Solution:** Created ImageCropper component that:
1. Displays dialog with react-image-crop library
2. Provides aspect ratio presets: free, 1:1, 4:3, 16:9, 9:16
3. Allows reset to original image
4. Generates cropped File object with JPEG compression (90% quality)
5. Handles both file input and canvas rendering
6. Falls back to original file if no crop selected

**Usage Pattern:**
```typescript
const [cropperOpen, setCropperOpen] = useState(false);
const [selectedFile, setSelectedFile] = useState<File | null>(null);

const handleCropComplete = async (croppedFile: File) => {
  // Upload croppedFile instead of original
  await uploadToS3(croppedFile);
};

return (
  <>
    <input
      type="file"
      onChange={(e) => {
        setSelectedFile(e.target.files?.[0] || null);
        setCropperOpen(true);
      }}
    />
    <ImageCropper
      file={selectedFile}
      open={cropperOpen}
      onOpenChange={setCropperOpen}
      onCropComplete={handleCropComplete}
      aspectRatioPreset="9:16"
    />
  </>
);
```

**Files Created/Modified:**
- `src/components/shared/image-cropper.tsx` (NEW)
- `src/app/(dashboard)/models/_components/photo-upload.tsx` (integrated cropper)
- `src/app/(dashboard)/models/[id]/products/_components/product-photo-upload.tsx` (integrated cropper)

**Key Points:**
- Uses react-image-crop library (npm install react-image-crop)
- Canvas-based crop for pixel-perfect results
- JPEG quality 0.9 balances quality vs file size
- Reset button clears selection and starts over
- Dialog closes on confirm or cancel

**Implementation Details:**
```typescript
// Key features:
1. Aspect ratio presets: free, 1:1, 4:3, 16:9, 9:16
2. Image loaded via FileReader (base64 data URL)
3. Canvas-based cropping with scale calculation for natural image size
4. Falls back to original file if no crop area selected
5. Returns cropped File object ready for upload

// Integration pattern:
const [cropperOpen, setCropperOpen] = useState(false);
const [selectedFile, setSelectedFile] = useState<File | null>(null);

<ImageCropper
  file={selectedFile}
  open={cropperOpen}
  onOpenChange={setCropperOpen}
  onCropComplete={(croppedFile) => uploadToS3(croppedFile)}
  aspectRatioPreset="9:16"
/>
```

**Gotchas:**
- Must import CSS: `import 'react-image-crop/dist/ReactCrop.css'`
- Image state managed via useRef (imgRef) to avoid re-renders
- Scale calculation needed to convert displayed pixels to natural image pixels
- Canvas toBlob is async, wrapped in Promise for clean API
- Reset clears both `crop` (UI selection) and `completedCrop` (final selection)

### 2026-02-07 - Product Manager Nested CRUD

**Problem:** Each model can have multiple products (packs/subscriptions), requiring nested CRUD within model edit flow.

**Root Cause:** Products are embedded documents in model schema, not separate collection.

**Solution:** Created ProductManager component with:
- Separate state for products array
- Add/Edit/Delete handlers that modify local array
- Parent component receives updated products array via onChange callback
- Support for pack-specific fields (previewImages) vs subscription fields

**Prevention:** For embedded document arrays, create dedicated manager component that handles CRUD internally and exposes onChange with full array.

**Files Modified:**
- `src/app/(dashboard)/models/_components/product-manager.tsx`

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
