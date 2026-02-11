'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  Plus,
  Package,
  Image as ImageIcon,
  Lock,
  ChevronRight,
  X,
} from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import type { ProductType, ModelProduct } from '$types/model';

interface ProductsPageProps {
  params: Promise<{ id: string }>;
}

interface ProductFormData {
  name: string;
  description: string;
  type: ProductType;
  price: number;
  currency: 'BRL' | 'USD';
}

const defaultFormData: ProductFormData = {
  name: '',
  description: '',
  type: 'content',
  price: 0,
  currency: 'BRL',
};

export default function ProductsPage({ params }: ProductsPageProps) {
  const { id } = React.use(params);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<ProductFormData>(defaultFormData);

  const { data: model, isLoading, refetch } = trpc.model.getById.useQuery(
    { id },
    { enabled: !!id }
  );

  const addProduct = trpc.model.addProduct.useMutation({
    onSuccess: () => {
      toast.success('Product added');
      setShowAddForm(false);
      setFormData(defaultFormData);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteProduct = trpc.model.deleteProduct.useMutation({
    onSuccess: () => {
      toast.success('Product deleted');
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || formData.price < 0) {
      toast.error('Please fill all required fields');
      return;
    }
    addProduct.mutate({
      modelId: id,
      product: {
        name: formData.name,
        description: formData.description || undefined,
        type: formData.type,
        price: formData.price,
        currency: formData.currency,
      },
    });
  };

  const handleDelete = (productId: string, productName: string) => {
    if (!confirm(`Delete "${productName}"?`)) return;
    deleteProduct.mutate({ modelId: id, productId });
  };

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency,
    }).format(price);
  };

  const getTypeLabel = (type: ProductType) => {
    const labels: Record<ProductType, string> = {
      subscription: 'Subscription',
      content: 'Content Pack',
      ppv: 'Pay Per View',
      custom: 'Custom',
    };
    return labels[type];
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

  if (!model) {
    return null;
  }

  const products = model.products || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Products</h2>
          <p className="text-sm text-muted-foreground">
            Manage products available for purchase
          </p>
        </div>
        {!showAddForm && (
          <Button onClick={() => setShowAddForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        )}
      </div>

      {/* Add Product Form (Inline) */}
      {showAddForm && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">New Product</h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowAddForm(false);
                    setFormData(defaultFormData);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    placeholder="Premium Content Pack"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(v) =>
                      setFormData({ ...formData, type: v as ProductType })
                    }
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
                  placeholder="What's included in this product..."
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={2}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="price">Price *</Label>
                  <Input
                    id="price"
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="29.90"
                    value={formData.price || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        price: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(v) =>
                      setFormData({ ...formData, currency: v as 'BRL' | 'USD' })
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
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddForm(false);
                    setFormData(defaultFormData);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={addProduct.isPending}>
                  {addProduct.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Add Product
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Products Grid */}
      {products.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center rounded-lg border border-dashed">
          <Package className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">No products yet</p>
          <p className="text-sm text-muted-foreground">
            Add a product to start selling
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product: ModelProduct) => (
            <ProductCard
              key={product._id.toString()}
              product={product}
              modelId={id}
              formatPrice={formatPrice}
              getTypeLabel={getTypeLabel}
              getTypeColor={getTypeColor}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ProductCardProps {
  product: ModelProduct;
  modelId: string;
  formatPrice: (price: number, currency: string) => string;
  getTypeLabel: (type: ProductType) => string;
  getTypeColor: (type: ProductType) => string;
  onDelete: (productId: string, productName: string) => void;
}

function ProductCard({
  product,
  modelId,
  formatPrice,
  getTypeLabel,
  getTypeColor,
  onDelete,
}: ProductCardProps) {
  const previewCount = product.previewImages?.length || 0;
  const contentCount = product.contentPhotos?.length || 0;

  return (
    <Card className="group relative overflow-hidden transition-shadow hover:shadow-md">
      <Link href={`/models/${modelId}/products/${product._id}`}>
        <CardContent className="p-4">
          {/* Preview Image or Placeholder */}
          <div className="mb-3 aspect-video overflow-hidden rounded-lg bg-muted">
            {previewCount > 0 ? (
              <img
                src={product.previewImages?.[0] || ''}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-2">
            <div className="flex items-start justify-between">
              <h3 className="font-medium line-clamp-1">{product.name}</h3>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </div>

            <div className="flex items-center gap-2">
              <span className="font-semibold">
                {formatPrice(product.price, product.currency)}
              </span>
              <Badge variant="outline" className={getTypeColor(product.type)}>
                {getTypeLabel(product.type)}
              </Badge>
            </div>

            {/* Photo Counts */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <ImageIcon className="h-3 w-3" />
                {previewCount} preview
              </span>
              <span className="flex items-center gap-1">
                <Lock className="h-3 w-3" />
                {contentCount} content
              </span>
            </div>

            {/* Status */}
            <Badge variant={product.isActive ? 'default' : 'secondary'}>
              {product.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </CardContent>
      </Link>

      {/* Delete Button (appears on hover) */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete(product._id.toString(), product.name);
        }}
        className="absolute right-2 top-2 rounded-full bg-destructive/90 p-1.5 text-destructive-foreground opacity-0 transition-opacity hover:bg-destructive group-hover:opacity-100"
        title="Delete product"
      >
        <X className="h-3 w-3" />
      </button>
    </Card>
  );
}
