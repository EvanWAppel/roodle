import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite loads its WASM assets through native Node file URLs.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
