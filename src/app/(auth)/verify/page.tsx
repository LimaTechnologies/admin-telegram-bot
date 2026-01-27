'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function VerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(() => {
    // Initialize with error if no token
    return token ? 'loading' : 'error';
  });
  const [errorMessage, setErrorMessage] = useState(() => {
    return token ? '' : 'No token provided';
  });
  const hasVerified = useRef(false);

  const verifyMutation = trpc.auth.verifyMagicLink.useMutation({
    onSuccess: () => {
      setStatus('success');
      setTimeout(() => {
        router.push('/');
      }, 2000);
    },
    onError: (error) => {
      setStatus('error');
      setErrorMessage(error.message || 'Invalid or expired link');
    },
  });

  const verify = useCallback(() => {
    if (token && !hasVerified.current) {
      hasVerified.current = true;
      verifyMutation.mutate({ token });
    }
  }, [token, verifyMutation]);

  useEffect(() => {
    verify();
  }, [verify]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <Card className="w-full max-w-md backdrop-blur-sm bg-card/80 border-border/50">
        <CardHeader className="text-center">
          {status === 'loading' && (
            <>
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
              <CardTitle className="text-2xl">Verifying...</CardTitle>
              <CardDescription>Please wait while we sign you in</CardDescription>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="mx-auto w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                <CheckCircle className="w-6 h-6 text-green-500" />
              </div>
              <CardTitle className="text-2xl">Welcome!</CardTitle>
              <CardDescription>
                You have been successfully signed in. Redirecting...
              </CardDescription>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <XCircle className="w-6 h-6 text-destructive" />
              </div>
              <CardTitle className="text-2xl">Verification Failed</CardTitle>
              <CardDescription>{errorMessage}</CardDescription>
            </>
          )}
        </CardHeader>

        {status === 'error' && (
          <CardContent>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push('/login')}
            >
              Try Again
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
