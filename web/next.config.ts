import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Makes Cloudflare bindings (R2, etc.) available in `next dev`
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  turbopack: {
    root: import.meta.dirname,
  },
  serverExternalPackages: ["node-cron", "grammy"],
};

export default nextConfig;
