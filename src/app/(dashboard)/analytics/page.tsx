'use client';

import { useState } from 'react';
import { BarChart3, TrendingUp, Eye, MousePointer, DollarSign } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('7d');

  const { data: analyticsData, isLoading } = trpc.analytics.getOverview.useQuery({
    period: period === '90d' ? '30d' : period,
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  const formatNumber = (num: number) =>
    new Intl.NumberFormat('en-US', { notation: 'compact' }).format(num);

  // Mock chart data
  const chartData = [
    { name: 'Mon', views: 4000, clicks: 240, revenue: 400 },
    { name: 'Tue', views: 3000, clicks: 198, revenue: 300 },
    { name: 'Wed', views: 5000, clicks: 380, revenue: 580 },
    { name: 'Thu', views: 2780, clicks: 190, revenue: 290 },
    { name: 'Fri', views: 6890, clicks: 480, revenue: 680 },
    { name: 'Sat', views: 4390, clicks: 280, revenue: 450 },
    { name: 'Sun', views: 3490, clicks: 200, revenue: 320 },
  ];

  const campaignPerformance = [
    { name: 'Summer OF', views: 12500, clicks: 850, ctr: 6.8 },
    { name: 'Casino Welcome', views: 9800, clicks: 420, ctr: 4.3 },
    { name: 'New Model', views: 8200, clicks: 680, ctr: 8.3 },
    { name: 'Weekend Special', views: 6500, clicks: 390, ctr: 6.0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Performance Analytics</h1>
          <p className="text-muted-foreground">
            Track your campaign performance metrics
          </p>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
          <TabsList>
            <TabsTrigger value="7d">7 Days</TabsTrigger>
            <TabsTrigger value="30d">30 Days</TabsTrigger>
            <TabsTrigger value="90d">90 Days</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card/80 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Views</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatNumber(analyticsData?.posts?.totalViews || 0)}
                </div>
                <p className="text-xs text-green-500">+12.5% from last period</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card className="bg-card/80 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
            <MousePointer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatNumber(analyticsData?.posts?.totalClicks || 0)}
                </div>
                <p className="text-xs text-green-500">+8.2% from last period</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card className="bg-card/80 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg CTR</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {(analyticsData?.posts?.ctr || 0).toFixed(2)}%
                </div>
                <p className="text-xs text-green-500">+0.3% from last period</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card className="bg-card/80 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatCurrency(analyticsData?.posts?.totalRevenue || 0)}
                </div>
                <p className="text-xs text-green-500">+15.3% from last period</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="bg-card/80 border-border/50">
          <CardHeader>
            <CardTitle>Views & Clicks Trend</CardTitle>
            <CardDescription>Daily performance over the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="views"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="clicks"
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 border-border/50">
          <CardHeader>
            <CardTitle>Revenue by Day</CardTitle>
            <CardDescription>Daily revenue over the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                    }}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/80 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Campaign Performance
          </CardTitle>
          <CardDescription>
            Performance breakdown by campaign
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {campaignPerformance.map((campaign) => (
              <div
                key={campaign.name}
                className="flex items-center justify-between p-4 rounded-lg bg-muted/30"
              >
                <div>
                  <div className="font-medium">{campaign.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatNumber(campaign.views)} views
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">{formatNumber(campaign.clicks)} clicks</div>
                  <div className="text-sm text-green-500">{campaign.ctr}% CTR</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
