'use client';

import { useState } from 'react';
import { Dice5, Plus, MoreVertical, Search, Globe, AlertTriangle } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

export default function CasinosPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [riskFilter, setRiskFilter] = useState<'low' | 'medium' | 'high' | 'all'>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    websiteUrl: '',
    riskLevel: 'medium' as 'low' | 'medium' | 'high',
    funnelStyle: 'direct' as 'direct' | 'landing' | 'chatbot',
    welcomeBonus: '',
  });

  const { data, isLoading, refetch } = trpc.casino.list.useQuery({
    page,
    limit: 20,
    search: search || undefined,
    riskLevel: riskFilter === 'all' ? undefined : riskFilter,
  });

  const { data: stats } = trpc.casino.getStats.useQuery();

  const createCasino = trpc.casino.create.useMutation({
    onSuccess: () => {
      toast.success('Casino created successfully');
      setCreateOpen(false);
      setFormData({ name: '', brand: '', websiteUrl: '', riskLevel: 'medium', funnelStyle: 'direct', welcomeBonus: '' });
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteCasino = trpc.casino.delete.useMutation({
    onSuccess: () => {
      toast.success('Casino deleted');
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const handleCreateCasino = () => {
    if (!formData.name || !formData.brand || !formData.websiteUrl) {
      toast.error('Please fill all required fields');
      return;
    }
    createCasino.mutate(formData);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  const getRiskColor = (risk: string) => {
    const colors: Record<string, string> = {
      low: 'bg-green-500/10 text-green-500 border-green-500/20',
      medium: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      high: 'bg-red-500/10 text-red-500 border-red-500/20',
    };
    return colors[risk] || colors['medium'];
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns: Array<{ key: string; header: string; cell: (row: any) => React.ReactNode; className?: string }> = [
    {
      key: 'name',
      header: 'Casino',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-yellow-500/10 flex items-center justify-center">
            <Dice5 className="h-5 w-5 text-yellow-500" />
          </div>
          <div>
            <div className="font-medium">{row.name}</div>
            <div className="text-sm text-muted-foreground">{row.brand}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'risk',
      header: 'Risk Level',
      cell: (row) => (
        <Badge variant="outline" className={`capitalize ${getRiskColor(row.riskLevel)}`}>
          {row.riskLevel}
        </Badge>
      ),
    },
    {
      key: 'geo',
      header: 'Geo Targeting',
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Globe className="h-3 w-3 text-muted-foreground" />
          <span className="text-sm">
            {(row.geoTargeting || []).slice(0, 3).join(', ')}
            {(row.geoTargeting || []).length > 3 && '...'}
          </span>
        </div>
      ),
    },
    {
      key: 'funnel',
      header: 'Funnel',
      cell: (row) => (
        <Badge variant="secondary" className="capitalize">
          {row.funnelStyle || 'direct'}
        </Badge>
      ),
    },
    {
      key: 'performance',
      header: 'Performance',
      cell: (row) => (
        <div className="text-sm">
          <div>{(row.performance?.conversionRate || 0).toFixed(1)}% CVR</div>
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
            <DropdownMenuItem>View Details</DropdownMenuItem>
            <DropdownMenuItem>View Campaigns</DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => {
                if (confirm(`Delete casino "${row.name}"?`)) {
                  deleteCasino.mutate({ id: row._id });
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
          <h1 className="text-2xl font-bold">Casino Management</h1>
          <p className="text-muted-foreground">
            Manage your casino brand partnerships
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Casino
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Casino</DialogTitle>
              <DialogDescription>
                Add a new casino brand partnership.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  placeholder="Lucky Casino"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Brand *</Label>
                <Input
                  placeholder="Lucky Gaming Ltd"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Website URL *</Label>
                <Input
                  placeholder="https://luckycasino.com"
                  value={formData.websiteUrl}
                  onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Risk Level</Label>
                  <Select
                    value={formData.riskLevel}
                    onValueChange={(v) => setFormData({ ...formData, riskLevel: v as typeof formData.riskLevel })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Funnel Style</Label>
                  <Select
                    value={formData.funnelStyle}
                    onValueChange={(v) => setFormData({ ...formData, funnelStyle: v as typeof formData.funnelStyle })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="direct">Direct</SelectItem>
                      <SelectItem value="landing">Landing Page</SelectItem>
                      <SelectItem value="chatbot">Chatbot</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Welcome Bonus</Label>
                <Input
                  placeholder="100% up to $500"
                  value={formData.welcomeBonus}
                  onChange={(e) => setFormData({ ...formData, welcomeBonus: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateCasino} disabled={createCasino.isPending}>
                {createCasino.isPending ? 'Creating...' : 'Add Casino'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card/80 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Casinos</CardTitle>
            <Dice5 className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats?.low?.count || 0) + (stats?.medium?.count || 0) + (stats?.high?.count || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Active partnerships</p>
          </CardContent>
        </Card>
        <Card className="bg-green-500/10 border-green-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-500">Low Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.low?.count || 0}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(stats?.low?.totalRevenue || 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-yellow-500/10 border-yellow-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-500">Medium Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.medium?.count || 0}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(stats?.medium?.totalRevenue || 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-red-500/10 border-red-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-red-500">High Risk</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.high?.count || 0}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(stats?.high?.totalRevenue || 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search casinos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={riskFilter}
          onValueChange={(v) => setRiskFilter(v as typeof riskFilter)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Risk Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Risks</SelectItem>
            <SelectItem value="low">Low Risk</SelectItem>
            <SelectItem value="medium">Medium Risk</SelectItem>
            <SelectItem value="high">High Risk</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data?.data || []}
        isLoading={isLoading}
        emptyMessage="No casinos found. Add your first casino to get started."
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
