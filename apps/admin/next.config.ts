import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The Convex functions live in packages/convex; importing the generated API
  // reference keeps the admin app on the same typed client as every other caller.
  transpilePackages: ["@grocery/shared"],
};

export default nextConfig;
