'use client';

import { useState, useRef, useCallback } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Loader2, Crop as CropIcon, RotateCcw, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ImageCropperProps {
  file: File | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCropComplete: (croppedFile: File) => void;
  aspectRatioPreset?: 'free' | '1:1' | '4:3' | '16:9' | '9:16';
}

type AspectRatioOption = 'free' | '1:1' | '4:3' | '16:9' | '9:16';

const aspectRatios: Record<AspectRatioOption, number | undefined> = {
  free: undefined,
  '1:1': 1,
  '4:3': 4 / 3,
  '16:9': 16 / 9,
  '9:16': 9 / 16,
};

export function ImageCropper({
  file,
  open,
  onOpenChange,
  onCropComplete,
  aspectRatioPreset = 'free',
}: ImageCropperProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [aspectRatio, setAspectRatio] = useState<AspectRatioOption>(aspectRatioPreset);
  const [imageSrc, setImageSrc] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Load image when file changes
  useState(() => {
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImageSrc(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  });

  // Reset crop when aspect ratio changes
  const handleAspectRatioChange = (value: AspectRatioOption) => {
    setAspectRatio(value);
    setCrop(undefined);
    setCompletedCrop(undefined);
  };

  // Reset to original
  const handleReset = () => {
    setCrop(undefined);
    setCompletedCrop(undefined);
  };

  // Generate cropped image
  const getCroppedImg = useCallback(async (): Promise<File | null> => {
    if (!imgRef.current || !completedCrop) return null;

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) return null;

    // Calculate scale between natural and displayed size
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    // Set canvas size to crop size
    canvas.width = completedCrop.width * scaleX;
    canvas.height = completedCrop.height * scaleY;

    // Draw cropped portion
    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );

    // Convert to blob
    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(null);
            return;
          }
          const croppedFile = new File([blob], file?.name || 'cropped.jpg', {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(croppedFile);
        },
        'image/jpeg',
        0.9
      );
    });
  }, [completedCrop, file?.name]);

  // Handle crop confirmation
  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      // If no crop selected, use original file
      if (!completedCrop || !completedCrop.width || !completedCrop.height) {
        if (file) {
          onCropComplete(file);
        }
        onOpenChange(false);
        return;
      }

      const croppedFile = await getCroppedImg();
      if (croppedFile) {
        onCropComplete(croppedFile);
        onOpenChange(false);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setCrop(undefined);
    setCompletedCrop(undefined);
    setImageSrc('');
    onOpenChange(false);
  };

  // Load image when file changes
  if (file && !imageSrc) {
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  // Reset state when dialog closes
  if (!open && imageSrc) {
    setImageSrc('');
    setCrop(undefined);
    setCompletedCrop(undefined);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CropIcon className="h-5 w-5" />
            Crop Image
          </DialogTitle>
          <DialogDescription>
            Drag to select the area you want to keep. Choose an aspect ratio or
            crop freely.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Aspect Ratio Selector */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Aspect Ratio:</span>
            <Select
              value={aspectRatio}
              onValueChange={(v) => handleAspectRatioChange(v as AspectRatioOption)}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="1:1">1:1 (Square)</SelectItem>
                <SelectItem value="4:3">4:3</SelectItem>
                <SelectItem value="16:9">16:9</SelectItem>
                <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </div>

          {/* Crop Area */}
          <div className="flex items-center justify-center rounded-lg border bg-muted/50 p-4 min-h-[300px] max-h-[500px] overflow-auto">
            {imageSrc ? (
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={aspectRatios[aspectRatio]}
                className="max-h-[450px]"
              >
                <img
                  ref={imgRef}
                  src={imageSrc}
                  alt="Crop preview"
                  className="max-h-[450px] object-contain"
                />
              </ReactCrop>
            ) : (
              <div className="flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Crop Info */}
          {completedCrop && completedCrop.width > 0 && (
            <p className="text-sm text-muted-foreground text-center">
              Selected area: {Math.round(completedCrop.width)} x{' '}
              {Math.round(completedCrop.height)} pixels
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isProcessing}>
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isProcessing || !imageSrc}>
            {isProcessing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            {completedCrop?.width ? 'Apply Crop' : 'Use Original'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
