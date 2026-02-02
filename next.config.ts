import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // standalone is for Docker/self-hosted only, not for Vercel
  output: process.env['VERCEL'] ? undefined : 'standalone',
};

export default nextConfig;
