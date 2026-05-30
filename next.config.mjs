/** @type {import('next').NextConfig} */
const nextConfig = {

  /**
   * COEP + COOP headers are mandatory for SharedArrayBuffer,
   * which @ffmpeg/ffmpeg uses internally for multi-threaded WASM.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp"  },
          { key: "Cross-Origin-Opener-Policy",   value: "same-origin"   },
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin"  },
        ],
      },
    ];
  },

  /**
   * These packages use Node.js built-ins and must stay server-side.
   */
  experimental: {
    serverComponentsExternalPackages: ["groq-sdk", "elevenlabs"],
  },

  /**
   * Allow WASM imports from @ffmpeg/core (loaded from unpkg CDN at runtime).
   */
  webpack(config) {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    return config;
  },

};

export default nextConfig;
