// next.config.ts
import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // ✅ Resolve o warning:
  // "Detected multiple lockfiles... selected C:\Users\kainr\package-lock.json as root"
  // Força o root do Turbopack pra pasta do projeto.
  turbopack: {
    root: path.join(__dirname),
  },

  // (Opcional, mas ajuda em alguns casos com libs que fazem import dinâmico)
  // experimental: {
  //   turbo: {},
  // },
};

export default nextConfig;
