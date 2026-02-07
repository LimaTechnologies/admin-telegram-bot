'use client';

import { useState, useCallback } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc/client';

interface PhotoUploadProps {
  modelId: string;
  photos: string[];
  onPhotosChange: () => void;
}

export function PhotoUpload({ modelId, photos, onPhotosChange }: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);

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

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length) return;

      setUploading(true);
      try {
        for (const file of Array.from(files)) {
          // Get presigned URL
          const { url, key } = await getUploadUrl.mutateAsync({
            fileName: file.name,
            mimeType: file.type,
            folder: 'models',
          });

          // Upload to S3
          const uploadRes = await fetch(url, {
            method: 'PUT',
            body: file,
            headers: {
              'Content-Type': file.type,
            },
          });

          if (!uploadRes.ok) {
            throw new Error('Failed to upload file');
          }

          // Add photo to model
          await addPhoto.mutateAsync({ modelId, s3Key: key });
        }
      } catch (error) {
        toast.error('Failed to upload photo');
        console.error(error);
      } finally {
        setUploading(false);
        e.target.value = '';
      }
    },
    [modelId, getUploadUrl, addPhoto]
  );

  const handleRemove = async (s3Key: string) => {
    if (!confirm('Remove this photo?')) return;
    await removePhoto.mutateAsync({ modelId, s3Key });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Preview Photos</h4>
        <label>
          <input
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
    </div>
  );
}
