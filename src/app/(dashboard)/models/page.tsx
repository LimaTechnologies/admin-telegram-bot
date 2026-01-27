'use client';

import { useState } from 'react';
import { Heart, Plus, MoreVertical, Search, TrendingUp } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

export default function ModelsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [tierFilter, setTierFilter] = useState<'bronze' | 'silver' | 'gold' | 'platinum' | 'all'>('all');

  const { data, isLoading, refetch } = trpc.model.list.useQuery({
    page,
    limit: 20,
    search: search || undefined,
    tier: tierFilter === 'all' ? undefined : tierFilter,
  });

  const { data: stats } = trpc.model.getStats.useQuery();

  const deleteModel = trpc.model.delete.useMutation({
    onSuccess: () => {
      toast.success('Model deleted');
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  const getTierColor = (tier: string) => {
    const colors: Record<string, string> = {
      bronze: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
      silver: 'bg-gray-400/10 text-gray-400 border-gray-400/20',
      gold: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      platinum: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
    };
    return colors[tier] || colors['bronze'];
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns: Array<{ key: string; header: string; cell: (row: any) => React.ReactNode; className?: string }> = [
    {
      key: 'name',
      header: 'Model',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-pink-500/10 text-pink-500">
              {row.name?.charAt(0) || 'M'}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium">{row.name}</div>
            <div className="text-sm text-muted-foreground">@{row.username}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'tier',
      header: 'Tier',
      cell: (row) => (
        <Badge variant="outline" className={`capitalize ${getTierColor(row.tier)}`}>
          {row.tier}
        </Badge>
      ),
    },
    {
      key: 'niche',
      header: 'Niche',
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          {(row.niche || []).slice(0, 2).map((n: string) => (
            <Badge key={n} variant="secondary" className="text-xs">
              {n}
            </Badge>
          ))}
          {(row.niche || []).length > 2 && (
            <Badge variant="secondary" className="text-xs">
              +{row.niche.length - 2}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'performance',
      header: 'Performance',
      cell: (row) => (
        <div className="text-sm">
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-green-500" />
            {(row.performance?.conversionRate || 0).toFixed(1)}% CVR
          </div>
          <div className="text-muted-foreground">
            {formatCurrency(row.performance?.totalRevenue || 0)}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <Badge variant={row.isActive ? 'default' : 'secondary'}>
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      cell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>View Profile</DropdownMenuItem>
            <DropdownMenuItem>View Campaigns</DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => {
                if (confirm(`Delete model "${row.name}"?`)) {
                  deleteModel.mutate({ id: row._id });
                }
              }}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      className: 'w-12',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">OnlyFans Models</h1>
          <p className="text-muted-foreground">
            Manage your OnlyFans model partnerships
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Model
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {['platinum', 'gold', 'silver', 'bronze'].map((tier) => (
          <Card key={tier} className="bg-card/80 border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium capitalize">{tier}</CardTitle>
              <Heart className="h-4 w-4 text-pink-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.[tier]?.count || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(stats?.[tier]?.totalRevenue || 0)} revenue
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search models..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={tierFilter}
          onValueChange={(v) => setTierFilter(v as typeof tierFilter)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tiers</SelectItem>
            <SelectItem value="platinum">Platinum</SelectItem>
            <SelectItem value="gold">Gold</SelectItem>
            <SelectItem value="silver">Silver</SelectItem>
            <SelectItem value="bronze">Bronze</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data?.data || []}
        isLoading={isLoading}
        emptyMessage="No models found. Add your first model to get started."
      />

      {data && data.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="flex items-center px-4 text-sm text-muted-foreground">
            Page {page} of {data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            disabled={page === data.totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
