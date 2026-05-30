/** @type {import('next').NextConfig} */
const nextConfig = {

  /**
   * COEP + COOP headers required for SharedArrayBuffer (@ffmpeg/ffmpeg).
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
          { key: "Cross-Origin-Opener-Policy",   value: "same-origin"  },
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
      },
    ];
  },

  /**
   * In Next.js 15 the key moved from experimental to top-level.
   * Keeps groq-sdk and elevenlabs server-only (they use Node.js built-ins).
   */
  serverExternalPackages: ["groq-sdk", "elevenlabs"],

  webpack(config) {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    return config;
  },
};

export default nextConfig;
