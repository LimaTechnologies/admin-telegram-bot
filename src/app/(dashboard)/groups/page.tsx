'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Users, Settings, Trash2, MoreVertical, Search } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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

export default function GroupsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading, refetch } = trpc.group.list.useQuery({
    page,
    limit: 20,
    search: search || undefined,
  });

  const { data: stats } = trpc.group.getStats.useQuery();

  const deleteGroup = trpc.group.delete.useMutation({
    onSuccess: () => {
      toast.success('Group deleted');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const formatNumber = (num: number) =>
    new Intl.NumberFormat('en-US', { notation: 'compact' }).format(num);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns: Array<{ key: string; header: string; cell: (row: any) => React.ReactNode; className?: string }> = [
    {
      key: 'name',
      header: 'Group',
      cell: (row) => (
        <div>
          <div className="font-medium">{row.name}</div>
          {row.username && (
            <div className="text-sm text-muted-foreground">@{row.username}</div>
          )}
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      cell: (row) => (
        <Badge variant="outline" className="capitalize">
          {row.type}
        </Badge>
      ),
    },
    {
      key: 'members',
      header: 'Members',
      cell: (row) =>
        formatNumber(row.stats?.memberCount || 0),
    },
    {
      key: 'settings',
      header: 'Settings',
      cell: (row) => (
        <div className="text-sm">
          <div>{row.settings?.maxAdsPerDay || 0} ads/day</div>
          <div className="text-muted-foreground">
            {row.settings?.cooldownMinutes || 0}min cooldown
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <Badge variant={row.settings?.isActive ? 'default' : 'secondary'}>
          {row.settings?.isActive ? 'Active' : 'Inactive'}
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
            <DropdownMenuItem onClick={() => router.push(`/groups/${row._id}`)}>
              <Settings className="mr-2 h-4 w-4" />
              Edit Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => {
                if (confirm(`Delete group "${row.name}"?`)) {
                  deleteGroup.mutate({ id: row._id });
                }
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
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
          <h1 className="text-2xl font-bold">Telegram Groups</h1>
          <p className="text-muted-foreground">
            Manage your connected groups and their settings
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Group
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Telegram Group</DialogTitle>
              <DialogDescription>
                Add a new group to manage ads. Make sure the bot is added to the group first.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Telegram Group ID</Label>
                <Input placeholder="-1001234567890" />
              </div>
              <div className="space-y-2">
                <Label>Group Name</Label>
                <Input placeholder="Crypto Traders" />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select defaultValue="supergroup">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public Group</SelectItem>
                    <SelectItem value="private">Private Group</SelectItem>
                    <SelectItem value="supergroup">Supergroup</SelectItem>
                    <SelectItem value="channel">Channel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button>Add Group</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border/50 bg-card/80 p-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Total Groups</span>
          </div>
          <div className="mt-2 text-2xl font-bold">{stats?.totalGroups || 0}</div>
        </div>
        <div className="rounded-lg border border-border/50 bg-card/80 p-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-green-500" />
            <span className="text-sm text-muted-foreground">Active Groups</span>
          </div>
          <div className="mt-2 text-2xl font-bold">{stats?.activeGroups || 0}</div>
        </div>
        <div className="rounded-lg border border-border/50 bg-card/80 p-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-500" />
            <span className="text-sm text-muted-foreground">Total Members</span>
          </div>
          <div className="mt-2 text-2xl font-bold">
            {formatNumber(stats?.totalMembers || 0)}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search groups..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={data?.data || []}
        isLoading={isLoading}
        emptyMessage="No groups found. Add your first group to get started."
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
