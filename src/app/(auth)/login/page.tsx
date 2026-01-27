'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Mail, Loader2, Send } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [sent, setSent] = useState(false);
  const router = useRouter();

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '' },
  });

  const sendMagicLink = trpc.auth.sendMagicLink.useMutation({
    onSuccess: (data) => {
      // Check if this was a direct login (dev bypass)
      if ('directLogin' in data && data.directLogin) {
        toast.success('Logged in successfully!');
        router.push('/groups');
        return;
      }
      // Normal magic link flow
      setSent(true);
      toast.success('Check your email for the login link');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to send login link');
    },
  });

  const onSubmit = (data: LoginForm) => {
    sendMagicLink.mutate(data);
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
        <Card className="w-full max-w-md backdrop-blur-sm bg-card/80 border-border/50">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Mail className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Check your email</CardTitle>
            <CardDescription>
              We sent a magic link to <strong>{form.getValues('email')}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-sm text-muted-foreground">
              Click the link in your email to sign in. The link expires in 15 minutes.
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setSent(false)}
            >
              Use a different email
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <Card className="w-full max-w-md backdrop-blur-sm bg-card/80 border-border/50">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mb-4">
            <Send className="w-6 h-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>
            Enter your email to receive a magic link
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        autoComplete="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full"
                disabled={sendMagicLink.isPending}
              >
                {sendMagicLink.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Magic Link
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
