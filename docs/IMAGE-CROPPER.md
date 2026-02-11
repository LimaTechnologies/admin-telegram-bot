# Image Cropper Component

## Overview

React component for interactive image cropping with aspect ratio presets. Optimizes uploaded photos before saving to S3.

**Active Since:** 2026-02-11

**Location:** `src/components/shared/image-cropper.tsx`

## Features

- Interactive crop area selection with visual feedback
- Multiple aspect ratio presets: free, 1:1, 4:3, 16:9, 9:16
- Reset to original image
- JPEG compression (90% quality)
- Modal dialog interface
- Canvas-based rendering for pixel-perfect results
- Loading state and error handling

## Component Props

```typescript
interface ImageCropperProps {
  file: File | null;                    // Selected file to crop
  open: boolean;                        // Dialog visibility
  onOpenChange: (open: boolean) => void; // Dialog state callback
  onCropComplete: (croppedFile: File) => void; // Result callback
  aspectRatioPreset?: AspectRatioOption;  // Default: 'free'
}

type AspectRatioOption = 'free' | '1:1' | '4:3' | '16:9' | '9:16';
```

## Usage

### Basic Example

```typescript
'use client';
import { useState } from 'react';
import { ImageCropper } from '@/components/shared/image-cropper';
import { Button } from '@/components/ui/button';

export function PhotoUploadDemo() {
  const [cropperOpen, setCropperOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleCropComplete = (croppedFile: File) => {
    console.log('Cropped file:', croppedFile);
    // Upload to S3
    uploadToS3(croppedFile);
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            setSelectedFile(file);
            setCropperOpen(true);
          }
        }}
      />

      <ImageCropper
        file={selectedFile}
        open={cropperOpen}
        onOpenChange={setCropperOpen}
        onCropComplete={handleCropComplete}
        aspectRatioPreset="9:16"
      />
    </div>
  );
}
```

### With Photo Upload Component

```typescript
// src/app/(dashboard)/models/_components/photo-upload.tsx
import { ImageCropper } from '@/components/shared/image-cropper';

export function PhotoUpload() {
  const [cropperOpen, setCropperOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const uploadPresignedUrl = trpc.model.getPresignedUploadUrl.useMutation({
    onSuccess: async (data) => {
      const croppedFile = await waitForCrop(); // Wait for cropper
      await uploadToS3(croppedFile, data.uploadUrl);
    },
  });

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
        onCropComplete={(croppedFile) => {
          // Now upload the cropped file
          uploadPresignedUrl.mutate({ filename: croppedFile.name });
        }}
      />
    </>
  );
}
```

## Aspect Ratios

| Preset | Ratio | Use Case |
|--------|-------|----------|
| `free` | None | Any custom crop |
| `1:1` | 1:1 | Profile pictures, avatars |
| `4:3` | 1.33:1 | Standard landscape photos |
| `16:9` | 1.78:1 | Widescreen, banner images |
| `9:16` | 0.56:1 | Portrait, mobile, phone screens |

### Changing Default Preset

```typescript
<ImageCropper
  file={selectedFile}
  open={cropperOpen}
  onOpenChange={setCropperOpen}
  onCropComplete={handleCropComplete}
  aspectRatioPreset="1:1"  // Square by default
/>
```

## Workflow

```
User selects file (input type="file")
  ↓
Set selectedFile state + open cropper dialog
  ↓
ImageCropper loads image into canvas
  ↓
User selects crop area + adjusts aspect ratio
  ↓
User clicks "Apply Crop" or "Use Original"
  ↓
onCropComplete callback receives cropped File
  ↓
Parent component uploads to S3
```

## Implementation Details

### Image Loading

```typescript
// Load image from File
const reader = new FileReader();
reader.onload = () => {
  setImageSrc(reader.result as string); // Data URL
};
reader.readAsDataURL(file);
```

### Crop Processing

