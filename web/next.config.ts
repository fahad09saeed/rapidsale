import type { NextConfig } from "next";

// Set NEXT_BASE_PATH (e.g. "/rapidsale") at build time to serve the site under a sub-path.
const basePath = process.env.NEXT_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  basePath,
};

export default nextConfig;
