import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow fetching from Thai gold price sources
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
    ];
  },
  serverExternalPackages: ['cheerio'],
};

export default nextConfig;
