import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // For development only – Vercel will ignore this in production
  allowedDevOrigins: ['192.168.0.103', 'localhost:3000'],
  // No 'turbo' key anywhere
};

export default nextConfig;