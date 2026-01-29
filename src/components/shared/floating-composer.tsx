'use client';

import { useState } from 'react';
import { MessageSquarePlus, Send, X } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

export function FloatingComposer() {
  const [open, setOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [message, setMessage] = useState('');

  const { data: groups } = trpc.group.getActive.useQuery();

  const sendMessage = trpc.group.testMessage.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setOpen(false);
      setMessage('');
      setSelectedGroupId('');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSend = () => {
    if (!selectedGroupId) {
      toast.error('Please select a group');
      return;
    }
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }
    sendMessage.mutate({
      groupId: selectedGroupId,
      text: message,
    });
  };

  return (
    <>
      {/* Floating Action Button */}
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow z-50"
        size="icon"
      >
        <MessageSquarePlus className="h-6 w-6" />
      </Button>

      {/* Composer Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Quick Message</DialogTitle>
            <DialogDescription>
              Send a message to any active group instantly
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="group">Select Group</Label>
              <Select
                value={selectedGroupId}
                onValueChange={setSelectedGroupId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a group..." />
                </SelectTrigger>
                <SelectContent>
                  {groups?.map((group) => (
                    <SelectItem key={group._id.toString()} value={group._id.toString()}>
                      {group.name}
                      {group.username && ` (@${group.username})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message (HTML supported)</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter your message..."
                rows={5}
              />
              <p className="text-xs text-muted-foreground">
                Supports HTML tags: &lt;b&gt;, &lt;i&gt;, &lt;a href=&quot;&quot;&gt;
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={sendMessage.isPending || !selectedGroupId || !message.trim()}
            >
              <Send className="h-4 w-4 mr-2" />
              {sendMessage.isPending ? 'Sending...' : 'Send Message'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
