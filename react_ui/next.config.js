/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  env: {
    // Make SERVER_MCP_BASE_URL available to server-side code
    SERVER_MCP_BASE_URL: process.env.SERVER_MCP_BASE_URL,
  },
};

module.exports = nextConfig;
