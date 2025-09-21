/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: 'client/dist',
  trailingSlash: true,
  exportPathMap: function() {
    return {
      '/': { page: '/client/dist/index.html' }
    }
  }
}

module.exports = nextConfig
