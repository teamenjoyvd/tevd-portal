import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
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
