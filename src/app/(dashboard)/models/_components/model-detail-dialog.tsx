'use client';

import { useState, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc/client';
import { PhotoUpload } from './photo-upload';
import { ProductManager } from './product-manager';
import type { ModelTier } from '$types/model';

interface ModelDetailDialogProps {
  modelId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ModelDetailDialog({
  modelId,
  open,
  onOpenChange,
  onSuccess,
}: ModelDetailDialogProps) {
  // Track user edits separately from model data
  const [userEdits, setUserEdits] = useState<Partial<{
    name: string;
    username: string;
    onlyfansUrl: string;
    referralLink: string;
    tier: ModelTier;
    bio: string;
    isActive: boolean;
  }>>({});

  const { data: model, isLoading, refetch } = trpc.model.getById.useQuery(
    { id: modelId || '' },
    { enabled: !!modelId && open }
  );

  // Derive form data from model + user edits
  const formData = useMemo(() => ({
    name: userEdits.name ?? model?.name ?? '',
    username: userEdits.username ?? model?.username ?? '',
    onlyfansUrl: userEdits.onlyfansUrl ?? model?.onlyfansUrl ?? '',
    referralLink: userEdits.referralLink ?? model?.referralLink ?? '',
    tier: userEdits.tier ?? model?.tier ?? 'bronze' as ModelTier,
    bio: userEdits.bio ?? model?.bio ?? '',
    isActive: userEdits.isActive ?? model?.isActive ?? true,
  }), [model, userEdits]);

  const setFormData = (updates: Partial<typeof formData>) => {
    setUserEdits(prev => ({ ...prev, ...updates }));
  };

  const updateModel = trpc.model.update.useMutation({
    onSuccess: () => {
      toast.success('Model updated');
      setUserEdits({}); // Reset edits after save
      onSuccess();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    if (!modelId) return;
    updateModel.mutate({
      id: modelId,
      ...formData,
      referralLink: formData.referralLink || undefined,
      bio: formData.bio || undefined,
    });
  };

  if (!modelId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Model</DialogTitle>
          <DialogDescription>
            Manage model details, photos, and products
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : model ? (
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="photos">Photos</TabsTrigger>
              <TabsTrigger value="products">Products</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input
                    value={formData.username}
                    onChange={(e) => setFormData({ username: e.target.value })}
                    disabled
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>OnlyFans URL</Label>
                <Input
                  value={formData.onlyfansUrl}
                  onChange={(e) => setFormData({ onlyfansUrl: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Referral Link (for tracking)</Label>
                <Input
                  placeholder="https://onlyfans.com/username?ref=telegram"
                  value={formData.referralLink}
                  onChange={(e) => setFormData({ referralLink: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tier</Label>
                  <Select
                    value={formData.tier}
                    onValueChange={(v) => setFormData({ tier: v as ModelTier })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bronze">Bronze</SelectItem>
                      <SelectItem value="silver">Silver</SelectItem>
                      <SelectItem value="gold">Gold</SelectItem>
                      <SelectItem value="platinum">Platinum</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.isActive}
                      onCheckedChange={(checked) => setFormData({ isActive: checked })}
                    />
                    <Label>Active</Label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Bio</Label>
                <Textarea
                  placeholder="Short bio about the model..."
                  rows={3}
                  value={formData.bio}
                  onChange={(e) => setFormData({ bio: e.target.value })}
                />
              </div>
            </TabsContent>

            <TabsContent value="photos" className="py-4">
              <PhotoUpload
                modelId={modelId}
                photos={model.previewPhotos || []}
                onPhotosChange={refetch}
              />
            </TabsContent>

            <TabsContent value="products" className="py-4">
              <ProductManager
                modelId={modelId}
                products={model.products || []}
                onProductsChange={refetch}
              />
            </TabsContent>
          </Tabs>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleSave} disabled={updateModel.isPending}>
            {updateModel.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
