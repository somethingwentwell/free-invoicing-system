import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typedRoutes: true,
  outputFileTracingIncludes: {
    '/api/documents/[id]/pdf': ['./src/lib/fonts/**']
  }
};

export default nextConfig;
