/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for @ffmpeg/ffmpeg (SharedArrayBuffer needs these security headers)
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
          { key: "Cross-Origin-Opener-Policy",   value: "same-origin"  },
        ],
      },
    ];
  },

  // Allow large file uploads (25 MB — Groq Whisper limit)
  experimental: {
    serverComponentsExternalPackages: ["groq-sdk", "elevenlabs"],
  },

  webpack(config) {
    // Ensure WASM files are handled correctly
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    return config;
  },
};

export default nextConfig;
