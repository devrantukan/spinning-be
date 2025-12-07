const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { defaultLoaders }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname),
    }
    
    // Ensure proper module resolution
    config.resolve.modules = [
      path.resolve(__dirname),
      'node_modules',
      ...(config.resolve.modules || []),
    ]
    
    return config
  },
}

module.exports = nextConfig



