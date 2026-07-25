import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // /pricing shipped live before the page was renamed to /support. It was never
  // "pricing" — nothing on it is priced — but the URL is out there, so keep it
  // resolving permanently rather than 404ing anyone who saved it.
  async redirects() {
    return [{ source: "/pricing", destination: "/support", permanent: true }];
  },
};

export default nextConfig;

// Lets `next dev` reach local Cloudflare bindings via the OpenNext adapter.
initOpenNextCloudflareForDev();
