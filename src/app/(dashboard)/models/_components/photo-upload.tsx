'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc/client';
import { ImageCropper } from '@/components/shared/image-cropper';

interface PhotoUploadProps {
  modelId: string;
  photos: string[];
  onPhotosChange: () => void;
}

export function PhotoUpload({ modelId, photos, onPhotosChange }: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getUploadUrl = trpc.model.getUploadUrl.useMutation();
  const addPhoto = trpc.model.addPhoto.useMutation({
    onSuccess: () => {
      toast.success('Photo added');
      onPhotosChange();
    },
    onError: (e) => toast.error(e.message),
  });
  const removePhoto = trpc.model.removePhoto.useMutation({
    onSuccess: () => {
      toast.success('Photo removed');
      onPhotosChange();
    },
    onError: (e) => toast.error(e.message),
  });

  // Upload a single file to S3
  const uploadFile = async (file: File) => {
    const { url, key } = await getUploadUrl.mutateAsync({
      fileName: file.name,
      mimeType: file.type || 'image/jpeg',
      folder: 'models',
    });

    const uploadRes = await fetch(url, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type || 'image/jpeg',
      },
    });

    if (!uploadRes.ok) {
      throw new Error('Failed to upload file');
    }

    await addPhoto.mutateAsync({ modelId, s3Key: key });
  };

  // Handle file selection - open cropper for first file
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length) return;

      const fileArray = Array.from(files);
      setPendingFiles(fileArray);
      setCurrentFileIndex(0);
      setCropperOpen(true);

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    []
  );

  // Handle crop complete - upload and move to next file
  const handleCropComplete = async (croppedFile: File) => {
    setUploading(true);
    try {
      await uploadFile(croppedFile);

      // Move to next file if any
      const nextIndex = currentFileIndex + 1;
      if (nextIndex < pendingFiles.length) {
        setCurrentFileIndex(nextIndex);
        setCropperOpen(true);
      } else {
        // All files processed
        setPendingFiles([]);
        setCurrentFileIndex(0);
      }
    } catch (error) {
      toast.error('Failed to upload photo');
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  // Handle cropper cancel - skip current file
  const handleCropperClose = (open: boolean) => {
    if (!open) {
      // Move to next file or finish
      const nextIndex = currentFileIndex + 1;
      if (nextIndex < pendingFiles.length) {
        setCurrentFileIndex(nextIndex);
        setCropperOpen(true);
      } else {
        setPendingFiles([]);
        setCurrentFileIndex(0);
        setCropperOpen(false);
      }
    }
  };

  const handleRemove = async (s3Key: string) => {
    if (!confirm('Remove this photo?')) return;
    await removePhoto.mutateAsync({ modelId, s3Key });
  };

  const currentFile = pendingFiles[currentFileIndex] || null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Preview Photos</h4>
        <label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            disabled={uploading}
          />
          <Button variant="outline" size="sm" asChild disabled={uploading}>
            <span className="cursor-pointer">
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Upload Photos
            </span>
          </Button>
        </label>
      </div>

      {photos.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          No photos uploaded yet
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {photos.map((photo, idx) => (
            <div key={idx} className="group relative aspect-square">
              <img
                src={photo}
                alt={`Preview ${idx + 1}`}
                className="h-full w-full rounded-lg object-cover"
              />
              <button
                onClick={() => handleRemove(photo)}
                className="absolute right-1 top-1 rounded-full bg-black/50 p-1 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-4 w-4 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Image Cropper Modal */}
      <ImageCropper
        file={currentFile}
        open={cropperOpen}
        onOpenChange={handleCropperClose}
        onCropComplete={handleCropComplete}
        aspectRatioPreset="1:1"
      />

      {/* Progress indicator for multiple files */}
      {pendingFiles.length > 1 && cropperOpen && (
        <p className="text-sm text-muted-foreground text-center">
          Photo {currentFileIndex + 1} of {pendingFiles.length}
        </p>
      )}
    </div>
  );
}
