'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc/client';
import type { ModelProduct, ProductType } from '$types/model';

interface ProductManagerProps {
  modelId: string;
  products: ModelProduct[];
  onProductsChange: () => void;
}

interface ProductFormData {
  name: string;
  description: string;
  type: ProductType;
  price: number;
  currency: 'BRL' | 'USD';
  isActive: boolean;
}

const defaultFormData: ProductFormData = {
  name: '',
  description: '',
  type: 'content',
  price: 0,
  currency: 'BRL',
  isActive: true,
};

export function ProductManager({ modelId, products, onProductsChange }: ProductManagerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ModelProduct | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(defaultFormData);

  const addProduct = trpc.model.addProduct.useMutation({
    onSuccess: () => {
      toast.success('Product added');
      setDialogOpen(false);
      resetForm();
      onProductsChange();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateProduct = trpc.model.updateProduct.useMutation({
    onSuccess: () => {
      toast.success('Product updated');
      setDialogOpen(false);
      resetForm();
      onProductsChange();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteProduct = trpc.model.deleteProduct.useMutation({
    onSuccess: () => {
      toast.success('Product deleted');
      onProductsChange();
    },
    onError: (e) => toast.error(e.message),
  });

  const resetForm = () => {
    setFormData(defaultFormData);
    setEditingProduct(null);
  };

  const openAddDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (product: ModelProduct) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      type: product.type,
      price: product.price,
      currency: product.currency,
      isActive: product.isActive,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name || formData.price < 0) {
      toast.error('Please fill all required fields');
      return;
    }

    if (editingProduct) {
      updateProduct.mutate({
        modelId,
        productId: editingProduct._id.toString(),
        data: formData,
      });
    } else {
      addProduct.mutate({
        modelId,
        product: {
          name: formData.name,
          description: formData.description || undefined,
          type: formData.type,
          price: formData.price,
          currency: formData.currency,
        },
      });
    }
  };

  const handleDelete = (productId: string) => {
    if (!confirm('Delete this product?')) return;
    deleteProduct.mutate({ modelId, productId });
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Products for Sale</h4>
        <Button variant="outline" size="sm" onClick={openAddDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Product
        </Button>
      </div>

      {products.length === 0 ? (
        <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          <Package className="mb-2 h-8 w-8" />
          No products yet. Add a product to start selling.
        </div>
      ) : (
        <div className="space-y-2">
          {products.map((product) => (
            <div
              key={product._id.toString()}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{product.name}</span>
                  <Badge variant={product.isActive ? 'default' : 'secondary'}>
                    {product.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  <Badge variant="outline">{getTypeLabel(product.type)}</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatPrice(product.price, product.currency)}
                  {product.description && ` • ${product.description.substring(0, 50)}...`}
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openEditDialog(product)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(product._id.toString())}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Edit Product' : 'Add Product'}
            </DialogTitle>
            <DialogDescription>
              {editingProduct
                ? 'Update product details'
                : 'Add a new product for this model'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                placeholder="Premium Content Pack"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="What's included in this product..."
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) =>
                    setFormData({ ...formData, type: v as ProductType })
                  }
                >
                  <SelectTrigger>
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

              <div className="space-y-2">
                <Label>Currency</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(v) =>
                    setFormData({ ...formData, currency: v as 'BRL' | 'USD' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BRL">BRL (R$)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Price *</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                placeholder="29.90"
                value={formData.price || ''}
                onChange={(e) =>
                  setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })
                }
              />
            </div>

            {editingProduct && (
              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isActive: checked })
                  }
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={addProduct.isPending || updateProduct.isPending}
            >
              {editingProduct ? 'Update' : 'Add'} Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
