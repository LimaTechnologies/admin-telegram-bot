'use client';

import { useState } from 'react';
import {
  Activity,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Bot,
  Zap,
  Calendar,
  Send,
} from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

type JobStatus = 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';

export default function QueueMonitorPage() {
  const [selectedQueue, setSelectedQueue] = useState<string>('bot-tasks');
  const [jobStatus, setJobStatus] = useState<JobStatus>('waiting');
  const [page, setPage] = useState(1);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleData, setScheduleData] = useState({
    chatId: '',
    text: '',
    scheduledAt: '',
  });

  const { data: allStats, isLoading: loadingStats, refetch: refetchStats } = trpc.queue.getAllStats.useQuery(
    undefined,
    { refetchInterval: 5000 }
  );

  const { data: jobsData, isLoading: loadingJobs, refetch: refetchJobs } = trpc.queue.getJobs.useQuery(
    { queueName: selectedQueue, status: jobStatus, page, limit: 10 },
    { refetchInterval: 3000 }
  );

  const { data: botQueueStats } = trpc.botAdmin.getQueueStats.useQuery(
    undefined,
    { refetchInterval: 5000 }
  );

  const pauseQueue = trpc.queue.pauseQueue.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetchStats();
    },
    onError: (error) => toast.error(error.message),
  });

  const resumeQueue = trpc.queue.resumeQueue.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetchStats();
    },
    onError: (error) => toast.error(error.message),
  });

  const retryJob = trpc.queue.retryJob.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetchJobs();
    },
    onError: (error) => toast.error(error.message),
  });

  const removeJob = trpc.queue.removeJob.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetchJobs();
    },
    onError: (error) => toast.error(error.message),
  });

  const retryAllFailed = trpc.queue.retryAllFailed.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetchJobs();
    },
    onError: (error) => toast.error(error.message),
  });

  const cleanQueue = trpc.queue.cleanQueue.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetchStats();
      refetchJobs();
    },
    onError: (error) => toast.error(error.message),
  });

  const forceSendJob = trpc.queue.forceSendJob.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetchJobs();
    },
    onError: (error) => toast.error(error.message),
  });

  const scheduleMessage = trpc.queue.scheduleMessage.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setScheduleOpen(false);
      setScheduleData({ chatId: '', text: '', scheduledAt: '' });
      refetchJobs();
    },
    onError: (error) => toast.error(error.message),
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Activity className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'waiting':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'delayed':
        return <Clock className="h-4 w-4 text-orange-500" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'completed':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'failed':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'waiting':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'delayed':
        return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const formatTimestamp = (timestamp: number | undefined) => {
    if (!timestamp) return 'N/A';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(timestamp));
  };

  // Calculate totals
  const totalWaiting = allStats?.reduce((sum, q) => sum + q.waiting, 0) || 0;
  const totalActive = allStats?.reduce((sum, q) => sum + q.active, 0) || 0;
  const totalCompleted = allStats?.reduce((sum, q) => sum + q.completed, 0) || 0;
  const totalFailed = allStats?.reduce((sum, q) => sum + q.failed, 0) || 0;

  const currentQueueStats = allStats?.find(q => q.name === selectedQueue);
  const isPaused = currentQueueStats?.paused || false;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Queue Monitor</h1>
          <p className="text-muted-foreground">Monitor and manage background job queues</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setScheduleOpen(true)}
          >
            <Calendar className="mr-2 h-4 w-4" />
            Schedule Message
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchStats();
              refetchJobs();
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card/80 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Waiting</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{totalWaiting}</div>
            <p className="text-xs text-muted-foreground">Jobs in queue</p>
          </CardContent>
        </Card>
        <Card className="bg-card/80 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{totalActive}</div>
            <p className="text-xs text-muted-foreground">Processing now</p>
          </CardContent>
        </Card>
        <Card className="bg-card/80 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{totalCompleted}</div>
            <p className="text-xs text-muted-foreground">Successfully processed</p>
          </CardContent>
        </Card>
        <Card className="bg-card/80 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{totalFailed}</div>
            <p className="text-xs text-muted-foreground">Needs attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Bot Tasks Queue Highlight */}
      {botQueueStats && (
        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-blue-500" />
                <CardTitle className="text-lg">Bot Tasks Queue</CardTitle>
              </div>
              <Badge variant="outline" className={botQueueStats.active > 0 ? 'bg-blue-500/10 text-blue-500' : ''}>
                {botQueueStats.active > 0 ? 'Processing' : 'Idle'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Waiting:</span>
                <span className="ml-2 font-bold text-yellow-500">{botQueueStats.waiting}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Active:</span>
                <span className="ml-2 font-bold text-blue-500">{botQueueStats.active}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Completed:</span>
                <span className="ml-2 font-bold text-green-500">{botQueueStats.completed}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Failed:</span>
                <span className="ml-2 font-bold text-red-500">{botQueueStats.failed}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Delayed:</span>
                <span className="ml-2 font-bold text-orange-500">{botQueueStats.delayed}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Queue Status */}
        <Card className="bg-card/80 border-border/50">
          <CardHeader>
            <CardTitle>All Queues</CardTitle>
            <CardDescription>Overview of all job queues</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                {allStats?.map((queue) => (
                  <div
                    key={queue.name}
                    className={`p-4 rounded-lg bg-muted/30 cursor-pointer transition-colors ${
                      selectedQueue === queue.name ? 'ring-2 ring-primary' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedQueue(queue.name)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium font-mono text-sm">{queue.name}</span>
                      <div className="flex items-center gap-2">
                        {queue.paused && (
                          <Badge variant="outline" className="bg-orange-500/10 text-orange-500">
                            Paused
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={queue.active > 0 ? 'bg-blue-500/10 text-blue-500' : ''}
                        >
                          {queue.active > 0 ? 'Processing' : 'Idle'}
                        </Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Wait:</span>
                        <span className="ml-1 font-medium text-yellow-500">{queue.waiting}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Active:</span>
                        <span className="ml-1 font-medium text-blue-500">{queue.active}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Done:</span>
                        <span className="ml-1 font-medium text-green-500">{queue.completed}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Fail:</span>
                        <span className="ml-1 font-medium text-red-500">{queue.failed}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Queue Actions & Jobs */}
        <Card className="bg-card/80 border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-mono">{selectedQueue}</CardTitle>
                <CardDescription>Manage queue and view jobs</CardDescription>
              </div>
              <div className="flex gap-2">
                {isPaused ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => resumeQueue.mutate({ queueName: selectedQueue })}
                    disabled={resumeQueue.isPending}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Resume
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => pauseQueue.mutate({ queueName: selectedQueue })}
                    disabled={pauseQueue.isPending}
                  >
                    <Pause className="mr-2 h-4 w-4" />
                    Pause
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Queue Actions */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => retryAllFailed.mutate({ queueName: selectedQueue })}
                disabled={retryAllFailed.isPending || (currentQueueStats?.failed || 0) === 0}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Retry All Failed
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => cleanQueue.mutate({ queueName: selectedQueue, status: 'completed' })}
                disabled={cleanQueue.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clean Completed
              </Button>
            </div>

            {/* Job Status Filter */}
            <div className="flex items-center gap-4">
              <Select value={jobStatus} onValueChange={(v) => setJobStatus(v as JobStatus)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="waiting">Waiting</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="delayed">Delayed</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">
                {jobsData?.total || 0} jobs
              </span>
            </div>

            {/* Jobs List */}
            {loadingJobs ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {jobsData?.data.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No {jobStatus} jobs
                  </div>
                ) : (
                  jobsData?.data.map((job) => (
                    <div key={job.id} className="p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(jobStatus)}
                          <span className="font-medium text-sm font-mono">
                            {job.name || 'Unknown'}
                          </span>
                        </div>
                        <Badge variant="outline" className={getStatusColor(jobStatus)}>
                          {job.id}
                        </Badge>
                      </div>

                      {/* Job Data Preview */}
                      {job.data && (
                        <div className="text-xs text-muted-foreground mb-2 font-mono bg-muted/50 p-2 rounded max-h-20 overflow-auto">
                          {JSON.stringify(job.data, null, 2).slice(0, 200)}
                          {JSON.stringify(job.data).length > 200 && '...'}
                        </div>
                      )}

                      {/* Progress */}
                      {jobStatus === 'active' && typeof job.progress === 'number' && (
                        <Progress value={job.progress} className="h-1 mb-2" />
                      )}

                      {/* Error */}
                      {job.failedReason && (
                        <div className="text-xs text-red-500 mb-2 bg-red-500/10 p-2 rounded">
                          {job.failedReason}
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(job.timestamp)}
                        </span>
                        {jobStatus === 'failed' && (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() =>
                                retryJob.mutate({
                                  queueName: selectedQueue,
                                  jobId: job.id || '',
                                })
                              }
                              disabled={retryJob.isPending}
                            >
                              <RotateCcw className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive"
                              onClick={() =>
                                removeJob.mutate({
                                  queueName: selectedQueue,
                                  jobId: job.id || '',
                                })
                              }
                              disabled={removeJob.isPending}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                        {jobStatus === 'delayed' && (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs gap-1 text-green-500 hover:text-green-600 hover:bg-green-500/10"
                              onClick={() =>
                                forceSendJob.mutate({
                                  queueName: selectedQueue,
                                  jobId: job.id || '',
                                })
                              }
                              disabled={forceSendJob.isPending}
                            >
                              <Zap className="h-3 w-3" />
                              Force Send
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive"
                              onClick={() =>
                                removeJob.mutate({
                                  queueName: selectedQueue,
                                  jobId: job.id || '',
                                })
                              }
                              disabled={removeJob.isPending}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Pagination */}
            {jobsData && jobsData.totalPages > 1 && (
              <div className="flex justify-center gap-2 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <span className="flex items-center px-4 text-sm text-muted-foreground">
                  {page} / {jobsData.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(jobsData.totalPages, p + 1))}
                  disabled={page === jobsData.totalPages}
                >
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Queue Configuration */}
      <Card className="bg-card/80 border-border/50">
        <CardHeader>
          <CardTitle>Queue Configuration</CardTitle>
          <CardDescription>Current rate limiting and processing settings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg bg-muted/30">
              <div className="font-medium mb-2">Per-Group Rate Limit</div>
              <div className="text-2xl font-bold">1 msg / 5 min</div>
              <p className="text-sm text-muted-foreground">Cooldown between posts to same group</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/30">
              <div className="font-medium mb-2">Telegram API Limit</div>
              <div className="text-2xl font-bold">30 msg / sec</div>
              <p className="text-sm text-muted-foreground">Global rate limit enforced by queue</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/30">
              <div className="font-medium mb-2">Bot Tasks Concurrency</div>
              <div className="text-2xl font-bold">5 workers</div>
              <p className="text-sm text-muted-foreground">Parallel job processing</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Schedule Message Dialog */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Message</DialogTitle>
            <DialogDescription>
              Schedule a message to be sent at a specific time
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="chatId">Chat/Group ID</Label>
              <Input
                id="chatId"
                placeholder="e.g., -1001234567890"
                value={scheduleData.chatId}
                onChange={(e) =>
                  setScheduleData((d) => ({ ...d, chatId: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="text">Message (HTML supported)</Label>
              <Textarea
                id="text"
                placeholder="Enter your message..."
                rows={4}
                value={scheduleData.text}
                onChange={(e) =>
                  setScheduleData((d) => ({ ...d, text: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduledAt">Scheduled Time</Label>
              <Input
                id="scheduledAt"
                type="datetime-local"
                value={scheduleData.scheduledAt}
                onChange={(e) =>
                  setScheduleData((d) => ({ ...d, scheduledAt: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!scheduleData.chatId || !scheduleData.text || !scheduleData.scheduledAt) {
                  toast.error('Please fill all fields');
                  return;
                }
                scheduleMessage.mutate({
                  chatId: scheduleData.chatId,
                  text: scheduleData.text,
                  scheduledAt: new Date(scheduleData.scheduledAt).toISOString(),
                });
              }}
              disabled={scheduleMessage.isPending}
            >
              <Send className="mr-2 h-4 w-4" />
              {scheduleMessage.isPending ? 'Scheduling...' : 'Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
