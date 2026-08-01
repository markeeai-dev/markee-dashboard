import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self' https://*.supabase.co https://generativelanguage.googleapis.com https://api.shopaikey.com https://openrouter.ai wss://*.supabase.co wss://seeding.markeeai.com https://seeding.markeeai.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  // Lint KHÔNG chặn build. Team cố ý dùng `any` + eslint-disable theo dòng và vẫn ship;
  // `next build` mặc định coi lỗi ESLint là fail -> chính Dockerfile prod (`pnpm build`) cũng
  // build KHÔNG nổi trên main hiện tại. Bật cờ này để build phản ánh "app có deploy được không",
  // vẫn GIỮ kiểm tra TypeScript type (type error vẫn làm build fail). Lint chạy riêng (job CI).
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
