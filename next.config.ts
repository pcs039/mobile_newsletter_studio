import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return ["/client-review/:path*", "/api/client-review/:path*"].map((source) => ({
      source,
      headers: [
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
      ],
    }));
  },
};

export default nextConfig;
