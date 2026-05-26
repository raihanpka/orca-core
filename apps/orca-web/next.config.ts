import type { NextConfig } from "next";
import path from 'path';

/**
 * Konfigurasi Next.js dengan strategi caching yang dibedakan antara
 * aset statis panduan dan aset dinamis lainnya untuk performa optimal.
 */
const nextConfig: NextConfig = {
  // Output standalone untuk efisiensi kontainer Docker
  output: "standalone",

  // Optimalisasi gambar
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 0,

    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],

    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "github.com",
        pathname: "/**",
      }
    ],
  },

  // Pengaturan header untuk kontrol cache yang spesifik
  async headers() {
    return [
      {
        // Aset statis berat yang jarang berubah
        // Cache selama 3 bulan (7.776.000 detik)
        source: "/assets/dashboard/guide/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=7776000, immutable",
          },
        ],
      },
      {
        source: "/assets/((?!dashboard/guide/).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
      {
        // Logo dan Favicon: Cache selama 1 minggu
        source: "/logo/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate",
          },
        ],
      },
    ];
  },

  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "clsx",
      "tailwind-merge",
      "recharts",
      "@tanstack/react-table"
    ]
  },
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  // turbopack: {
  //   root: path.join(__dirname, '../..'),
  // },
};

export default nextConfig;
