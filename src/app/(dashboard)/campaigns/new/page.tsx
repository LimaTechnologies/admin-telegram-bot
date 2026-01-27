'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import Link from 'next/link';

type CampaignType = 'onlyfans' | 'casino';
type Priority = 'low' | 'medium' | 'high';

export default function NewCampaignPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    type: 'onlyfans' as CampaignType,
    priority: 'medium' as Priority,
    description: '',
    startDate: '',
    endDate: '',
    dailyCap: '',
    weeklyCap: '',
    groupIds: [] as string[],
    creativeIds: [] as string[],
    modelId: '',
    casinoId: '',
  });

  // Fetch data for selects
  const { data: groups } = trpc.group.getActive.useQuery();
  const { data: creatives } = trpc.creative.getActive.useQuery();
  const { data: models } = trpc.model.list.useQuery({ page: 1, limit: 100 });
  const { data: casinos } = trpc.casino.list.useQuery({ page: 1, limit: 100 });

  const createCampaign = trpc.campaign.create.useMutation({
    onSuccess: () => {
      toast.success('Campaign created successfully');
      router.push('/campaigns');
    },
    onError: (error) => toast.error(error.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.startDate) {
      toast.error('Please fill in required fields');
      return;
    }

    if (formData.groupIds.length === 0) {
      toast.error('Please select at least one group');
      return;
    }

    if (formData.creativeIds.length === 0) {
      toast.error('Please select at least one creative');
      return;
    }

    createCampaign.mutate({
      name: formData.name,
      type: formData.type,
      priority: formData.priority,
      description: formData.description || undefined,
      schedule: {
        startDate: new Date(formData.startDate).toISOString(),
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : undefined,
        dailyCap: formData.dailyCap ? parseInt(formData.dailyCap) : undefined,
        weeklyCap: formData.weeklyCap ? parseInt(formData.weeklyCap) : undefined,
      },
      targeting: {
        groupIds: formData.groupIds,
      },
      creativeIds: formData.creativeIds,
      modelId: formData.type === 'onlyfans' && formData.modelId ? formData.modelId : undefined,
      casinoId: formData.type === 'casino' && formData.casinoId ? formData.casinoId : undefined,
    });
  };

  const toggleGroup = (groupId: string) => {
    setFormData((prev) => ({
      ...prev,
      groupIds: prev.groupIds.includes(groupId)
        ? prev.groupIds.filter((id) => id !== groupId)
        : [...prev.groupIds, groupId],
    }));
  };

  const toggleCreative = (creativeId: string) => {
    setFormData((prev) => ({
      ...prev,
      creativeIds: prev.creativeIds.includes(creativeId)
        ? prev.creativeIds.filter((id) => id !== creativeId)
        : [...prev.creativeIds, creativeId],
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/campaigns">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Create Campaign</h1>
          <p className="text-muted-foreground">
            Set up a new advertising campaign
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Campaign name and type</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Campaign Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Summer Promo 2024"
                />
              </div>
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) => setFormData({ ...formData, type: v as CampaignType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="onlyfans">OnlyFans</SelectItem>
                    <SelectItem value="casino">Casino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(v) => setFormData({ ...formData, priority: v as Priority })}
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
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Campaign description..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Schedule */}
          <Card>
            <CardHeader>
              <CardTitle>Schedule</CardTitle>
              <CardDescription>When should this campaign run</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Start Date *</Label>
                <Input
                  type="datetime-local"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="datetime-local"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Daily Cap</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.dailyCap}
                    onChange={(e) => setFormData({ ...formData, dailyCap: e.target.value })}
                    placeholder="e.g., 10"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Weekly Cap</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.weeklyCap}
                    onChange={(e) => setFormData({ ...formData, weeklyCap: e.target.value })}
                    placeholder="e.g., 50"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Entity Selection */}
          {formData.type === 'onlyfans' && (
            <Card>
              <CardHeader>
                <CardTitle>OnlyFans Model</CardTitle>
                <CardDescription>Select the model for this campaign</CardDescription>
              </CardHeader>
              <CardContent>
                <Select
                  value={formData.modelId}
                  onValueChange={(v) => setFormData({ ...formData, modelId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {models?.data?.map((model) => (
                      <SelectItem key={String(model._id)} value={String(model._id)}>
                        {model.name} (@{model.username})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(!models?.data || models.data.length === 0) && (
                  <p className="text-sm text-muted-foreground mt-2">
                    No models available. Create one first.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {formData.type === 'casino' && (
            <Card>
              <CardHeader>
                <CardTitle>Casino Brand</CardTitle>
                <CardDescription>Select the casino for this campaign</CardDescription>
              </CardHeader>
              <CardContent>
                <Select
                  value={formData.casinoId}
                  onValueChange={(v) => setFormData({ ...formData, casinoId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a casino" />
                  </SelectTrigger>
                  <SelectContent>
                    {casinos?.data?.map((casino) => (
                      <SelectItem key={String(casino._id)} value={String(casino._id)}>
                        {casino.name} ({casino.brand})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(!casinos?.data || casinos.data.length === 0) && (
                  <p className="text-sm text-muted-foreground mt-2">
                    No casinos available. Create one first.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Groups */}
          <Card>
            <CardHeader>
              <CardTitle>Target Groups *</CardTitle>
              <CardDescription>Select groups to target with this campaign</CardDescription>
            </CardHeader>
            <CardContent>
              {groups && groups.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-auto">
                  {groups.map((group) => (
                    <div key={String(group._id)} className="flex items-center space-x-2">
                      <Checkbox
                        id={`group-${String(group._id)}`}
                        checked={formData.groupIds.includes(String(group._id))}
                        onCheckedChange={() => toggleGroup(String(group._id))}
                      />
                      <label
                        htmlFor={`group-${String(group._id)}`}
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        {group.name}
                      </label>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No active groups available. Add groups first.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Creatives */}
          <Card>
            <CardHeader>
              <CardTitle>Creatives *</CardTitle>
              <CardDescription>Select creatives to use in this campaign</CardDescription>
            </CardHeader>
            <CardContent>
              {creatives && creatives.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-auto">
                  {creatives.map((creative) => (
                    <div key={String(creative._id)} className="flex items-center space-x-2">
                      <Checkbox
                        id={`creative-${String(creative._id)}`}
                        checked={formData.creativeIds.includes(String(creative._id))}
                        onCheckedChange={() => toggleCreative(String(creative._id))}
                      />
                      <label
                        htmlFor={`creative-${String(creative._id)}`}
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        {creative.name}
                      </label>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No compliant creatives available. Add creatives first.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Link href="/campaigns">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={createCampaign.isPending}>
            {createCampaign.isPending ? 'Creating...' : 'Create Campaign'}
          </Button>
        </div>
      </form>
    </div>
  );
}
