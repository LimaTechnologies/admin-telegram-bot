'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Plus,
  Play,
  Pause,
  MoreVertical,
  Search,
} from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { format } from 'date-fns';

type CampaignStatus = 'draft' | 'active' | 'paused' | 'scheduled' | 'ended';
type CampaignType = 'onlyfans' | 'casino';

export default function CampaignsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<CampaignType | 'all'>('all');
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = trpc.campaign.list.useQuery({
    page,
    limit: 20,
    search: search || undefined,
    status: statusFilter === 'all' ? undefined : statusFilter,
    type: typeFilter === 'all' ? undefined : typeFilter,
  });

  const { data: stats } = trpc.campaign.getStats.useQuery();

  const startCampaign = trpc.campaign.start.useMutation({
    onSuccess: () => {
      toast.success('Campaign started');
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const pauseCampaign = trpc.campaign.pause.useMutation({
    onSuccess: () => {
      toast.success('Campaign paused');
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteCampaign = trpc.campaign.delete.useMutation({
    onSuccess: () => {
      toast.success('Campaign deleted');
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const getStatusBadge = (status: CampaignStatus) => {
    const variants: Record<CampaignStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      active: 'default',
      paused: 'secondary',
      draft: 'outline',
      scheduled: 'outline',
      ended: 'secondary',
    };
    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  const getTypeBadge = (type: CampaignType) => {
    const colors = {
      onlyfans: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
      casino: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    };
    return (
      <Badge variant="outline" className={colors[type]}>
        {type === 'onlyfans' ? 'OnlyFans' : 'Casino'}
      </Badge>
    );
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns: Array<{ key: string; header: string; cell: (row: any) => React.ReactNode; className?: string }> = [
    {
      key: 'name',
      header: 'Campaign',
      cell: (row) => (
        <div>
          <div className="font-medium">{row.name}</div>
          {row.description && (
            <div className="text-sm text-muted-foreground line-clamp-1">
              {row.description}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      cell: (row) => getTypeBadge(row.type),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => getStatusBadge(row.status),
    },
    {
      key: 'schedule',
      header: 'Schedule',
      cell: (row) => (
        <div className="text-sm">
          <div>{format(new Date(row.schedule.startDate), 'MMM d, yyyy')}</div>
          {row.schedule.endDate && (
            <div className="text-muted-foreground">
              to {format(new Date(row.schedule.endDate), 'MMM d')}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'performance',
      header: 'Performance',
      cell: (row) => (
        <div className="text-sm">
          <div>{row.performance?.totalPosts || 0} posts</div>
          <div className="text-muted-foreground">
            {formatCurrency(row.performance?.totalRevenue || 0)}
          </div>
        </div>
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
            <DropdownMenuItem onClick={() => router.push(`/campaigns/${row._id}`)}>
              View Details
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {row.status === 'active' ? (
              <DropdownMenuItem onClick={() => pauseCampaign.mutate({ id: row._id })}>
                <Pause className="mr-2 h-4 w-4" />
                Pause
              </DropdownMenuItem>
            ) : row.status !== 'ended' ? (
              <DropdownMenuItem onClick={() => startCampaign.mutate({ id: row._id })}>
                <Play className="mr-2 h-4 w-4" />
                Start
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => {
                if (confirm(`Delete campaign "${row.name}"?`)) {
                  deleteCampaign.mutate({ id: row._id });
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <p className="text-muted-foreground">
            Create and manage your advertising campaigns
          </p>
        </div>
        <Link href="/campaigns/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Campaign
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-border/50 bg-card/80 p-4">
          <div className="text-sm text-muted-foreground">Total</div>
          <div className="mt-1 text-2xl font-bold">{stats?.total || 0}</div>
        </div>
        <div className="rounded-lg border border-border/50 bg-card/80 p-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm text-muted-foreground">Active</span>
          </div>
          <div className="mt-1 text-2xl font-bold">{stats?.active || 0}</div>
        </div>
        <div className="rounded-lg border border-border/50 bg-card/80 p-4">
          <div className="text-sm text-muted-foreground">Total Posts</div>
          <div className="mt-1 text-2xl font-bold">{stats?.totalPosts || 0}</div>
        </div>
        <div className="rounded-lg border border-border/50 bg-card/80 p-4">
          <div className="text-sm text-muted-foreground">Total Revenue</div>
          <div className="mt-1 text-2xl font-bold">
            {formatCurrency(stats?.totalRevenue || 0)}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as CampaignStatus | 'all')}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="ended">Ended</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(v as CampaignType | 'all')}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="onlyfans">OnlyFans</SelectItem>
            <SelectItem value="casino">Casino</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={data?.data || []}
        isLoading={isLoading}
        emptyMessage="No campaigns found. Create your first campaign to get started."
        onRowClick={(row) => router.push(`/campaigns/${row._id}`)}
      />

      {/* Pagination */}
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
