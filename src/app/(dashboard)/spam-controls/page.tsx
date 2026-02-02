'use client';

import { useState } from 'react';
import { Shield, AlertTriangle, Ban, Settings, Power, Search, Loader2, X } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

export default function SpamControlsPage() {
  const [blacklistKeyword, setBlacklistKeyword] = useState('');
  const utils = trpc.useUtils();

  // Fetch settings
  const { data: settings, isLoading } = trpc.settings.get.useQuery();

  // Mutations
  const updateSettings = trpc.settings.update.useMutation({
    onSuccess: () => {
      utils.settings.get.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const emergencyStopMutation = trpc.settings.emergencyStop.useMutation({
    onSuccess: () => {
      toast.error('Emergency stop activated! All campaigns paused.');
      utils.settings.get.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const resumeMutation = trpc.settings.resume.useMutation({
    onSuccess: () => {
      toast.success('Emergency stop deactivated. Campaigns resumed.');
      utils.settings.get.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const spamControl = settings?.spamControl;
  const adDensity = spamControl?.globalMaxAdsPerHour ?? 3;
  const manualApproval = spamControl?.requireManualApproval ?? false;
  const emergencyStop = spamControl?.emergencyStopActive ?? false;
  const blacklistedKeywords = spamControl?.keywordBlacklist ?? [];

  const spamRiskLevel = adDensity > 5 ? 'high' : adDensity > 3 ? 'medium' : 'low';

  const getRiskColor = (risk: string) => {
    const colors: Record<string, string> = {
      low: 'bg-green-500/10 text-green-500 border-green-500/20',
      medium: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      high: 'bg-red-500/10 text-red-500 border-red-500/20',
    };
    return colors[risk] || colors['medium'];
  };

  const handleEmergencyStop = () => {
    if (!emergencyStop) {
      emergencyStopMutation.mutate();
    } else {
      resumeMutation.mutate();
    }
  };

  const handleAdDensityChange = (value: number[]) => {
    updateSettings.mutate({
      spamControl: { globalMaxAdsPerHour: value[0] },
    });
  };

  const handleManualApprovalChange = (checked: boolean) => {
    updateSettings.mutate({
      spamControl: { requireManualApproval: checked },
    });
  };

  const addKeyword = () => {
    if (blacklistKeyword.trim()) {
      const newKeywords = [...blacklistedKeywords, blacklistKeyword.trim()];
      updateSettings.mutate({
        spamControl: { keywordBlacklist: newKeywords },
      });
      toast.success(`Added "${blacklistKeyword}" to blacklist`);
      setBlacklistKeyword('');
    }
  };

  const removeKeyword = (keywordToRemove: string) => {
    const newKeywords = blacklistedKeywords.filter((k: string) => k !== keywordToRemove);
    updateSettings.mutate({
      spamControl: { keywordBlacklist: newKeywords },
    });
    toast.success(`Removed "${keywordToRemove}" from blacklist`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Spam & Safety Controls</h1>
          <p className="text-muted-foreground">
            Manage posting limits and safety measures
          </p>
        </div>
        <Button
          variant={emergencyStop ? 'destructive' : 'outline'}
          onClick={handleEmergencyStop}
          className="gap-2"
          disabled={emergencyStopMutation.isPending || resumeMutation.isPending}
        >
          {(emergencyStopMutation.isPending || resumeMutation.isPending) ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Power className="h-4 w-4" />
          )}
          {emergencyStop ? 'Deactivate Emergency Stop' : 'Emergency Stop'}
        </Button>
      </div>

      {emergencyStop && (
        <Card className="bg-red-500/10 border-red-500/20">
          <CardContent className="flex items-center gap-4 p-4">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <div>
              <div className="font-medium text-red-500">Emergency Stop Active</div>
              <div className="text-sm text-muted-foreground">
                All campaigns are currently paused. No ads will be posted until deactivated.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card/80 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Spam Risk</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <Badge variant="outline" className={`text-lg ${getRiskColor(spamRiskLevel)}`}>
                {spamRiskLevel.toUpperCase()}
              </Badge>
            )}
            <p className="text-xs text-muted-foreground mt-1">Current risk level</p>
          </CardContent>
        </Card>
        <Card className="bg-card/80 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ad Density</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">{adDensity}/hr</div>
            )}
            <p className="text-xs text-muted-foreground">Max ads per group</p>
          </CardContent>
        </Card>
        <Card className="bg-card/80 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Blacklisted</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">{blacklistedKeywords.length}</div>
            )}
            <p className="text-xs text-muted-foreground">Keywords blocked</p>
          </CardContent>
        </Card>
        <Card className="bg-card/80 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Manual Review</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">{manualApproval ? 'ON' : 'OFF'}</div>
            )}
            <p className="text-xs text-muted-foreground">Approval required</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="bg-card/80 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Posting Limits
            </CardTitle>
            <CardDescription>
              Control ad frequency and density
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Max Ads per Hour (per group)</Label>
                    <span className="font-medium">{adDensity}</span>
                  </div>
                  <Slider
                    value={[adDensity]}
                    onValueCommit={handleAdDensityChange}
                    max={10}
                    min={1}
                    step={1}
                    disabled={updateSettings.isPending}
                  />
                  <p className="text-sm text-muted-foreground">
                    Higher values increase spam risk and may result in group bans.
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                  <div>
                    <Label>Manual Approval Required</Label>
                    <p className="text-sm text-muted-foreground">
                      Review all posts before sending
                    </p>
                  </div>
                  <Switch
                    checked={manualApproval}
                    onCheckedChange={handleManualApprovalChange}
                    disabled={updateSettings.isPending}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                  <div>
                    <Label>Auto-pause on High Risk</Label>
                    <p className="text-sm text-muted-foreground">
                      Pause campaigns if spam risk is high
                    </p>
                  </div>
                  <Switch defaultChecked disabled />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/80 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5" />
              Keyword Blacklist
            </CardTitle>
            <CardDescription>
              Block posts containing these keywords
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Add keyword..."
                  value={blacklistKeyword}
                  onChange={(e) => setBlacklistKeyword(e.target.value)}
                  className="pl-9"
                  onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
                  disabled={updateSettings.isPending}
                />
              </div>
              <Button onClick={addKeyword} disabled={updateSettings.isPending || !blacklistKeyword.trim()}>
                {updateSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
              </Button>
            </div>

            {isLoading ? (
              <div className="flex flex-wrap gap-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-6 w-20" />
                ))}
              </div>
            ) : blacklistedKeywords.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">
                No keywords blacklisted yet
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-48 overflow-auto">
                {blacklistedKeywords.map((keyword: string) => (
                  <Badge
                    key={keyword}
                    variant="secondary"
                    className="cursor-pointer hover:bg-destructive/20 gap-1"
                    onClick={() => removeKeyword(keyword)}
                  >
                    {keyword}
                    <X className="h-3 w-3 text-muted-foreground" />
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/80 border-border/50">
        <CardHeader>
          <CardTitle>Safety Guidelines</CardTitle>
          <CardDescription>
            Best practices for avoiding spam detection
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="font-medium text-green-500 mb-2">Recommended</div>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>2-3 ads per hour max</li>
                <li>Vary post content</li>
                <li>Use different creatives</li>
                <li>Respect group rules</li>
              </ul>
            </div>
            <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <div className="font-medium text-yellow-500 mb-2">Caution</div>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>4-6 ads per hour</li>
                <li>Same message format</li>
                <li>Peak hours only</li>
                <li>Limited variety</li>
              </ul>
            </div>
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="font-medium text-red-500 mb-2">High Risk</div>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>7+ ads per hour</li>
                <li>Duplicate content</li>
                <li>Aggressive CTAs</li>
                <li>Banned keywords</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