```typescript
// Get cropped canvas region
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d')!;

// Calculate natural size scale
const scaleX = image.naturalWidth / image.width;
const scaleY = image.naturalHeight / image.height;

// Set canvas to crop dimensions
canvas.width = completedCrop.width * scaleX;
canvas.height = completedCrop.height * scaleY;

// Draw cropped portion
ctx.drawImage(
  image,
  completedCrop.x * scaleX,
  completedCrop.y * scaleY,
  completedCrop.width * scaleX,
  completedCrop.height * scaleY,
  0, 0,
  canvas.width,
  canvas.height
);

// Convert to JPEG File
canvas.toBlob((blob) => {
  const croppedFile = new File([blob], file.name, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
  onCropComplete(croppedFile);
}, 'image/jpeg', 0.9);
```

### Key Points

- **Scale handling:** Calculates natural image size vs displayed size
- **Compression:** JPEG quality 0.9 (90%) balances quality vs file size
- **No crop fallback:** If user doesn't select crop area, returns original file
- **Async processing:** Crop generation wrapped in Promise for consistent interface

## Dependencies

### External Libraries

- **react-image-crop** - Interactive crop library
- **lucide-react** - Icons (Crop, RotateCcw, Check, X, Loader2)

### Components

- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter` - shadcn/ui
- `Button` - shadcn/ui
- `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem` - shadcn/ui

## Styling

### CSS Classes

```css
/* From react-image-crop */
@import 'react-image-crop/dist/ReactCrop.css';

/* Component styles */
.dialog-content { max-width: 42rem; }  /* max-w-2xl */
.crop-area {
  border: 1px solid hsl(var(--border));
  border-radius: 0.5rem;
  background: hsl(var(--muted) / 0.5);
  min-height: 300px;
  max-height: 500px;
}
.crop-image { max-height: 450px; }
```

### Theme Integration

- Uses shadcn/ui theme variables (CSS custom properties)
- Dark mode compatible
- Responsive dialog sizing

## Error Handling

### Handling Missing Image

```typescript
if (!imageSrc) {
  return <Loader2 className="h-8 w-8 animate-spin" />;
}
```

### Handling No Crop Selection

```typescript
if (!completedCrop || !completedCrop.width || !completedCrop.height) {
  // Use original file
  if (file) {
    onCropComplete(file);
  }
  onOpenChange(false);
  return;
}
```

### Handling Crop Processing Errors

```typescript
const croppedFile = await getCroppedImg();
if (croppedFile) {
  onCropComplete(croppedFile);
  onOpenChange(false);
}
// If null, silently fails and user can retry
```

## Performance

### Optimization Strategies

1. **Canvas rendering** - Native browser image processing (fast)
2. **Lazy file loading** - Only load when dialog opens
3. **Compression** - JPEG 90% quality reduces file size 50-70%
4. **State reset** - Clear large image data on close

### File Size Impact

**Before cropping:**
```
Original photo: 5MB (4000x3000px, full camera sensor)
```

**After cropping:**
```
Cropped + compressed: 200-400KB (1000x1000px, 90% JPEG)
Reduction: 92-96%
```

### Browser Compatibility

- **Canvas API:** All modern browsers (IE 9+)
- **FileReader API:** All modern browsers
- **Blob toBlob():** All modern browsers (IE 10+)

## Accessibility

### Features

- Dialog properly labeled with `DialogTitle`
- Icon buttons have aria-label (via lucide-react)
- Loading state indicated with spinner
- Reset button clearly labeled
- Aspect ratio selector with proper labels

### Keyboard Navigation

- Dialog can be closed with Escape key
- Button focus visible
- Tab order logical (through dialog controls)

## Integration Points

### Dashboard Pages Using ImageCropper

1. **Model Photo Upload**
   - `src/app/(dashboard)/models/_components/photo-upload.tsx`
   - Aspect: 9:16 (portrait, model gallery photos)

2. **Product Photo Upload**
   - `src/app/(dashboard)/models/[id]/products/_components/product-photo-upload.tsx`
   - Aspect: 1:1 (square, product previews)

### S3 Upload Flow

```
ImageCropper (crop) → onCropComplete callback → uploadPresignedUrl mutation
                                               ↓
                                        S3 upload via presigned URL
                                               ↓
                                        Save s3Key to database
