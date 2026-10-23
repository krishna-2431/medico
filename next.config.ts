import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@lancedb/lancedb", "@huggingface/transformers", "vectordb"],
};

export default nextConfig;
