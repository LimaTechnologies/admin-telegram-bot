'use client';

import { useState, useEffect } from 'react';
import { Activity, Play, Pause, RotateCcw, Trash2, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

interface QueueJob {
  id: string;
  name: string;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  progress: number;
  data: {
    campaignName?: string;
    groupName?: string;
  };
  timestamp: string;
  error?: string;
}

export default function QueueMonitorPage() {
  const [isPaused, setIsPaused] = useState(false);

  // Mock queue data - in production this would come from BullMQ dashboard API
  const [queues] = useState([
    { name: 'post:scheduled', waiting: 12, active: 2, completed: 145, failed: 3 },
    { name: 'post:immediate', waiting: 0, active: 1, completed: 89, failed: 0 },
    { name: 'audit:log', waiting: 5, active: 1, completed: 523, failed: 0 },
    { name: 'analytics:aggregate', waiting: 0, active: 0, completed: 24, failed: 1 },
  ]);

  const [jobs, setJobs] = useState<QueueJob[]>([
    { id: '1', name: 'post:scheduled', status: 'active', progress: 45, data: { campaignName: 'Summer OF', groupName: 'Group 1' }, timestamp: '2 min ago' },
    { id: '2', name: 'post:scheduled', status: 'waiting', progress: 0, data: { campaignName: 'Casino Welcome', groupName: 'Group 2' }, timestamp: '5 min ago' },
    { id: '3', name: 'post:scheduled', status: 'failed', progress: 100, data: { campaignName: 'New Model', groupName: 'Group 3' }, timestamp: '10 min ago', error: 'Rate limited by Telegram' },
    { id: '4', name: 'audit:log', status: 'completed', progress: 100, data: { campaignName: 'System' }, timestamp: '15 min ago' },
    { id: '5', name: 'post:immediate', status: 'active', progress: 78, data: { campaignName: 'Flash Sale', groupName: 'All Groups' }, timestamp: '1 min ago' },
  ]);

  // Simulate progress updates
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setJobs(prev => prev.map(job => {
        if (job.status === 'active' && job.progress < 100) {
          const newProgress = Math.min(100, job.progress + Math.random() * 10);
          return {
            ...job,
            progress: newProgress,
            status: newProgress >= 100 ? 'completed' : 'active',
          };
        }
        return job;
      }));
    }, 2000);

    return () => clearInterval(interval);
  }, [isPaused]);

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
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
    toast.success(isPaused ? 'Queue processing resumed' : 'Queue processing paused');
  };

  const retryJob = (id: string) => {
    setJobs(prev => prev.map(job =>
      job.id === id ? { ...job, status: 'waiting', progress: 0, error: undefined } : job
    ));
    toast.success('Job queued for retry');
  };

  const removeJob = (id: string) => {
    setJobs(prev => prev.filter(job => job.id !== id));
    toast.success('Job removed from queue');
  };

  const totalWaiting = queues.reduce((sum, q) => sum + q.waiting, 0);
  const totalActive = queues.reduce((sum, q) => sum + q.active, 0);
  const totalCompleted = queues.reduce((sum, q) => sum + q.completed, 0);
  const totalFailed = queues.reduce((sum, q) => sum + q.failed, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Queue Monitor</h1>
          <p className="text-muted-foreground">
            Monitor and manage background job queues
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={togglePause}>
            {isPaused ? (
              <>
                <Play className="mr-2 h-4 w-4" />
                Resume
              </>
            ) : (
              <>
                <Pause className="mr-2 h-4 w-4" />
                Pause All
              </>
            )}
          </Button>
        </div>
      </div>

      {isPaused && (
        <Card className="bg-yellow-500/10 border-yellow-500/20">
          <CardContent className="flex items-center gap-4 p-4">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <div>
              <div className="font-medium text-yellow-500">Queue Processing Paused</div>
              <div className="text-sm text-muted-foreground">
                No new jobs will be processed until resumed.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="bg-card/80 border-border/50">
          <CardHeader>
            <CardTitle>Queue Status</CardTitle>
            <CardDescription>
              Overview of all job queues
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {queues.map((queue) => (
                <div key={queue.name} className="p-4 rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium font-mono text-sm">{queue.name}</span>
                    <Badge variant="outline" className={queue.active > 0 ? 'bg-blue-500/10 text-blue-500' : ''}>
                      {queue.active > 0 ? 'Processing' : 'Idle'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Waiting:</span>
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
                      <span className="text-muted-foreground">Failed:</span>
                      <span className="ml-1 font-medium text-red-500">{queue.failed}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 border-border/50">
          <CardHeader>
            <CardTitle>Recent Jobs</CardTitle>
            <CardDescription>
              Latest job activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {jobs.map((job) => (
                <div key={job.id} className="p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(job.status)}
                      <span className="font-medium text-sm">{job.data.campaignName}</span>
                    </div>
                    <Badge variant="outline" className={getStatusColor(job.status)}>
                      {job.status}
                    </Badge>
                  </div>
                  {job.data.groupName && (
                    <div className="text-xs text-muted-foreground mb-2">
                      Target: {job.data.groupName}
                    </div>
                  )}
                  {job.status === 'active' && (
                    <Progress value={job.progress} className="h-1 mb-2" />
                  )}
                  {job.error && (
                    <div className="text-xs text-red-500 mb-2">
                      Error: {job.error}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{job.timestamp}</span>
                    {job.status === 'failed' && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => retryJob(job.id)}
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          onClick={() => removeJob(job.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/80 border-border/50">
        <CardHeader>
          <CardTitle>Queue Configuration</CardTitle>
          <CardDescription>
            Current rate limiting and processing settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg bg-muted/30">
              <div className="font-medium mb-2">Per-Group Rate Limit</div>
              <div className="text-2xl font-bold">1 msg / 5 min</div>
              <p className="text-sm text-muted-foreground">
                Cooldown between posts to same group
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/30">
              <div className="font-medium mb-2">Per-Bot Rate Limit</div>
              <div className="text-2xl font-bold">30 msg / sec</div>
              <p className="text-sm text-muted-foreground">
                Telegram API limit
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/30">
              <div className="font-medium mb-2">Worker Concurrency</div>
              <div className="text-2xl font-bold">5 workers</div>
              <p className="text-sm text-muted-foreground">
                Parallel job processing
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
