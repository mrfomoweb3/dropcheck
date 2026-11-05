/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // Emit app/index.html (not app.html) so /app works on any static host, not only Vercel.
  trailingSlash: true,
  reactStrictMode: true,
  images: { unoptimized: true },
};
export default nextConfig;
