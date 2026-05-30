/**
 * middleware.ts
 *
 * Injects Cross-Origin-Embedder-Policy and Cross-Origin-Opener-Policy headers
 * on every response. These are required for SharedArrayBuffer, which
 * @ffmpeg/ffmpeg uses internally to enable multi-threaded WASM processing.
 *
 * Without these headers ffmpeg.wasm will throw:
 *   "SharedArrayBuffer is not defined"
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set("Cross-Origin-Embedder-Policy", "require-corp");
  response.headers.set("Cross-Origin-Opener-Policy",   "same-origin");
  return response;
}

export const config = {
  matcher: "/:path*",
};
