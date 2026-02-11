'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2, Save } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import type { ModelTier } from '$types/model';

interface ModelInfoPageProps {
  params: Promise<{ id: string }>;
}

export default function ModelInfoPage({ params }: ModelInfoPageProps) {
  const router = useRouter();
  const { id } = React.use(params);

  const [userEdits, setUserEdits] = useState<
    Partial<{
      name: string;
      username: string;
      onlyfansUrl: string;
      referralLink: string;
      tier: ModelTier;
      bio: string;
      isActive: boolean;
    }>
  >({});

  const { data: model, isLoading, refetch } = trpc.model.getById.useQuery(
    { id },
    { enabled: !!id }
  );

  const formData = useMemo(
    () => ({
      name: userEdits.name ?? model?.name ?? '',
      username: userEdits.username ?? model?.username ?? '',
      onlyfansUrl: userEdits.onlyfansUrl ?? model?.onlyfansUrl ?? '',
      referralLink: userEdits.referralLink ?? model?.referralLink ?? '',
      tier: userEdits.tier ?? model?.tier ?? ('bronze' as ModelTier),
      bio: userEdits.bio ?? model?.bio ?? '',
      isActive: userEdits.isActive ?? model?.isActive ?? true,
    }),
    [model, userEdits]
  );

  const hasChanges = Object.keys(userEdits).length > 0;

  const setFormData = (updates: Partial<typeof formData>) => {
    setUserEdits((prev) => ({ ...prev, ...updates }));
  };

  const updateModel = trpc.model.update.useMutation({
    onSuccess: () => {
      toast.success('Model updated');
      setUserEdits({});
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteModel = trpc.model.delete.useMutation({
    onSuccess: () => {
      toast.success('Model deleted');
      router.push('/models');
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    if (!id) return;
    updateModel.mutate({
      id,
      ...formData,
      referralLink: formData.referralLink || undefined,
      bio: formData.bio || undefined,
    });
  };

  const handleDelete = () => {
    if (!id) return;
    deleteModel.mutate({ id });
  };

  const getTierColor = (tier: string) => {
    const colors: Record<string, string> = {
      bronze: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
      silver: 'bg-gray-400/10 text-gray-400 border-gray-400/20',
      gold: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      platinum: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
    };
    return colors[tier] || colors['bronze'];
  };

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
      {/* Status Banner */}
      <div className="flex items-center justify-between rounded-lg border bg-card p-4">
        <div className="flex items-center gap-3">
          <Badge variant={model.isActive ? 'default' : 'secondary'}>
            {model.isActive ? 'Active' : 'Inactive'}
          </Badge>
          <Badge variant="outline" className={getTierColor(model.tier)}>
            {model.tier}
          </Badge>
        </div>
        <div className="text-sm text-muted-foreground">
          Created {new Date(model.createdAt).toLocaleDateString()}
        </div>
      </div>

      {/* Form */}
      <div className="space-y-6 rounded-lg border bg-card p-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ name: e.target.value })}
              placeholder="Model name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={formData.username}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Username cannot be changed
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="onlyfansUrl">OnlyFans URL</Label>
          <Input
            id="onlyfansUrl"
            value={formData.onlyfansUrl}
            onChange={(e) => setFormData({ onlyfansUrl: e.target.value })}
            placeholder="https://onlyfans.com/username"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="referralLink">Referral Link (for tracking)</Label>
          <Input
            id="referralLink"
            value={formData.referralLink}
            onChange={(e) => setFormData({ referralLink: e.target.value })}
            placeholder="https://onlyfans.com/username?ref=telegram"
          />
          <p className="text-xs text-muted-foreground">
            Use this to track conversions from Telegram
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="tier">Tier</Label>
            <Select
              value={formData.tier}
              onValueChange={(v) => setFormData({ tier: v as ModelTier })}
            >
              <SelectTrigger id="tier">
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

          <div className="flex items-end">
            <div className="flex items-center gap-3">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ isActive: checked })}
              />
              <Label htmlFor="isActive" className="cursor-pointer">
                Active
              </Label>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            value={formData.bio}
            onChange={(e) => setFormData({ bio: e.target.value })}
            placeholder="Short bio about the model..."
            rows={4}
          />
        </div>
      </div>

      {/* Performance Stats */}
      {model.performance && (
        <div className="rounded-lg border bg-card p-6">
          <h3 className="mb-4 font-semibold">Performance</h3>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-2xl font-bold">
                {model.performance.totalCampaigns}
              </p>
              <p className="text-sm text-muted-foreground">Campaigns</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{model.performance.totalPosts}</p>
              <p className="text-sm text-muted-foreground">Posts</p>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {model.performance.conversionRate.toFixed(1)}%
              </p>
              <p className="text-sm text-muted-foreground">Conversion Rate</p>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                }).format(model.performance.totalRevenue)}
              </p>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Model
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Model</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete &quot;{model.name}&quot;? This
                action cannot be undone. All associated photos and products will
                also be deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button
          onClick={handleSave}
          disabled={!hasChanges || updateModel.isPending}
        >
          {updateModel.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
