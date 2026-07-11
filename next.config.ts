import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
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
