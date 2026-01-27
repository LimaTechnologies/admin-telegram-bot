'use client';

import { useState } from 'react';
import { Calendar, Clock, Plus, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function SchedulingPage() {
  const [selectedDate] = useState(new Date());

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const scheduledPosts = [
    { time: '09:00', campaign: 'Summer OF Promo', group: 'Group 1', type: 'onlyfans' },
    { time: '12:00', campaign: 'Casino Welcome Bonus', group: 'Group 2', type: 'casino' },
    { time: '15:00', campaign: 'New Model Intro', group: 'Group 1', type: 'onlyfans' },
    { time: '18:00', campaign: 'Evening Casino', group: 'Both', type: 'casino' },
    { time: '21:00', campaign: 'Late Night OF', group: 'Group 2', type: 'onlyfans' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Scheduling & Rotation</h1>
          <p className="text-muted-foreground">
            Plan and schedule your ad posts
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Schedule Post
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card/80 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Today&apos;s Posts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5</div>
            <p className="text-xs text-muted-foreground">scheduled</p>
          </CardContent>
        </Card>
        <Card className="bg-card/80 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">32</div>
            <p className="text-xs text-muted-foreground">posts planned</p>
          </CardContent>
        </Card>
        <Card className="bg-card/80 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">3</div>
            <p className="text-xs text-muted-foreground">need review</p>
          </CardContent>
        </Card>
        <Card className="bg-card/80 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Conflicts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">1</div>
            <p className="text-xs text-muted-foreground">to resolve</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 bg-card/80 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Weekly Schedule
            </CardTitle>
            <CardDescription>
              View and manage your posting schedule
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2 mb-4">
              {daysOfWeek.map((day, i) => (
                <div
                  key={day}
                  className={`text-center p-2 rounded ${
                    i === selectedDate.getDay()
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50'
                  }`}
                >
                  <div className="text-sm font-medium">{day}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(selectedDate.getTime() + (i - selectedDate.getDay()) * 86400000).getDate()}
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-2 max-h-64 overflow-auto">
              {hours.slice(8, 23).map((hour) => (
                <div key={hour} className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded">
                  <span className="text-sm text-muted-foreground w-12">
                    {hour.toString().padStart(2, '0')}:00
                  </span>
                  <div className="flex-1 h-8 bg-muted/30 rounded flex items-center px-2">
                    {scheduledPosts.find(p => parseInt(p.time) === hour) && (
                      <Badge variant="outline" className="text-xs">
                        {scheduledPosts.find(p => parseInt(p.time) === hour)?.campaign}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Today&apos;s Queue
            </CardTitle>
            <CardDescription>
              Upcoming posts for today
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {scheduledPosts.map((post, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded bg-muted/30">
                  <div className="text-sm font-medium text-muted-foreground">
                    {post.time}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{post.campaign}</div>
                    <div className="text-xs text-muted-foreground">{post.group}</div>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      post.type === 'onlyfans'
                        ? 'bg-pink-500/10 text-pink-500 border-pink-500/20'
                        : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                    }
                  >
                    {post.type === 'onlyfans' ? 'OF' : 'Casino'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-yellow-500/10 border-yellow-500/20">
        <CardContent className="flex items-center gap-4 p-4">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          <div>
            <div className="font-medium">Schedule Conflict Detected</div>
            <div className="text-sm text-muted-foreground">
              Two posts scheduled within 30 minutes at 15:00. Consider adjusting the timing.
            </div>
          </div>
          <Button variant="outline" size="sm" className="ml-auto">
            Resolve
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
