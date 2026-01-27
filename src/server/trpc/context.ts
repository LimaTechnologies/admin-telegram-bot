import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import { cookies } from 'next/headers';
import { AuthService, connectDB } from '@common';
import type { SessionContext } from '$types/session';

export interface Context {
  session: SessionContext | null;
  req: {
    headers: Headers;
    ip?: string;
    userAgent?: string;
  };
}

export async function createContext(opts: FetchCreateContextFnOptions): Promise<Context> {
  // Ensure DB connection
  await connectDB();

  // Get session from cookie
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;

  let session: SessionContext | null = null;
  if (sessionToken) {
    session = await AuthService.validateSession(sessionToken);
  }

  // Extract IP and user agent
  const ip = opts.req.headers.get('x-forwarded-for')?.split(',')[0] ||
    opts.req.headers.get('x-real-ip') ||
    undefined;
  const userAgent = opts.req.headers.get('user-agent') || undefined;

  return {
    session,
    req: {
      headers: opts.req.headers,
      ip,
      userAgent,
    },
  };
}
