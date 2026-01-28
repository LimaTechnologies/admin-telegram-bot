'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  RefreshCw,
  Users,
  Settings,
  Trash2,
  MoreVertical,
  Search,
  Send,
  Bot,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Plus,
} from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';

export default function GroupsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [testMessageOpen, setTestMessageOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<{
    id: string;
    name: string;
    telegramId: string;
  } | null>(null);
  const [testMessage, setTestMessage] = useState(
    '🧪 Test message from Admin Dashboard\n\nThis is a test message to verify bot connectivity.'
  );
  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [newGroupId, setNewGroupId] = useState('');

  const { data, isLoading, refetch } = trpc.group.list.useQuery({
    page,
    limit: 20,
    search: search || undefined,
  });

  const { data: stats } = trpc.group.getStats.useQuery();
  const { data: botStatus } = trpc.botAdmin.getStatus.useQuery();

  const deleteGroup = trpc.group.delete.useMutation({
    onSuccess: () => {
      toast.success('Group deleted');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const discoverGroups = trpc.group.discoverFromBot.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const syncAll = trpc.group.syncAll.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const syncGroup = trpc.group.syncGroup.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const sendTestMessage = trpc.group.testMessage.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setTestMessageOpen(false);
      setTestMessage(
        '🧪 Test message from Admin Dashboard\n\nThis is a test message to verify bot connectivity.'
      );
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const addGroup = trpc.group.addByTelegramId.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setAddGroupOpen(false);
      setNewGroupId('');
      // Refetch after a short delay to allow the queue job to process
      setTimeout(() => refetch(), 2000);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const formatNumber = (num: number) =>
    new Intl.NumberFormat('en-US', { notation: 'compact' }).format(num);

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return 'Never';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  const handleSendTestMessage = () => {
    if (!selectedGroup || !testMessage.trim()) {
      toast.error('Please enter a message');
      return;
    }
    sendTestMessage.mutate({
      groupId: selectedGroup.id,
      text: testMessage,
    });
  };

  const columns: Array<{
    key: string;
    header: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cell: (row: any) => React.ReactNode;
    className?: string;
  }> = [
    {
      key: 'name',
      header: 'Group',
      cell: (row) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{row.name}</span>
            {row.isAutoDiscovered && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="outline" className="text-xs">
                      <Bot className="h-3 w-3 mr-1" />
                      Auto
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Auto-discovered by bot</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
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
      cell: (row) => formatNumber(row.stats?.memberCount || 0),
    },
    {
      key: 'permissions',
      header: 'Bot Permissions',
      cell: (row) => {
        const perms = row.botPermissions;
        if (!perms) {
          return (
            <Badge variant="destructive" className="text-xs">
              <XCircle className="h-3 w-3 mr-1" />
              Not Admin
            </Badge>
          );
        }
        return (
          <div className="flex gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge
                    variant={perms.canPostMessages ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {perms.canPostMessages ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <XCircle className="h-3 w-3" />
                    )}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {perms.canPostMessages ? 'Can post' : 'Cannot post'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge
                    variant={perms.canDeleteMessages ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {perms.canDeleteMessages
                      ? 'Can delete'
                      : 'Cannot delete'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        );
      },
    },
    {
      key: 'lastSync',
      header: 'Last Sync',
      cell: (row) => (
        <div className="text-sm text-muted-foreground">
          <Clock className="inline h-3 w-3 mr-1" />
          {formatDate(row.lastSyncAt)}
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
            <DropdownMenuItem
              onClick={() => {
                setSelectedGroup({
                  id: row._id,
                  name: row.name,
                  telegramId: row.telegramId,
                });
                setTestMessageOpen(true);
              }}
            >
              <Send className="mr-2 h-4 w-4" />
              Send Test Message
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => syncGroup.mutate({ telegramId: row.telegramId })}
              disabled={syncGroup.isPending}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync Group
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push(`/groups/${row._id}`)}>
              <Settings className="mr-2 h-4 w-4" />
              Edit Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
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
            Manage groups where the bot is an administrator
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setAddGroupOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Group
          </Button>
          <Button
            variant="outline"
            onClick={() => syncAll.mutate()}
            disabled={syncAll.isPending}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${syncAll.isPending ? 'animate-spin' : ''}`}
            />
            Sync All
          </Button>
          <Button
            onClick={() => discoverGroups.mutate()}
            disabled={discoverGroups.isPending}
          >
            <Zap
              className={`mr-2 h-4 w-4 ${discoverGroups.isPending ? 'animate-pulse' : ''}`}
            />
            Discover Groups
          </Button>
        </div>
      </div>

      {/* Bot Status Banner */}
      {botStatus && (
        <div
          className={`rounded-lg border p-4 ${
            botStatus.isConfigured && botStatus.isActive
              ? 'border-green-500/50 bg-green-500/10'
              : 'border-yellow-500/50 bg-yellow-500/10'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bot
                className={`h-5 w-5 ${
                  botStatus.isConfigured && botStatus.isActive
                    ? 'text-green-500'
                    : 'text-yellow-500'
                }`}
              />
              <div>
                <p className="font-medium">
                  {botStatus.isConfigured
                    ? `@${botStatus.username}`
                    : 'Bot Not Configured'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {botStatus.isActive
                    ? 'Online and ready'
                    : botStatus.emergencyStop
                      ? 'Emergency stop active'
                      : 'Bot is inactive'}
                </p>
              </div>
            </div>
            {botStatus.isConfigured && (
              <Badge variant={botStatus.isActive ? 'default' : 'secondary'}>
                {botStatus.isActive ? 'Online' : 'Offline'}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
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
            <Bot className="h-4 w-4 text-blue-500" />
            <span className="text-sm text-muted-foreground">Auto-Discovered</span>
          </div>
          <div className="mt-2 text-2xl font-bold">
            {stats?.autoDiscovered || 0}
          </div>
        </div>
        <div className="rounded-lg border border-border/50 bg-card/80 p-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-purple-500" />
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
        emptyMessage="No groups found. Click 'Discover Groups' to find groups where the bot is admin."
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

      {/* Test Message Dialog */}
      <Dialog open={testMessageOpen} onOpenChange={setTestMessageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Test Message</DialogTitle>
            <DialogDescription>
              Send a test message to {selectedGroup?.name} to verify bot
              connectivity.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Message (HTML supported)</Label>
              <Textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                rows={5}
                placeholder="Enter your test message..."
              />
            </div>
            <div className="text-sm text-muted-foreground">
              <p>
                <strong>Group ID:</strong> {selectedGroup?.telegramId}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestMessageOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSendTestMessage}
              disabled={sendTestMessage.isPending || !testMessage.trim()}
            >
              {sendTestMessage.isPending ? 'Sending...' : 'Send Message'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Group Dialog */}
      <Dialog open={addGroupOpen} onOpenChange={setAddGroupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Group by Telegram ID</DialogTitle>
            <DialogDescription>
              Enter the Telegram group/channel ID to add it manually. Make sure the bot is an admin in the group.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="telegramId">Telegram ID</Label>
              <Input
                id="telegramId"
                value={newGroupId}
                onChange={(e) => setNewGroupId(e.target.value)}
                placeholder="e.g., -1001234567890"
              />
              <p className="text-xs text-muted-foreground">
                Groups have negative IDs (e.g., -1001234567890). Channels also use negative IDs.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddGroupOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!newGroupId.trim()) {
                  toast.error('Please enter a Telegram ID');
                  return;
                }
                addGroup.mutate({ telegramId: newGroupId.trim() });
              }}
              disabled={addGroup.isPending || !newGroupId.trim()}
            >
              <Plus className="mr-2 h-4 w-4" />
              {addGroup.isPending ? 'Adding...' : 'Add Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
