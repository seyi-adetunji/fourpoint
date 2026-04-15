import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* force all routes dynamic via per-page `export const dynamic = "force-dynamic"` */
};

/* Trigger reload to pick up new Prisma Client location (v5) */
export default nextConfig;
