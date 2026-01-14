/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {},
  // Uncomment for GitHub Pages static export:
  // output: 'export',
  // basePath: '/SolMate',
  // images: { unoptimized: true },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      os: false,
      path: false,
    };
    return config;
  },
}

module.exports = nextConfig
