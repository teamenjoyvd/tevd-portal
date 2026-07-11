import path from 'path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Pin the project root so dev servers started inside git worktrees
  // (.claude/worktrees/*) don't resolve the main checkout as root.
  turbopack: {
    root: path.resolve(__dirname),
  },
  experimental: {
    optimizePackageImports: ['lucide-react', '@tanstack/react-query'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/guides',
        destination: '/library',
        permanent: true,
      },
      {
        source: '/guides/:slug',
        destination: '/library/:slug',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
