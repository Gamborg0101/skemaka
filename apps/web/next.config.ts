import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const isProd = process.env.NODE_ENV === "production"

const CSP = [
  "default-src 'self'",
  // Next dev mode uses eval() for hot-reloading; strip it in production.
  isProd
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.neon.tech wss://*.neon.tech https://api.stripe.com",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // upgrade-insecure-requests only in prod — on HTTP localhost it silently
  // upgrades _next/static asset requests to HTTPS, breaking all CSS/JS.
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ")

const securityHeaders = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // HSTS: prod only. On http://localhost this would pin the browser to HTTPS for
  // the whole origin — including every other project on port 3000 — and the only
  // cure is clearing the browser's HSTS store by hand.
  //
  // Two years, subdomains included, and `preload` so the very first request is
  // never plaintext. Vercel serves HTTPS for skemaka.com regardless; what this
  // adds is the browser refusing to try HTTP at all, which is what protects a
  // session cookie from a hostile network on the way to the redirect.
  ...(isProd
    ? [{
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      }]
    : []),
]

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  transpilePackages: ["@skemaka/types", "@skemaka/api", "@skemaka/ui", "@skemaka/i18n"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ]
  },
};

export default withNextIntl(nextConfig);
