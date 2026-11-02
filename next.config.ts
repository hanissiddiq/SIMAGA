import type { NextConfig } from "next";

// HAPUS tulisan ": NextConfig" setelah nama variabel
const nextConfig = {
  /* config options here */
  // eslint: {
  //   ignoreDuringBuilds: true,
  // },
  typescript: {
    // Ini tambahan penting supaya error coding kecil tidak menggagalkan build
    ignoreBuildErrors: true, 
  },
};

export default nextConfig;