```

## Customization Examples

### Custom Aspect Ratios

```typescript
// Extend the aspectRatios map in ImageCropper
const aspectRatios: Record<AspectRatioOption, number | undefined> = {
  free: undefined,
  '1:1': 1,
  '4:3': 4 / 3,
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '3:2': 3 / 2,  // NEW: add custom ratio
  '21:9': 21 / 9,  // NEW: add ultrawide
};
```

### Custom Compression Quality

```typescript
// Change JPEG quality in getCroppedImg()
canvas.toBlob(
  (blob) => { /* ... */ },
  'image/jpeg',
  0.75  // Changed from 0.9 (lower quality, smaller file)
);
```

### Custom Dialog Size

```typescript
// In component
<DialogContent className="max-w-4xl">  // Changed from max-w-2xl
```

### Custom Messages

```typescript
// In component
<DialogDescription>
  Adjust your image to perfection. Choose format and optimize.
</DialogDescription>
```

## Testing

### Unit Tests

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { ImageCropper } from './image-cropper';

test('renders crop dialog when open', () => {
  render(
    <ImageCropper
      file={new File([''], 'test.jpg')}
      open={true}
      onOpenChange={() => {}}
      onCropComplete={() => {}}
    />
  );
  expect(screen.getByText(/Crop Image/i)).toBeInTheDocument();
});

test('calls onCropComplete with cropped file', async () => {
  const onCropComplete = jest.fn();
  const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

  render(
    <ImageCropper
      file={file}
      open={true}
      onOpenChange={() => {}}
      onCropComplete={onCropComplete}
    />
  );

  // Select crop area and apply
  const applyButton = screen.getByText(/Apply Crop|Use Original/i);
  fireEvent.click(applyButton);

  // Wait for async processing
  await screen.findByText(/..., expect crop result/);
  expect(onCropComplete).toHaveBeenCalled();
});
```

### Integration Tests

```typescript
// Test with real S3 upload
test('crops image and uploads to S3', async () => {
  const { result } = renderHook(() => usePhotoUpload());

  // User selects and crops image
  const croppedFile = new File(['cropped'], 'test.jpg');
  result.current.handleCrop(croppedFile);

  // Verify S3 upload called
  await waitFor(() => {
    expect(s3Service.upload).toHaveBeenCalledWith(croppedFile);
  });
});
```

## Troubleshooting

### Issue: Image not loading in cropper

**Cause:** File is corrupted or wrong format

**Fix:**
- Add console log to check file type: `console.log(file.type)`
- Validate file: only `image/jpeg`, `image/png`, `image/webp`

### Issue: Crop area not appearing

**Cause:** CSS not loaded or image not displayed

**Fix:**
- Ensure `import 'react-image-crop/dist/ReactCrop.css'` in component
- Check browser DevTools: verify image element visible

### Issue: Canvas/toBlob not working

**Cause:** Browser compatibility or CORS issues

**Fix:**
- Check browser console for errors
- Use fallback: return original file if canvas fails
- Verify image is from same origin

## Performance Tips

### For Large Files (>10MB)

1. Add client-side validation:
```typescript
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
if (file.size > MAX_FILE_SIZE) {
  toast.error('File too large. Max 10MB.');
  return;
}
```

2. Show loading indicator during processing:
```typescript
const [isProcessing, setIsProcessing] = useState(false);
```

3. Compress aggressively:
```typescript
canvas.toBlob(cb, 'image/jpeg', 0.75); // Lower quality for large files
```

### Batch Upload Optimization

1. Process multiple files serially (not parallel):
```typescript
for (const file of filesToCrop) {
  const cropped = await cropAndUpload(file);
  // Wait for each to complete
}
```

2. Show progress bar:
```typescript
<ProgressBar value={(currentIndex / total) * 100} />
```

## See Also

- `react-image-crop` documentation: https://github.com/DominicTobias/react-image-crop
- `src/app/(dashboard)/models/_components/photo-upload.tsx` - Usage example
- MDN Canvas API: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API
