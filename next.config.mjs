const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  // Increase the timeout for API routes to handle slow first-compile in dev
  experimental: {
    serverComponentsExternalPackages: ['mongoose', 'bcryptjs'],
  },
};

export default nextConfig;