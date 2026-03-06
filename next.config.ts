import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(process.cwd()),
  webpack: (config, { dev }) => {
    if (dev) {
      // Ignore an accidentally nested Next project at /app that can stall startup.
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          "**/app/node_modules/**",
          "**/app/.next/**",
          "**/app/.git/**",
          "**/app_backup_nested_project/**",
        ],
      };
    }

    return config;
  },
};

export default nextConfig;
