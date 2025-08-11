/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    domains: ['placeholder.svg'],
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: '/textbook/:path*',
        destination: 'http://localhost:8000/textbook/:path*',
      },
      {
        source: '/auth/:path*',
        destination: 'http://localhost:8000/auth/:path*',
      },
      {
        source: '/progress/:path*',
        destination: 'http://localhost:8000/progress/:path*',
      },
    ]
  },
}

export default nextConfig