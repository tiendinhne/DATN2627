import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // @shared/* trỏ vào backend/src/shared (ADR-024). Backend là ESM nên import tương đối ghi đuôi ".js"
  // (vd "./enums.js") nhưng file thật là .ts — webpack không tự hiểu như TypeScript, phải khai báo
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".js"],
    };
    return config;
  },
};

export default nextConfig;
