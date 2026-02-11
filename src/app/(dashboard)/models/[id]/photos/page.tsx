'use client';

import React from 'react';
import { Loader2, Image as ImageIcon } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { PhotoUpload } from '../../_components/photo-upload';

interface PhotosPageProps {
  params: Promise<{ id: string }>;
}

export default function PhotosPage({ params }: PhotosPageProps) {
  const { id } = React.use(params);

  const { data: model, isLoading, refetch } = trpc.model.getById.useQuery(
    { id },
    { enabled: !!id }
  );

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!model) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Info Card */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <ImageIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium">Preview Photos</h3>
            <p className="text-sm text-muted-foreground">
              These photos are shown to users before they make a purchase. You can
              upload up to 4 photos that will be displayed as a gallery in the
              Telegram bot.
            </p>
          </div>
        </div>
      </div>

      {/* Photo Upload Component */}
      <div className="rounded-lg border bg-card p-6">
        <PhotoUpload
          modelId={id}
          photos={model.previewPhotos || []}
          onPhotosChange={refetch}
        />
      </div>

      {/* Tips */}
      <div className="rounded-lg border border-dashed bg-muted/50 p-4">
        <h4 className="mb-2 text-sm font-medium">Tips for better photos</h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>• Use high-quality images (min 800x800px)</li>
          <li>• Square or portrait orientation works best on mobile</li>
          <li>• First photo is used as the main profile preview</li>
          <li>• Keep file sizes under 5MB for faster loading</li>
        </ul>
      </div>
    </div>
  );
}
