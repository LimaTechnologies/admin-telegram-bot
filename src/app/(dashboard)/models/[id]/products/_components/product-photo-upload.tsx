'use client';

import { useState, useCallback } from 'react';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc/client';

interface ProductPhotoUploadProps {
  modelId: string;
  productId: string;
  photos: string[];
  photoType: 'preview' | 'content';
  onPhotosChange: () => void;
}

export function ProductPhotoUpload({
  modelId,
  productId,
  photos,
  photoType,
  onPhotosChange,
}: ProductPhotoUploadProps) {
  const [uploading, setUploading] = useState(false);

  const getUploadUrl = trpc.model.getUploadUrl.useMutation();
  const addPhoto = trpc.model.addProductPhoto.useMutation({
    onSuccess: () => {
      toast.success('Photo added');
      onPhotosChange();
    },
    onError: (e) => toast.error(e.message),
  });
  const removePhoto = trpc.model.removeProductPhoto.useMutation({
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
          const folder =
            photoType === 'preview' ? 'product-previews' : 'product-content';
          const { url, key } = await getUploadUrl.mutateAsync({
            fileName: file.name,
            mimeType: file.type,
            folder,
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

          // Add photo to product
          await addPhoto.mutateAsync({
            modelId,
            productId,
            s3Key: key,
            photoType,
          });
        }
      } catch (error) {
        toast.error('Failed to upload photo');
        console.error(error);
      } finally {
        setUploading(false);
        e.target.value = '';
      }
    },
    [modelId, productId, photoType, getUploadUrl, addPhoto]
  );

  const handleRemove = async (s3Key: string) => {
    if (!confirm('Remove this photo?')) return;
    await removePhoto.mutateAsync({
      modelId,
      productId,
      s3Key,
      photoType,
    });
  };

  const emptyMessage =
    photoType === 'preview'
      ? 'No preview images yet. Add images to attract customers.'
      : 'No content photos yet. Add the photos that will be delivered after purchase.';

  const uploadLabel =
    photoType === 'preview' ? 'Upload Previews' : 'Upload Content';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
        </p>
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
              {uploadLabel}
            </span>
          </Button>
        </label>
      </div>

      {photos.length === 0 ? (
        <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          <ImageIcon className="mb-2 h-8 w-8" />
          {emptyMessage}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((photo, idx) => (
            <div key={idx} className="group relative aspect-square">
              <img
                src={photo}
                alt={`${photoType} ${idx + 1}`}
                className="h-full w-full rounded-lg object-cover"
              />
              <button
                onClick={() => handleRemove(photo)}
                className="absolute right-1 top-1 rounded-full bg-black/50 p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/70"
                title="Remove photo"
              >
                <X className="h-4 w-4 text-white" />
              </button>
              <div className="absolute bottom-1 left-1 rounded bg-black/50 px-1.5 py-0.5 text-xs text-white">
                {idx + 1}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
