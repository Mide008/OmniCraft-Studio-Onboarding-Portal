import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.0.105', 'localhost:3000'], // optional, prevents cross-origin warnings
  experimental: { serverActions: { bodySizeLimit: '10mb' } }, // or '50mb'
  turbopack: { root: path.resolve(__dirname) },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/**' }],
  },
}
export default nextConfig