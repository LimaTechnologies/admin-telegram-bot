'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Loader2,
  ArrowLeft,
  Save,
  Trash2,
  Image as ImageIcon,
  Lock,
} from 'lucide-react';
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
import type { ProductType } from '$types/model';
import { ProductPhotoUpload } from '../_components/product-photo-upload';

interface ProductEditPageProps {
  params: Promise<{ id: string; productId: string }>;
}

export default function ProductEditPage({ params }: ProductEditPageProps) {
  const router = useRouter();
  const { id: modelId, productId } = React.use(params);

  const [userEdits, setUserEdits] = useState<
    Partial<{
      name: string;
      description: string;
      type: ProductType;
      price: number;
      currency: 'BRL' | 'USD';
      isActive: boolean;
    }>
  >({});

  const { data: model, isLoading, refetch } = trpc.model.getById.useQuery(
    { id: modelId },
    { enabled: !!modelId }
  );

  const product = useMemo(() => {
    return model?.products?.find((p) => p._id.toString() === productId);
  }, [model, productId]);

  const formData = useMemo(
    () => ({
      name: userEdits.name ?? product?.name ?? '',
      description: userEdits.description ?? product?.description ?? '',
      type: userEdits.type ?? product?.type ?? ('content' as ProductType),
      price: userEdits.price ?? product?.price ?? 0,
      currency: userEdits.currency ?? product?.currency ?? ('BRL' as const),
      isActive: userEdits.isActive ?? product?.isActive ?? true,
    }),
    [product, userEdits]
  );

  const hasChanges = Object.keys(userEdits).length > 0;

  const setFormData = (updates: Partial<typeof formData>) => {
    setUserEdits((prev) => ({ ...prev, ...updates }));
  };

  const updateProduct = trpc.model.updateProduct.useMutation({
    onSuccess: () => {
      toast.success('Product updated');
      setUserEdits({});
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteProduct = trpc.model.deleteProduct.useMutation({
    onSuccess: () => {
      toast.success('Product deleted');
      router.push(`/models/${modelId}/products`);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    if (!productId) return;
    updateProduct.mutate({
      modelId,
      productId,
      data: {
        name: formData.name,
        description: formData.description || undefined,
        type: formData.type,
        price: formData.price,
        currency: formData.currency,
        isActive: formData.isActive,
      },
    });
  };

  const handleDelete = () => {
    if (!productId) return;
    deleteProduct.mutate({ modelId, productId });
  };

  const getTypeColor = (type: ProductType) => {
    const colors: Record<ProductType, string> = {
      subscription: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      content: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      ppv: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
      custom: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
    };
    return colors[type];
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!model || !product) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Product not found</p>
        <Link
          href={`/models/${modelId}/products`}
          className="text-primary hover:underline"
        >
          Back to products
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/models/${modelId}/products`}
          className="flex h-10 w-10 items-center justify-center rounded-lg border hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{product.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={product.isActive ? 'default' : 'secondary'}>
              {product.isActive ? 'Active' : 'Inactive'}
            </Badge>
            <Badge variant="outline" className={getTypeColor(product.type)}>
              {product.type}
            </Badge>
          </div>
        </div>
      </div>

      {/* Product Info Form */}
      <div className="rounded-lg border bg-card p-6 space-y-6">
        <h2 className="text-lg font-semibold">Product Information</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ name: e.target.value })}
              placeholder="Product name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select
              value={formData.type}
              onValueChange={(v) => setFormData({ type: v as ProductType })}
            >
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="subscription">Subscription</SelectItem>
                <SelectItem value="content">Content Pack</SelectItem>
                <SelectItem value="ppv">Pay Per View</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ description: e.target.value })}
            placeholder="What's included in this product..."
            rows={3}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="price">Price *</Label>
            <Input
              id="price"
              type="number"
              min={0}
              step={0.01}
              value={formData.price || ''}
              onChange={(e) =>
                setFormData({ price: parseFloat(e.target.value) || 0 })
              }
              placeholder="29.90"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Select
              value={formData.currency}
              onValueChange={(v) =>
                setFormData({ currency: v as 'BRL' | 'USD' })
              }
            >
              <SelectTrigger id="currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BRL">BRL (R$)</SelectItem>
                <SelectItem value="USD">USD ($)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <div className="flex items-center gap-3 pb-2">
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
      </div>

      {/* Preview Images Section */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
            <ImageIcon className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Preview Images</h2>
            <p className="text-sm text-muted-foreground">
              These images are shown to users before they purchase. Use
              eye-catching previews that showcase the content.
            </p>
          </div>
        </div>

        <ProductPhotoUpload
          modelId={modelId}
          productId={productId}
          photos={product.previewImages || []}
          photoType="preview"
          onPhotosChange={refetch}
        />
      </div>

      {/* Content Photos Section (THE KEY FEATURE) */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
            <Lock className="h-5 w-5 text-green-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Content Photos</h2>
            <p className="text-sm text-muted-foreground">
              These are the actual photos delivered to the customer after
              purchase. They will receive these via Telegram after payment
              confirmation.
            </p>
          </div>
        </div>

        <ProductPhotoUpload
          modelId={modelId}
          productId={productId}
          photos={product.contentPhotos || []}
          photoType="content"
          onPhotosChange={refetch}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Product
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Product</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete &quot;{product.name}&quot;? This
                action cannot be undone. All associated photos will also be
                deleted.
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
          disabled={!hasChanges || updateProduct.isPending}
        >
          {updateProduct.isPending ? (
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
