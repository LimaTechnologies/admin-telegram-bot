'use client';

import { useState } from 'react';
import {
  DollarSign,
  Megaphone,
  Calendar,
  TrendingUp,
  Users,
  Eye,
  MousePointer,
  Activity,
  Pause,
  Play,
  AlertTriangle,
} from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { StatsCard } from '@/components/shared/stats-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

type Period = 'today' | '7d' | '30d';

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>('7d');

  const { data: overview, isLoading: overviewLoading } = trpc.analytics.getOverview.useQuery({ period });
  const { data: revenueTrend, isLoading: trendLoading } = trpc.analytics.getRevenueTrend.useQuery({
    period: period === 'today' ? '7d' : period,
  });
  const { data: topCampaigns, isLoading: campaignsLoading } = trpc.analytics.getPerformanceByCampaign.useQuery({
    period: period === 'today' ? '7d' : period,
    limit: 5,
  });
  const { data: spamRisk } = trpc.settings.getSpamRiskLevel.useQuery();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      compactDisplay: 'short',
    }).format(value);
  };

  const getSpamRiskColor = (level?: string) => {
    switch (level) {
      case 'green':
        return 'bg-green-500';
      case 'yellow':
        return 'bg-yellow-500';
      case 'red':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Period Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your advertising performance</p>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="7d">7 Days</TabsTrigger>
            <TabsTrigger value="30d">30 Days</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Spam Risk Alert */}
      {spamRisk?.level === 'red' && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="flex items-center gap-4 p-4">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div className="flex-1">
              <p className="font-medium text-destructive">Emergency Stop Active</p>
              <p className="text-sm text-muted-foreground">
                All posting has been paused. Review spam controls to resume.
              </p>
            </div>
            <Button variant="destructive" size="sm">
              Review Settings
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {overviewLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-3 w-20 mt-2" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <StatsCard
              title="Total Revenue"
              value={formatCurrency(overview?.posts.totalRevenue || 0)}
              icon={DollarSign}
              trend={{ value: 12.5, isPositive: true }}
              description="vs previous period"
            />
            <StatsCard
              title="Active Campaigns"
              value={overview?.campaigns.active || 0}
              icon={Megaphone}
              description={`${overview?.campaigns.total || 0} total`}
            />
            <StatsCard
              title="Posts Sent"
              value={formatNumber(overview?.posts.totalPosts || 0)}
              icon={Calendar}
              description={`${formatNumber(overview?.posts.totalViews || 0)} views`}
            />
            <StatsCard
              title="Click Rate (CTR)"
              value={`${overview?.posts.ctr || 0}%`}
              icon={MousePointer}
              trend={{ value: 2.3, isPositive: true }}
            />
          </>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-7">
        {/* Revenue Trend */}
        <Card className="lg:col-span-4 backdrop-blur-sm bg-card/80 border-border/50">
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
            <CardDescription>Daily revenue over time</CardDescription>
          </CardHeader>
          <CardContent>
            {trendLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueTrend || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis
                    dataKey="_id"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    tickFormatter={(value) => value.split('-').slice(1).join('/')}
                  />
                  <YAxis
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [`$${value}`, 'Revenue']}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card className="lg:col-span-3 backdrop-blur-sm bg-card/80 border-border/50">
          <CardHeader>
            <CardTitle>Platform Stats</CardTitle>
            <CardDescription>Current system status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Active Groups</span>
              </div>
              <span className="font-medium">{overview?.groups.activeGroups || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Total Members Reached</span>
              </div>
              <span className="font-medium">{formatNumber(overview?.groups.totalMembers || 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Active Deals</span>
              </div>
              <span className="font-medium">{overview?.deals.activeDeals || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Expected Revenue</span>
              </div>
              <span className="font-medium">{formatCurrency(overview?.deals.expectedRevenue || 0)}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Spam Risk Level</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${getSpamRiskColor(spamRisk?.level)}`} />
                <span className="text-sm capitalize">{spamRisk?.level || 'Unknown'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Campaigns */}
      <Card className="backdrop-blur-sm bg-card/80 border-border/50">
        <CardHeader>
          <CardTitle>Top Performing Campaigns</CardTitle>
          <CardDescription>Campaigns with highest revenue</CardDescription>
        </CardHeader>
        <CardContent>
          {campaignsLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topCampaigns || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis type="number" tickFormatter={(value) => `$${value}`} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={150}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`$${value}`, 'Revenue']}
                />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Button className="h-auto py-4 flex flex-col items-center gap-2" variant="outline">
          <Play className="h-5 w-5" />
          <span>Create Campaign</span>
        </Button>
        <Button className="h-auto py-4 flex flex-col items-center gap-2" variant="outline">
          <Pause className="h-5 w-5" />
          <span>Pause All Active</span>
        </Button>
        <Button
          className="h-auto py-4 flex flex-col items-center gap-2"
          variant="outline"
          disabled={spamRisk?.emergencyStopActive}
        >
          <AlertTriangle className="h-5 w-5" />
          <span>Emergency Stop</span>
        </Button>
      </div>
    </div>
  );
}
