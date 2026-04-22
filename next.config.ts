import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: [],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/**',
      },
    ],
  },
  // ADD THIS SECTION BELOW TO FIX THE 403 / NETWORK ERRORS
  experimental: {
    turbo: {
      allowedDevOrigins: ['192.168.0.103', 'localhost:3000'],
    },
  },
}

export default nextConfig