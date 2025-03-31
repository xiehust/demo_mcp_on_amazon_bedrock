/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Set up environment variables for server-side code
  env: {
    SERVER_MCP_BASE_URL: process.env.SERVER_MCP_BASE_URL,
  },
  // Allow CORS for API routes
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-User-ID' },
        ],
      },
    ];
  },
  // Configure server settings
  serverRuntimeConfig: {
    // Keep connections alive for streaming
    keepAliveTimeout: 120000*10, // 20 minutes
  }
};

module.exports = nextConfig;
